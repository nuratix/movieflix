import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Current App Version (aligned with package.json & app.json)
export const CURRENT_APP_VERSION = '1.1.3';

// GitHub Repository Configuration
export const GITHUB_OWNER = 'nuratix';
export const GITHUB_REPO = 'movieflix';
export const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// Authenticated token for accessing private GitHub repository releases
const GITHUB_TOKEN = process.env.EXPO_PUBLIC_GITHUB_TOKEN || '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';

/**
 * Clean & compare semantic versions (e.g., "v1.0.1" vs "1.0.0")
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
 * Format bytes to human readable string (e.g. 15.4 MB)
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
 * Check GitHub repository for the latest release
 */
export async function checkForUpdateAsync() {
  try {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Movieflix-App',
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `token ${GITHUB_TOKEN}`;
    }

    const response = await fetch(GITHUB_API_URL, { headers });
    if (!response.ok) {
      console.log('GitHub releases fetch status:', response.status);
      return {
        hasUpdate: false,
        currentVersion: CURRENT_APP_VERSION,
        error: `GitHub check returned status ${response.status}`,
      };
    }

    const releases = await response.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: CURRENT_APP_VERSION,
        releasesCount: 0,
      };
    }

    // Filter out draft releases and get the latest published release
    const validReleases = releases.filter((r) => !r.draft);
    if (validReleases.length === 0) {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: CURRENT_APP_VERSION,
      };
    }

    const latest = validReleases[0];
    const remoteTag = latest.tag_name || latest.name || '';
    const cleanTag = remoteTag.replace(/^v/i, '');
    const hasUpdate = isNewerVersion(remoteTag, CURRENT_APP_VERSION);

    // Look for an APK asset in the release
    let apkAsset = null;
    if (Array.isArray(latest.assets)) {
      const found = latest.assets.find(
        (a) =>
          (a.name && a.name.toLowerCase().endsWith('.apk')) ||
          a.content_type === 'application/vnd.android.package-archive'
      );
      if (found) {
        apkAsset = {
          id: found.id,
          name: found.name,
          size: found.size,
          sizeFormatted: formatBytes(found.size),
          downloadUrl: found.browser_download_url,
          apiUrl: found.url,
        };
      }
    }

    const updateInfo = {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: cleanTag,
      latestTag: remoteTag,
      releaseTitle: latest.name || `Version ${remoteTag}`,
      releaseNotes: latest.body || 'Performance improvements and bug fixes.',
      publishedAt: latest.published_at,
      releaseUrl: latest.html_url,
      apkAsset,
    };

    // Cache latest check result
    try {
      await AsyncStorage.setItem(
        '@movieflix_last_update_check',
        JSON.stringify({ ...updateInfo, checkedAt: Date.now() })
      );
    } catch (e) {}

    return updateInfo;
  } catch (err) {
    console.warn('Update check failed:', err);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      error: err.message,
    };
  }
}

/**
 * Download APK file with progress and trigger Android package installation
 */
export async function downloadAndInstallApkAsync(apkAsset, onProgress) {
  try {
    if (!apkAsset) {
      throw new Error('No APK asset specified for download.');
    }

    const fileName = apkAsset.name || `movieflix-v${Date.now()}.apk`;
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

    // Determine download URL:
    // For private repo releases, GitHub API asset endpoint redirects to direct signed S3 URL
    let downloadSourceUrl = apkAsset.downloadUrl;
    const downloadHeaders = {};

    if (apkAsset.apiUrl && GITHUB_TOKEN) {
      // Use asset API endpoint with octet-stream accept header to get direct S3 redirect
      try {
        const headRes = await fetch(apkAsset.apiUrl, {
          method: 'GET',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/octet-stream',
            'User-Agent': 'Movieflix-App',
          },
          redirect: 'follow',
        });
        if (headRes.ok && headRes.url) {
          downloadSourceUrl = headRes.url;
        }
      } catch (redirectErr) {
        console.log('Redirect resolution fallback:', redirectErr);
        downloadHeaders['Authorization'] = `token ${GITHUB_TOKEN}`;
        downloadHeaders['Accept'] = 'application/octet-stream';
      }
    }

    // Initialize download with progress callback
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadSourceUrl,
      localFileUri,
      { headers: downloadHeaders },
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

    console.log('APK Download completed to:', result.uri);

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
          if (apkAsset.downloadUrl) {
            await Linking.openURL(apkAsset.downloadUrl);
          }
          return { success: true, uri: result.uri, fallbackWeb: true };
        }
      }
    } else {
      // Non-android: open release page
      if (apkAsset.downloadUrl) {
        await Linking.openURL(apkAsset.downloadUrl);
      }
      return { success: true, uri: result.uri };
    }
  } catch (err) {
    console.error('Download and install APK error:', err);
    throw err;
  }
}
