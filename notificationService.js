import { Platform } from 'react-native';

let Notifications = null;

try {
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const channelId = notification?.request?.content?.channelId;
        const identifier = notification?.request?.identifier || '';
        const isProgress = channelId === 'download-progress' || identifier.startsWith('dl_');
        return {
          shouldShowAlert: !isProgress,
          shouldPlaySound: !isProgress,
          shouldSetBadge: false,
        };
      },
    });
  }
} catch (err) {
  console.warn('[notificationService] expo-notifications initialization note:', err);
}

let breakNotificationId = null;

/**
 * Check if notifications are supported on this runtime environment
 */
export function isNotificationSupported() {
  if (Platform.OS === 'web') return false;
  return Boolean(Notifications?.scheduleNotificationAsync);
}

/**
 * Explicitly request notification permissions from the OS
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  if (!Notifications?.requestPermissionsAsync) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted' && Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await setupAndroidChannels();
    }
    return status === 'granted';
  } catch (err) {
    console.warn('Permission request error:', err);
    return false;
  }
}

/**
 * Check current notification permission status without prompting
 */
export async function checkNotificationPermissionStatus() {
  if (Platform.OS === 'web') return 'denied';
  if (!Notifications?.getPermissionsAsync) return 'undetermined';
  try {
    const res = await Notifications.getPermissionsAsync();
    return res.status;
  } catch (e) {
    return 'undetermined';
  }
}

/**
 * Initialize notification channels if permissions are already granted
 */
export async function initNotifications() {
  if (Platform.OS === 'web') return false;
  if (!Notifications?.getPermissionsAsync) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted' && Platform.OS === 'android') {
      await setupAndroidChannels();
    }
    return status === 'granted';
  } catch (err) {
    console.warn('Notifications init error:', err);
    return false;
  }
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderProgressBar(percent, length = 12) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const filled = Math.round((clamped / 100) * length);
  const unfilled = Math.max(0, length - filled);
  return '█'.repeat(filled) + '░'.repeat(unfilled);
}

async function setupAndroidChannels() {
  if (!Notifications?.setNotificationChannelAsync) return;
  try {
    // Ongoing download progress channel (low importance so it does not beep or vibrate on each progress update)
    await Notifications.setNotificationChannelAsync('download-progress', {
      name: 'Download Progress',
      importance: Notifications.AndroidImportance?.LOW ?? 2,
      vibrationPattern: null,
      enableVibrate: false,
      sound: null,
      showBadge: false,
    });

    // Completed or failed downloads channel (high importance with chime and vibration)
    await Notifications.setNotificationChannelAsync('downloads', {
      name: 'Downloads',
      importance: Notifications.AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e50914',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('wellness', {
      name: 'Watch Break Reminders',
      importance: Notifications.AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#e50914',
      sound: 'default',
    });
  } catch (e) {
    console.warn('Setup channels note:', e);
  }
}

/**
 * Trigger immediate notification when download starts
 * (Silent no-op to ensure ONLY ONE notification is posted for the download, without any annoying chime sound)
 */
export async function notifyDownloadStarted(movieName, resolution = '720p', language = 'Original') {
  // Intentionally silent no-op: prevents duplicate notifications and continuous chime sounds.
  // The single download progress notification is updated seamlessly in-place instead.
}

/**
 * Update real-time download notification with dynamic loading progress bar
 */
export async function notifyDownloadProgress(downloadId, movieName, percent, writtenBytes = 0, totalBytes = 0) {
  if (!Notifications?.scheduleNotificationAsync) return;
  try {
    const notifId = `dl_${String(downloadId || 'task').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const bar = renderProgressBar(percent, 12);
    const writtenStr = formatBytes(writtenBytes);
    const totalStr = totalBytes > 0 ? formatBytes(totalBytes) : '...';

    await Notifications.scheduleNotificationAsync({
      identifier: notifId,
      content: {
        title: `Downloading ${movieName || 'Movie'}`,
        body: `${bar} ${percent}%\n${writtenStr} / ${totalStr}`,
        channelId: 'download-progress',
        priority: Notifications.AndroidNotificationPriority?.LOW ?? 'low',
        sound: null,
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });
  } catch (e) {
    // Non-fatal notification error
  }
}

/**
 * Trigger notification when download completes successfully
 */
export async function notifyDownloadCompleted(downloadId, movieName, sizeFormatted = '') {
  if (!Notifications?.scheduleNotificationAsync) return;
  try {
    if (downloadId && Notifications.dismissNotificationAsync) {
      const notifId = `dl_${String(downloadId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await Notifications.dismissNotificationAsync(notifId).catch(() => {});
    }
    const sizeText = sizeFormatted ? ` (${sizeFormatted})` : '';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Download Complete 🎬',
        body: `${movieName}${sizeText} is downloaded and ready to watch offline anytime!`,
        sound: 'default',
        channelId: 'downloads',
        priority: Notifications.AndroidNotificationPriority?.HIGH ?? 'high',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Download complete notification error:', e);
  }
}

/**
 * Trigger notification when a download fails
 */
export async function notifyDownloadFailed(downloadId, movieName) {
  if (!Notifications?.scheduleNotificationAsync) return;
  try {
    if (downloadId && Notifications.dismissNotificationAsync) {
      const notifId = `dl_${String(downloadId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await Notifications.dismissNotificationAsync(notifId).catch(() => {});
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Download Failed ❌',
        body: `Could not finish downloading ${movieName}. Tap to retry when connected.`,
        sound: 'default',
        channelId: 'downloads',
        priority: Notifications.AndroidNotificationPriority?.HIGH ?? 'high',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Download fail notification error:', e);
  }
}

/**
 * Cancel and dismiss any in-flight download notification
 */
export async function cancelDownloadNotification(downloadId) {
  if (!downloadId || !Notifications?.dismissNotificationAsync) return;
  try {
    const notifId = `dl_${String(downloadId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await Notifications.dismissNotificationAsync(notifId).catch(() => {});
  } catch (e) {}
}

/**
 * Schedule a 2-hour watch break reminder (repeats every 2 hours while watching)
 */
export async function scheduleBreakReminder() {
  if (!Notifications?.scheduleNotificationAsync) return null;
  try {
    await cancelBreakReminder();
    breakNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for a break! 🍿',
        body: "You've been watching Movieflix for 2 hours. Take a stretch and give your eyes a quick rest!",
        sound: 'default',
        channelId: 'wellness',
      },
      trigger: {
        seconds: 7200, // 2 hours
        repeats: true,
      },
    });
    return breakNotificationId;
  } catch (e) {
    console.warn('Schedule break reminder error:', e);
    return null;
  }
}

/**
 * Trigger immediate break notification (used by in-player elapsed timer)
 */
export async function notifyBreakTimeNow() {
  if (!Notifications?.scheduleNotificationAsync) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for a break! 🍿',
        body: "You've been watching for 2 hours! Take a quick stretch, drink water, and rest your eyes.",
        sound: 'default',
        channelId: 'wellness',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Immediate break notification error:', e);
  }
}

/**
 * Cancel the active 2-hour break reminder when player closes
 */
export async function cancelBreakReminder() {
  if (breakNotificationId && Notifications?.cancelScheduledNotificationAsync) {
    try {
      await Notifications.cancelScheduledNotificationAsync(breakNotificationId);
    } catch (e) {
      console.warn('Cancel break reminder error:', e);
    }
    breakNotificationId = null;
  }
}
