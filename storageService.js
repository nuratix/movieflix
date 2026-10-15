import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEYS = {
  WATCH_HISTORY: '@reel_watch_history_v2',
  MY_LIST: '@reel_my_list_v2',
  DOWNLOADS: '@reel_downloads_v2',
  HOME_CACHE: '@reel_home_cache_v2',
  DEVICE_KEY: 'reel_device_secret_token_v2',
  SESSION: '@mf_session',
};

// Safe fallback in-memory store
const memoryStore = {
  watchHistory: [],
  myList: [],
  downloads: [],
};

function getApiBase() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return (process.env.EXPO_PUBLIC_API_BASE || 'https://mws.wallpaperdomain.xyz').trim().replace(/\/+$/, '');
}

async function getAuthToken() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.accessToken || null;
  } catch (_) {
    return null;
  }
}

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
    return { success: true, deviceKey: 'software_key_default', secure: false };
  }
}

/**
 * WATCH HISTORY (Cloud Sync with AWS Server + Local Fast Cache)
 */
export async function getWatchHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATCH_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryStore.watchHistory = Array.isArray(parsed) ? parsed : [];
    }

    // If authenticated, sync securely with AWS server in background
    const token = await getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${getApiBase()}/api/auth?action=get-history`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.history)) {
            memoryStore.watchHistory = data.history;
            await AsyncStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(data.history));
            return data.history;
          }
        }
      } catch (syncErr) {
        // Fallback to local cache if network is slow/offline
      }
    }

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
    const history = memoryStore.watchHistory || [];
    const id = `${movie.slug || movie.subject_id}_s${se}_e${ep}`;
    const progressPercent = durationMillis > 0
      ? Math.min(100, Math.max(1, Math.round((positionMillis / durationMillis) * 100)))
      : 0;

    const entry = {
      id,
      historyId: id,
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
    const updated = [entry, ...history.filter(item => item.id !== id && item.historyId !== id)].slice(0, 50);
    memoryStore.watchHistory = updated;
    await AsyncStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(updated));

    // Asynchronously sync watch progress to AWS DynamoDB on server
    const token = await getAuthToken();
    if (token) {
      fetch(`${getApiBase()}/api/auth?action=save-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movie,
          isSeries,
          se,
          ep,
          positionMillis,
          durationMillis,
        }),
      }).catch(() => {});
    }

    return entry;
  } catch (e) {
    console.warn('Failed to save watch progress:', e);
    return null;
  }
}

export async function removeWatchHistory(id) {
  try {
    const history = memoryStore.watchHistory || [];
    const updated = history.filter(item => item.id !== id && item.historyId !== id);
    memoryStore.watchHistory = updated;
    await AsyncStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(updated));

    const token = await getAuthToken();
    if (token) {
      fetch(`${getApiBase()}/api/auth?action=remove-history`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, historyId: id }),
      }).catch(() => {});
    }

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

    const token = await getAuthToken();
    if (token) {
      fetch(`${getApiBase()}/api/auth?action=clear-history`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(() => {});
    }

    return [];
  } catch (e) {
    console.warn('Failed to clear watch history:', e);
    return [];
  }
}

/**
 * MY LIST / WATCHLIST (Cloud Sync with AWS Server + Local Fast Cache)
 */
export async function getMyList() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MY_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryStore.myList = Array.isArray(parsed) ? parsed : [];
    }

    // If authenticated, sync securely with AWS server in background
    const token = await getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${getApiBase()}/api/auth?action=get-watchlist`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.watchlist)) {
            memoryStore.myList = data.watchlist;
            await AsyncStorage.setItem(KEYS.MY_LIST, JSON.stringify(data.watchlist));
            return data.watchlist;
          }
        }
      } catch (syncErr) {
        // Fallback to local cache
      }
    }

    return memoryStore.myList;
  } catch (e) {
    console.warn('Failed to load my list:', e);
    return memoryStore.myList;
  }
}

export async function toggleMyList(movie) {
  if (!movie) return { myList: memoryStore.myList, isAdded: false };

  try {
    const currentList = memoryStore.myList || [];
    const exists = currentList.some(
      m => (m.slug && m.slug === movie.slug) || (m.subject_id && m.subject_id === movie.subject_id) || (m.movieId && (m.movieId === movie.slug || m.movieId === movie.subject_id))
    );

    let updatedList;
    let isAdded = false;

    if (exists) {
      updatedList = currentList.filter(
        m => !((m.slug && m.slug === movie.slug) || (m.subject_id && m.subject_id === movie.subject_id) || (m.movieId && (m.movieId === movie.slug || m.movieId === movie.subject_id)))
      );
    } else {
      const cleanMovie = {
        movieId: movie.slug || movie.subject_id || '',
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

    // Asynchronously sync to AWS DynamoDB
    const token = await getAuthToken();
    if (token) {
      fetch(`${getApiBase()}/api/auth?action=toggle-watchlist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ movie }),
      }).catch(() => {});
    }

    return { myList: updatedList, isAdded };
  } catch (e) {
    console.warn('Failed to toggle my list:', e);
    return { myList: memoryStore.myList, isAdded: false };
  }
}

export async function isInMyList(slugOrId) {
  if (!slugOrId) return false;
  const list = memoryStore.myList || [];
  return list.some(m => m.slug === slugOrId || m.subject_id === slugOrId || m.movieId === slugOrId);
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
    return memoryStore.downloads;
  }
}

export async function saveDownload(downloadItem) {
  if (!downloadItem || !downloadItem.id) return null;
  try {
    const current = await getDownloads();
    const updated = [downloadItem, ...current.filter(d => d.id !== downloadItem.id)];
    memoryStore.downloads = updated;
    await AsyncStorage.setItem(KEYS.DOWNLOADS, JSON.stringify(updated));
    return downloadItem;
  } catch (e) {
    return null;
  }
}

export async function removeDownload(id) {
  try {
    const current = await getDownloads();
    const updated = current.filter(d => d.id !== id);
    memoryStore.downloads = updated;
    await AsyncStorage.setItem(KEYS.DOWNLOADS, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return memoryStore.downloads;
  }
}
