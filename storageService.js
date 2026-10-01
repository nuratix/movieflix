import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  WATCH_HISTORY: '@reel_watch_history_v2',
  MY_LIST: '@reel_my_list_v2',
  DOWNLOADS: '@reel_downloads_v2',
  HOME_CACHE: '@reel_home_cache_v2',
  DEVICE_KEY: 'reel_device_secret_token_v2',
};

// Safe fallback in-memory store
const memoryStore = {
  watchHistory: [],
  myList: [],
  downloads: [],
};

/**
 * Initialize device secure storage key
 */
export async function initSecureStorage() {
  try {
    let deviceKey = await SecureStore.getItemAsync(KEYS.DEVICE_KEY);
    if (!deviceKey) {
      deviceKey = 'reel_dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      await SecureStore.setItemAsync(KEYS.DEVICE_KEY, deviceKey);
    }
    return { success: true, deviceKey, secure: true };
  } catch (e) {
    console.log('SecureStore notice (fallback to software security):', e?.message);
    return { success: true, deviceKey: 'software_key_default', secure: false };
  }
}

/**
 * WATCH HISTORY
 */
export async function getWatchHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATCH_HISTORY);
    if (!raw) return memoryStore.watchHistory;
    const parsed = JSON.parse(raw);
    memoryStore.watchHistory = Array.isArray(parsed) ? parsed : [];
    return memoryStore.watchHistory;
  } catch (e) {
    console.warn('Failed to load watch history:', e);
    return memoryStore.watchHistory;
  }
}

export async function saveWatchProgress({
  movie,
  isSeries = false,
  se = 0,
  ep = 0,
  positionMillis = 0,
  durationMillis = 0,
}) {
  if (!movie || (!movie.slug && !movie.subject_id)) return null;

  try {
    const history = await getWatchHistory();
    const id = `${movie.slug || movie.subject_id}_s${se}_e${ep}`;
    const progressPercent = durationMillis > 0
      ? Math.min(100, Math.max(1, Math.round((positionMillis / durationMillis) * 100)))
      : 0;

    const entry = {
      id,
      movie: {
        name: movie.name || 'Untitled Title',
        slug: movie.slug || '',
        subject_id: movie.subject_id || '',
        poster_url: movie.poster_url || '',
      },
      isSeries: Boolean(isSeries),
      se: Number(se) || 0,
      ep: Number(ep) || 0,
      positionMillis: Math.round(positionMillis),
      durationMillis: Math.round(durationMillis),
      progressPercent,
      updatedAt: new Date().toISOString(),
    };

    // Filter out existing and put newest at top
    const updated = [entry, ...history.filter(item => item.id !== id)].slice(0, 50);
    memoryStore.watchHistory = updated;
    await AsyncStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(updated));
    return entry;
  } catch (e) {
    console.warn('Failed to save watch progress:', e);
    return null;
  }
}

export async function removeWatchHistory(id) {
  try {
    const history = await getWatchHistory();
    const updated = history.filter(item => item.id !== id);
    memoryStore.watchHistory = updated;
    await AsyncStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to remove watch history item:', e);
    return memoryStore.watchHistory;
  }
}

export async function clearWatchHistory() {
  try {
    memoryStore.watchHistory = [];
    await AsyncStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify([]));
    return [];
  } catch (e) {
    console.warn('Failed to clear watch history:', e);
    return [];
  }
}

/**
 * MY LIST / WATCHLIST
 */
export async function getMyList() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MY_LIST);
    if (!raw) return memoryStore.myList;
    const parsed = JSON.parse(raw);
    memoryStore.myList = Array.isArray(parsed) ? parsed : [];
    return memoryStore.myList;
  } catch (e) {
    console.warn('Failed to load my list:', e);
    return memoryStore.myList;
  }
}

export async function toggleMyList(movie) {
  if (!movie) return { myList: memoryStore.myList, isAdded: false };

  try {
    const currentList = await getMyList();
    const exists = currentList.some(
      m => (m.slug && m.slug === movie.slug) || (m.subject_id && m.subject_id === movie.subject_id)
    );

    let updatedList;
    let isAdded = false;

    if (exists) {
      updatedList = currentList.filter(
        m => !((m.slug && m.slug === movie.slug) || (m.subject_id && m.subject_id === movie.subject_id))
      );
    } else {
      const cleanMovie = {
        name: movie.name || '',
        slug: movie.slug || '',
        subject_id: movie.subject_id || '',
        poster_url: movie.poster_url || '',
        badge: movie.badge || null,
        rating: movie.rating || null,
        year: movie.year || null,
        isSeries: Boolean(movie.isSeries),
        addedAt: new Date().toISOString(),
      };
      updatedList = [cleanMovie, ...currentList];
      isAdded = true;
    }

    memoryStore.myList = updatedList;
    await AsyncStorage.setItem(KEYS.MY_LIST, JSON.stringify(updatedList));
    return { myList: updatedList, isAdded };
  } catch (e) {
    console.warn('Failed to toggle my list:', e);
    return { myList: memoryStore.myList, isAdded: false };
  }
}

export async function isInMyList(slugOrId) {
  if (!slugOrId) return false;
  const list = await getMyList();
  return list.some(m => m.slug === slugOrId || m.subject_id === slugOrId);
}

/**
 * DOWNLOADS REGISTRY
 */
export async function getDownloads() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DOWNLOADS);
    if (!raw) return memoryStore.downloads;
    const parsed = JSON.parse(raw);
    memoryStore.downloads = Array.isArray(parsed) ? parsed : [];
    return memoryStore.downloads;
  } catch (e) {
    console.warn('Failed to load downloads:', e);
    return memoryStore.downloads;
  }
}

export async function saveDownload(downloadItem) {
  if (!downloadItem || !downloadItem.id) return null;
  try {
    const downloads = await getDownloads();
    const filtered = downloads.filter(d => d.id !== downloadItem.id);
    const updated = [downloadItem, ...filtered];
    memoryStore.downloads = updated;
    await AsyncStorage.setItem(KEYS.DOWNLOADS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save download record:', e);
    return null;
  }
}

export async function updateDownloadProgress(id, progress, status, localVideoUri = null, totalBytes = null) {
  try {
    const downloads = await getDownloads();
    const idx = downloads.findIndex(d => d.id === id);
    if (idx === -1) return null;

    const current = downloads[idx];
    current.progress = progress;
    if (status) current.status = status;
    if (localVideoUri) current.localVideoUri = localVideoUri;
    if (totalBytes) current.sizeBytes = totalBytes;

    downloads[idx] = current;
    memoryStore.downloads = downloads;
    await AsyncStorage.setItem(KEYS.DOWNLOADS, JSON.stringify(downloads));
    return current;
  } catch (e) {
    console.warn('Failed to update download progress:', e);
    return null;
  }
}

export async function removeDownload(id) {
  try {
    const downloads = await getDownloads();
    const updated = downloads.filter(d => d.id !== id);
    memoryStore.downloads = updated;
    await AsyncStorage.setItem(KEYS.DOWNLOADS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to remove download:', e);
    return memoryStore.downloads;
  }
}

/**
 * HOME FEED LOCAL CACHE FOR INSTANT LOADING
 */
export async function getHomeFeedCache() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HOME_CACHE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load home cache:', e);
    return null;
  }
}

export async function saveHomeFeedCache(data) {
  if (!data) return;
  try {
    await AsyncStorage.setItem(KEYS.HOME_CACHE, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save home cache:', e);
  }
}
