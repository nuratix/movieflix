import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { saveDownload, updateDownloadProgress, removeDownload } from './storageService';
import {
  notifyDownloadStarted,
  notifyDownloadCompleted,
  notifyDownloadFailed,
  notifyDownloadProgress,
  cancelDownloadNotification,
} from './notificationService';

// Active in-flight download resumables
const activeDownloads = new Map();

/**
 * Ensures the downloads directory exists on user's device
 */
export async function getDownloadsDir() {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return null;
  }
  const dir = `${FileSystem.documentDirectory}downloads/`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch (e) {
    console.warn('Could not initialize downloads directory:', e);
    return null;
  }
}

/**
 * Format bytes to readable size (MB / GB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Start a video download with subtitle support and progress tracking
 */
export async function startDownload({
  movie,
  isSeries = false,
  se = 0,
  ep = 0,
  videoUrl,
  subtitleUrl = null,
  resolution = '720p',
  language = 'Original Audio',
  subtitleLang = 'None',
  onProgress = null,
  onStatusChange = null,
}) {
  if (Platform.OS === 'web') {
    throw new Error('Offline downloads are not supported on web browser.');
  }

  if (!videoUrl || !movie) {
    throw new Error('Invalid download request: missing video url or movie metadata.');
  }

  const downloadsDir = await getDownloadsDir();
  const id = `${movie.slug || movie.subject_id || 'title'}_s${se}_e${ep}_${resolution}`;

  // Clean filename for device filesystem
  const safeTitle = (movie.name || 'video').replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 40);
  const videoFileName = `${safeTitle}_S${se}E${ep}_${resolution}_${Date.now()}.mp4`;
  const localVideoUri = downloadsDir ? `${downloadsDir}${videoFileName}` : null;

  let localSubtitleUri = null;

  // Initialize download record
  const downloadRecord = {
    id,
    movie: {
      name: movie.name || 'Untitled',
      slug: movie.slug || '',
      subject_id: movie.subject_id || '',
      poster_url: movie.poster_url || '',
    },
    isSeries: Boolean(isSeries),
    se: Number(se) || 0,
    ep: Number(ep) || 0,
    resolution,
    language,
    subtitleLang,
    status: 'downloading', // 'downloading' | 'completed' | 'error' | 'paused'
    progress: 0,
    sizeBytes: 0,
    localVideoUri,
    localSubtitleUri,
    createdAt: new Date().toISOString(),
  };

  await saveDownload(downloadRecord);
  if (onStatusChange) onStatusChange('downloading', 0);
  // Post single progress notification initially
  notifyDownloadProgress(id, movie.name || 'Title', 0, 0, 0);

  // If subtitle URL provided, download subtitle file in background
  if (subtitleUrl && downloadsDir) {
    const subFileName = `${safeTitle}_S${se}E${ep}_${subtitleLang.replace(/[^a-zA-Z0-9]/g, '')}.srt`;
    const subDest = `${downloadsDir}${subFileName}`;
    FileSystem.downloadAsync(subtitleUrl, subDest)
      .then((res) => {
        if (res && res.uri) {
          localSubtitleUri = res.uri;
          downloadRecord.localSubtitleUri = res.uri;
          saveDownload(downloadRecord);
        }
      })
      .catch((e) => console.log('Subtitle download note:', e));
  }

  if (!localVideoUri) {
    // Platform limitation fallback
    downloadRecord.status = 'error';
    await saveDownload(downloadRecord);
    if (onStatusChange) onStatusChange('error', 0);
    return { id, success: false };
  }

  let lastSaveTime = 0;
  let lastNotifPercent = -1;

  const callback = (downloadProgress) => {
    const written = downloadProgress.totalBytesWritten;
    const expected = downloadProgress.totalBytesExpectedToWrite;
    const progress = expected > 0 ? written / expected : 0;
    const percent = Math.min(100, Math.round(progress * 100));

    if (onProgress) {
      onProgress(progress, percent, written, expected);
    }

    const now = Date.now();
    // Update local database progress for in-app UI smoothly
    if (now - lastSaveTime > 3000 || percent === 100) {
      lastSaveTime = now;
      updateDownloadProgress(id, percent, 'downloading', localVideoUri, written);
    }

    // Only update OS notification on milestones (25%, 50%, 75%, 100%)
    // This sends ONLY ONE single persistent notification without rapid continuous spamming!
    const isMilestone = percent === 25 || percent === 50 || percent === 75 || percent === 100;
    if (isMilestone && percent !== lastNotifPercent) {
      lastNotifPercent = percent;
      notifyDownloadProgress(id, movie.name || 'Title', percent, written, expected);
    }
  };

  // Anti-hotlinking headers matching the streaming server
  const downloadHeaders = {
    'Referer': 'https://netfilm.world/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  };

  try {
    const downloadOptions = {
      headers: downloadHeaders,
      ...(Platform.OS === 'ios' && FileSystem.FileSystemSessionType?.BACKGROUND !== undefined
        ? { sessionType: FileSystem.FileSystemSessionType.BACKGROUND }
        : {}),
    };

    const downloadResumable = FileSystem.createDownloadResumable(
      videoUrl,
      localVideoUri,
      downloadOptions,
      callback
    );

    activeDownloads.set(id, downloadResumable);

    downloadResumable.downloadAsync()
      .then(async (result) => {
        activeDownloads.delete(id);
        if (result && result.uri) {
          const fileInfo = await FileSystem.getInfoAsync(result.uri);
          const finalSize = fileInfo?.size || 0;
          await updateDownloadProgress(id, 100, 'completed', result.uri, finalSize);
          if (onStatusChange) onStatusChange('completed', 100);
          notifyDownloadCompleted(id, movie.name || 'Title', formatBytes(finalSize));
        } else {
          await updateDownloadProgress(id, 0, 'error');
          if (onStatusChange) onStatusChange('error', 0);
          notifyDownloadFailed(id, movie.name || 'Title');
        }
      })
      .catch(async (err) => {
        activeDownloads.delete(id);
        console.warn('Download error:', err);
        await updateDownloadProgress(id, 0, 'error');
        if (onStatusChange) onStatusChange('error', 0);
        notifyDownloadFailed(id, movie.name || 'Title');
      });

    return {
      id,
      cancel: async () => {
        try {
          await downloadResumable.cancelAsync();
          activeDownloads.delete(id);
          cancelDownloadNotification(id);
          await updateDownloadProgress(id, 0, 'canceled');
          if (onStatusChange) onStatusChange('canceled', 0);
        } catch (e) {}
      },
    };
  } catch (err) {
    console.warn('Failed to initiate download task:', err);
    await updateDownloadProgress(id, 0, 'error');
    if (onStatusChange) onStatusChange('error', 0);
    throw err;
  }
}

/**
 * Cancel an active download
 */
export async function cancelDownload(id) {
  const task = activeDownloads.get(id);
  if (task) {
    try {
      await task.cancelAsync();
      activeDownloads.delete(id);
      cancelDownloadNotification(id);
    } catch (e) {}
  }
  await updateDownloadProgress(id, 0, 'canceled');
}

/**
 * Permanently delete a downloaded movie/episode from device storage
 */
export async function deleteDownloadedItem(item) {
  if (!item) return;

  // Remove video file
  if (item.localVideoUri) {
    try {
      await FileSystem.deleteAsync(item.localVideoUri, { idempotent: true });
    } catch (e) {
      console.log('Video file deletion note:', e);
    }
  }

  // Remove subtitle file
  if (item.localSubtitleUri) {
    try {
      await FileSystem.deleteAsync(item.localSubtitleUri, { idempotent: true });
    } catch (e) {
      console.log('Subtitle file deletion note:', e);
    }
  }

  // Remove from registry
  await removeDownload(item.id);
}
