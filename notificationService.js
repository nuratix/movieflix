import { Platform } from 'react-native';

let Notifications = null;

try {
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
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
  return Boolean(Notifications?.scheduleNotificationAsync);
}

/**
 * Explicitly request notification permissions from the OS
 */
export async function requestNotificationPermission() {
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

async function setupAndroidChannels() {
  if (!Notifications?.setNotificationChannelAsync) return;
  try {
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
 */
export async function notifyDownloadStarted(movieName, resolution = '720p', language = 'Original') {
  if (!Notifications?.scheduleNotificationAsync) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Downloading ${movieName}`,
        body: `Quality: ${resolution} · ${language}. Download in progress.`,
        sound: 'default',
        channelId: 'downloads',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Download start notification error:', e);
  }
}

/**
 * Trigger notification when download completes successfully
 */
export async function notifyDownloadCompleted(movieName, sizeFormatted = '') {
  if (!Notifications?.scheduleNotificationAsync) return;
  try {
    const sizeText = sizeFormatted ? ` (${sizeFormatted})` : '';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Download Complete 🎬',
        body: `${movieName}${sizeText} is downloaded and ready to watch offline anytime!`,
        sound: 'default',
        channelId: 'downloads',
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
export async function notifyDownloadFailed(movieName) {
  if (!Notifications?.scheduleNotificationAsync) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Download Failed ❌',
        body: `Could not finish downloading ${movieName}. Tap to retry when connected.`,
        sound: 'default',
        channelId: 'downloads',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Download fail notification error:', e);
  }
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
