import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Current App Version (aligned with package.json & app.json)
export const CURRENT_APP_VERSION = '1.1.7';

// Secure Backend Update & Download Endpoints (Hosted on Vercel)
// The client APK communicates exclusively with the backend service.
// Zero GitHub credentials or personal access tokens are stored in the client APK.
export const UPDATE_API_ENDPOINT = 'https://movieflix-pi-six.vercel.app/api/update';
export const APK_DOWNLOAD_ENDPOINT = 'https://movieflix-pi-six.vercel.app/api/download';

/**
 * Clean & compare semantic versions (e.g., "v1.1.4" vs "1.1.3")
 * Returns true if remoteVersion > currentVersion
 */
export function isNewerVersion(remoteVer, currentVer = CURRENT_APP_VERSION) {
  if (!remoteVer) return false;
  const clean = (v) =>
    (v || '')
      .replace(/^v/i, '')
      .split(/[-+]/)[0] // strip pre-release metadata
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const r = clean(remoteVer);
  const c = clean(currentVer);

  const len = Math.max(r.length, c.length);
  for (let i = 0; i < len; i++) {
    const rPart = r[i] || 0;
    const cPart = c[i] || 0;
    if (rPart > cPart) return true;
    if (rPart < cPart) return false;
  }
  return false;
}

/**
 * Format bytes to human readable string (e.g. 94.6 MB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Check for the latest release via the secure Movieflix backend update API.
 * The backend proxies GitHub releases using its secure server-side environment variables.
 */
export async function checkForUpdateAsync() {
  try {
    const checkUrl = `${UPDATE_API_ENDPOINT}?current=${encodeURIComponent(
      CURRENT_APP_VERSION
    )}&_t=${Date.now()}`;

    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': `Movieflix-App/${CURRENT_APP_VERSION}`,
      },
    });

    if (!response.ok) {
      console.log('Update backend check status:', response.status);
      return {
        hasUpdate: false,
        currentVersion: CURRENT_APP_VERSION,
        error: `Update service returned status ${response.status}`,
      };
    }

    const data = await response.json();
    if (!data || typeof data !== 'object') {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: CURRENT_APP_VERSION,
      };
    }

    const latestTag = data.latestTag || data.latestVersion || CURRENT_APP_VERSION;
    const cleanTag = (data.latestVersion || latestTag).replace(/^v/i, '');
    const hasUpdate = Boolean(data.hasUpdate && data.apkAsset && data.apkAsset.downloadUrl);

    const apkAsset = data.apkAsset
      ? {
          name: data.apkAsset.name || `movieflix-v${cleanTag}.apk`,
          size: data.apkAsset.size || 0,
          sizeFormatted: data.apkAsset.sizeFormatted || formatBytes(data.apkAsset.size || 0),
          downloadUrl: data.apkAsset.downloadUrl || APK_DOWNLOAD_ENDPOINT,
        }
      : null;

    const updateInfo = {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: cleanTag,
      latestTag,
      releaseTitle: data.releaseTitle || `Movieflix v${cleanTag}`,
      releaseNotes: data.releaseNotes || 'Performance improvements and stability fixes.',
      publishedAt: data.publishedAt,
      releaseUrl: data.releaseUrl,
      downloadUrl: data.downloadUrl || APK_DOWNLOAD_ENDPOINT,
      apkAsset,
    };

    // Cache latest check result locally
    try {
      await AsyncStorage.setItem(
        '@movieflix_last_update_check',
        JSON.stringify({ ...updateInfo, checkedAt: Date.now() })
      );
    } catch (_) {}

    return updateInfo;
  } catch (err) {
    console.warn('Backend update check failed:', err);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      error: err.message,
    };
  }
}

/**
 * Download APK file with progress callback and trigger Android package installation.
 * The download source points to the secure backend proxy (which redirects to signed S3 binary).
 */
export async function downloadAndInstallApkAsync(apkAsset, onProgress) {
  try {
    const rawUrl = apkAsset?.downloadUrl || apkAsset?.browserDownloadUrl || `${APK_DOWNLOAD_ENDPOINT}?source=app_update`;
    // Ensure updater source query parameter is attached if routing through backend proxy
    const downloadSourceUrl = rawUrl.includes('/api/download') && !rawUrl.includes('source=')
      ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}source=app_update`
      : rawUrl;

    const fileName = apkAsset?.name || `movieflix-v${Date.now()}.apk`;
    const targetDir = `${FileSystem.documentDirectory}updates/`;

    // Ensure update directory exists
    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    const localFileUri = `${targetDir}${fileName}`;

    // Delete any prior partial download
    const fileInfo = await FileSystem.getInfoAsync(localFileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localFileUri, { idempotent: true });
    }

    // Initialize resumable download from backend proxy with progress callback
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadSourceUrl,
      localFileUri,
      {
        headers: {
          'User-Agent': `Movieflix-App/${CURRENT_APP_VERSION}`,
          'X-App-Updater': 'true',
          Accept: 'application/vnd.android.package-archive, application/octet-stream, */*',
        },
      },
      (downloadProgress) => {
        const total = downloadProgress.totalBytesExpectedToWrite;
        const written = downloadProgress.totalBytesWritten;
        const percent = total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
        if (typeof onProgress === 'function') {
          onProgress({
            percent,
            written,
            total,
            writtenFormatted: formatBytes(written),
            totalFormatted: formatBytes(total),
          });
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error('Download failed to return local file URI.');
    }

    // Validate downloaded file integrity before invoking Android package installer
    const downloadedInfo = await FileSystem.getInfoAsync(result.uri);
    if (!downloadedInfo.exists || downloadedInfo.size < 5 * 1024 * 1024) {
      // Official APKs are ~95-110MB; anything under 5MB is a corrupted download or HTML redirect page
      const badSize = downloadedInfo.size || 0;
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error(
        `Downloaded package is invalid or incomplete (${formatBytes(badSize)}). Please check connection and try again.`
      );
    }

    console.log('Valid APK Download completed to:', result.uri, 'size:', formatBytes(downloadedInfo.size));

    // Launch Android package installer
    if (Platform.OS === 'android') {
      try {
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
        return { success: true, uri: result.uri, installed: true };
      } catch (launcherErr) {
        console.warn('Intent launcher error:', launcherErr);
        // Fallback: try opening with Linking
        try {
          const contentUri = await FileSystem.getContentUriAsync(result.uri);
          await Linking.openURL(contentUri);
          return { success: true, uri: result.uri, installed: true };
        } catch (e2) {
          await Linking.openURL(downloadSourceUrl);
          return { success: true, uri: result.uri, fallbackWeb: true };
        }
      }
    } else {
      // Non-android / web preview: open release download
      await Linking.openURL(downloadSourceUrl);
      return { success: true, uri: result.uri };
    }
  } catch (err) {
    console.error('Download and install APK error:', err);
    throw err;
  }
}
