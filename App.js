import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  BackHandler,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Animated,
  Easing,
  PanResponder,
  Linking,
  RefreshControl,
  FlatList,
  Share,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import * as Brightness from 'expo-brightness';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initNotifications,
  requestNotificationPermission,
  checkNotificationPermissionStatus,
  scheduleBreakReminder,
  cancelBreakReminder,
  notifyBreakTimeNow,
} from './notificationService';
import {
  initSecureStorage,
  getWatchHistory,
  saveWatchProgress,
  removeWatchHistory,
  clearWatchHistory,
  getMyList,
  toggleMyList as toggleMyListStorage,
  getDownloads,
  removeDownload,
  getHomeFeedCache,
  saveHomeFeedCache,
} from './storageService';
import {
  startDownload,
  cancelDownload,
  deleteDownloadedItem,
  formatBytes,
} from './downloadService';
import {
  CURRENT_APP_VERSION,
  checkForUpdateAsync,
  downloadAndInstallApkAsync,
} from './updateService';
import {
  verifyAppSecurityAsync,
  OFFICIAL_DOWNLOAD_ORIGIN,
} from './securityService';
import {
  TRENDING_NOW,
  LATEST_RELEASES,
  NETFLIX_POPULAR,
  HINDI_MOVIES,
  ANIME_TRENDING,
  ANIME_LATEST,
  WEBSERIES_LATEST,
  CARTOONS,
} from './homeCatalog';
import { LOCAL_POSTERS } from './assets/posters';
import { getImdbData } from './imdbService';
import { getContentBasedRecommendations, getPersonalizedRecommendations } from './recommendationService';
import { rankShotsFeed, buildUserInterestVector } from './shotsAlgorithmService';
import WelcomeScreen from './WelcomeScreen';
import AuthScreen from './AuthScreen';
import CustomSplashScreen from './CustomSplashScreen';
import PrivacyScreen, { PRIVACY_POLICY_URL } from './PrivacyScreen';
import DownloadScreen from './DownloadScreen';
import NotFoundScreen from './NotFoundScreen';
import * as SplashScreen from 'expo-splash-screen';

// Prevent native splash screen from hiding before custom splash animation mounts
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

// ─── Apple-Grade Haptics Feedback Helper ─────────────────────────────────────
const triggerHaptic = (type = 'selection') => {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else if (type === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else if (type === 'heavy') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
  } catch (e) {}
};

// ─── Backend API Base (Public Movieflix Server Proxy) ────────────────────────
// On web: relative '' (same-origin, zero CORS issues, instant)
// On native/APK: official backend server (https://movieflix-pi-six.vercel.app)
const API_BASE =
  Platform.OS === 'web'
    ? ''
    : (process.env.EXPO_PUBLIC_API_BASE || 'https://movieflix-pi-six.vercel.app').trim().replace(/\/+$/, '');

// Auth API endpoint (connected to Neon Database on movieflix)
const AUTH_API_URL = `${API_BASE}/api/auth`;

// Module-level auth token — updated by App component via useEffect
let _authToken = null;

/** Content API fetch helper (queries Movieflix backend proxy) */
const apiFetch = (url, options = {}) => {
  const headers = {
    ...(options.headers || {}),
    ...(_authToken ? { 'Authorization': `Bearer ${_authToken}` } : {}),
  };
  return fetch(url, { ...options, headers });
};

/** Auth API fetch helper (queries movieflix /api/auth connected to Neon DB) */
const authFetch = (action, payload = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(_authToken ? { 'Authorization': `Bearer ${_authToken}` } : {}),
  };
  return fetch(`${AUTH_API_URL}?action=${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
};

/** Helper to dynamically update web SEO meta tags, OpenGraph, and Twitter Cards */
const updateWebMetaTags = (title, description, image, url) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  if (title) {
    document.title = title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', title);
  }

  if (description) {
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', description);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', description);
  }

  if (image) {
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) ogImg.setAttribute('content', image);
    const twImg = document.querySelector('meta[name="twitter:image"]');
    if (twImg) twImg.setAttribute('content', image);
  }

  if (url) {
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', url);
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.setAttribute('href', url);
  }
};

// Movieflix Header Icon & Netflix-Style Intro Video Asset
const LOCAL_HEADER_ICON = require('./assets/header_icon.png');
const LOCAL_INTRO_ASSET = require('./assets/intro.mp4');

let preloadedIntroUri = null;

// Android Edge-to-Edge System Navigation Bar Controllers
const enterFullscreenSystemBar = async () => {
  if (Platform.OS === 'android') {
    try {
      await NavigationBar.setVisibilityAsync('hidden');
      await NavigationBar.setBehaviorAsync('overlay-swipe');
      await NavigationBar.setBackgroundColorAsync('#000000');
      await NavigationBar.setButtonStyleAsync('light');
    } catch (e) {
      // non-fatal
    }
  }
};

const exitFullscreenSystemBar = async () => {
  if (Platform.OS === 'android') {
    try {
      await NavigationBar.setVisibilityAsync('visible');
      await NavigationBar.setBehaviorAsync('inset-touch');
      await NavigationBar.setBackgroundColorAsync('#0a0a0a');
      await NavigationBar.setButtonStyleAsync('light');
    } catch (e) {
      // non-fatal
    }
  }
};

// Web Deep Linking & Streaming Slug Helpers
export function getMovieSlug(movie) {
  if (!movie) return '';
  if (movie.slug) return String(movie.slug);
  const nameSlug = (movie.name || 'title')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (movie.subject_id) return `${nameSlug}-${movie.subject_id}`;
  return nameSlug || 'title';
}

export const navigateWeb = (url, replace = false, state = {}) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history) return;
  try {
    const current = window.location.pathname + window.location.search;
    if (current === url) return;
    if (replace) {
      window.history.replaceState({ url, ...state }, '', url);
    } else {
      window.history.pushState({ url, ...state }, '', url);
    }
  } catch (e) {}
};

// Normalize any movie/series object across catalog, search, and detail API
export function normalizeMovie(item, fallbackSlug = '') {
  if (!item || typeof item !== 'object') return null;
  const name = item.name || item.title || item.postTitle || '';
  const slug = item.slug || item.detailPath || fallbackSlug || '';
  const subject_id = item.subject_id || item.subjectId || item.id || '';
  const banner_url = item.banner_url || item.image?.url || item.cover?.url || item.poster_url || item.coverUrl || '';
  const poster_url = item.poster_url || item.cover?.url || item.banner_url || item.coverUrl || '';
  const isSeries = Boolean(
    item.isSeries ||
    item.subjectType === 2 ||
    (item.genre && /drama|tv|series/i.test(item.genre)) ||
    (item.seasons && item.seasons.length > 0)
  );

  return {
    ...item,
    name,
    title: name,
    slug: String(slug),
    subject_id: String(subject_id),
    subjectId: String(subject_id),
    banner_url,
    poster_url,
    cover: typeof item.cover === 'object' && item.cover !== null ? item.cover : { url: poster_url },
    isSeries,
    subjectType: isSeries ? 2 : 1,
  };
}

// Preload and cache the intro video to internal storage for instant 0-lag playback
const preloadIntroVideoAsync = async () => {
  try {
    const asset = Asset.fromModule(LOCAL_INTRO_ASSET);
    await asset.downloadAsync();
    if (asset.localUri) {
      preloadedIntroUri = asset.localUri;
    }
  } catch (e) {
    console.log("Intro asset preload note:", e);
  }
};

// Category Icon Mapping for Server Categories
const getCategoryIcon = (name = '') => {
  const n = (name || '').toLowerCase();
  if (n.includes('series') || n.includes('tv') || n.includes('show')) return 'tv-outline';
  if (n.includes('animation') || n.includes('anime')) return 'color-wand-outline';
  if (n.includes('fantasy') || n.includes('magic')) return 'sparkles-outline';
  if (n.includes('romance') || n.includes('love')) return 'heart-outline';
  if (n.includes('thriller') || n.includes('horror') || n.includes('fear')) return 'skull-outline';
  if (n.includes('action') || n.includes('adventure')) return 'flame-outline';
  if (n.includes('gangster') || n.includes('crime') || n.includes('heist')) return 'finger-print-outline';
  if (n.includes('comedy') || n.includes('sitcom') || n.includes('fun')) return 'happy-outline';
  if (n.includes('superhero') || n.includes('hero')) return 'shield-outline';
  if (n.includes('k-drama') || n.includes('c-drama') || n.includes('drama')) return 'videocam-outline';
  if (n.includes('black')) return 'star-outline';
  if (n.includes('nollywood')) return 'globe-outline';
  return 'film-outline';
};

// Initial Server Categories (Matches movie catalog sections)
const INITIAL_SERVER_CATEGORIES = [
  { id: 'All', label: 'All Titles', icon: 'sparkles' },
  { id: 'Movies', label: 'Movies', icon: 'film-outline', isApi: true, endpoint: '/movies' },
  { id: 'TV Series', label: 'TV Series', icon: 'tv-outline', isApi: true, endpoint: '/tv-series' },
  { id: 'Animation', label: 'Animation', icon: 'color-wand-outline', isApi: true, endpoint: '/animation' },
  { id: 'Popular Series', label: 'Popular Series', icon: 'tv-outline' },
  { id: 'Popular Movie', label: 'Popular Movie', icon: 'film-outline' },
  { id: 'Action&Thriller', label: 'Action & Thriller', icon: 'flame-outline' },
  { id: 'Adult Animation', label: 'Adult Animation', icon: 'color-wand-outline' },
  { id: 'Epic Fantasy', label: 'Epic Fantasy', icon: 'sparkles-outline' },
  { id: 'Sitcom', label: 'Sitcom', icon: 'happy-outline' },
  { id: 'Teen Romance', label: 'Teen Romance', icon: 'heart-outline' },
  { id: 'Superhero Series', label: 'Superhero Series', icon: 'shield-outline' },
  { id: 'Gangster', label: 'Gangster', icon: 'finger-print-outline' },
  { id: 'Teen Fantasy', label: 'Teen Fantasy', icon: 'sparkles-outline' },
  { id: 'K-Drama', label: 'K-Drama', icon: 'videocam-outline' },
  { id: 'C-Drama', label: 'C-Drama', icon: 'videocam-outline' },
  { id: 'Anime[English Dubbed]', label: 'Anime Dubbed', icon: 'color-wand-outline' },
  { id: 'Action Movies', label: 'Action Movies', icon: 'flame-outline' },
  { id: 'Horror Movies', label: 'Horror Movies', icon: 'skull-outline' },
  { id: 'Nollywood Movie', label: 'Nollywood Movie', icon: 'globe-outline' },
  { id: 'Must-watch Black Shows', label: 'Black Shows', icon: 'star-outline' },
];

// Helper for video sources (supports local downloaded file://, required assets, and remote CDN with headers)
const buildVideoSource = (url) => {
  if (!url) return null;
  if (typeof url === 'number') return url;
  if (typeof url === 'object' && url.uri) return url;
  if (typeof url === 'string' && (url.startsWith('file://') || (url.startsWith('/') && !url.startsWith('/api/')))) {
    return { uri: url.startsWith('file://') ? url : `file://${url}` };
  }
  if (typeof url === 'string' && url.includes('/api/proxy')) {
    return { uri: url };
  }

  // Web browsers have CORS & forbidden header restrictions (cannot set Referer from client JS),
  // so Web MUST stream through our reverse proxy /api/proxy.
  // Native Android/iOS (ExoPlayer/AVPlayer) CAN send custom Referer/Origin headers directly to the CDN!
  // Android ExoPlayer strictly requires Content-Length on byte-range requests, which Vercel edge proxy chunks/drops.
  // Therefore, on Native platforms (Android/iOS), pass the direct CDN URL with Referer & Origin headers.
  if (Platform.OS === 'web' && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    return {
      uri: `/api/proxy?url=${encodeURIComponent(url)}`,
    };
  }

  return {
    uri: url,
    headers: {
      'Referer': 'https://netfilm.world/',
      'Origin': 'https://netfilm.world',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    },
  };
};

// Formats timestamp in ms or seconds to mm:ss or hh:mm:ss
function formatTimestamp(timeValue) {
  if (!timeValue || timeValue <= 0) return '0:00';
  const totalSecs = timeValue > 10000 ? Math.floor(timeValue / 1000) : Math.floor(timeValue);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Clean subtitle text: removes HTML/XML tags, ASS/SSA tags, WebVTT artifacts, and decodes HTML entities
function cleanSubtitleText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]+>/g, '') // Strip HTML tags like <font color="...">, <i>, <b>, </u>
    .replace(/\{[^}]+\}/g, '') // Strip SSA/ASS tags like {\an8}, {\pos(x,y)}, {y:i}
    .replace(/<v [^>]+>/g, '') // Strip WebVTT voice tags
    .replace(/<\/v>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Friendly localized language display mapping for multi-language subtitles
function getFriendlyLanguageName(lanName, lanCode) {
  const code = (lanCode || '').toLowerCase().trim();
  const name = (lanName || '').trim();

  const MAP = {
    'en': 'English',
    'es': 'Spanish (Español)',
    'hi': 'Hindi (हिन्दी)',
    'fr': 'French (Français)',
    'ar': 'Arabic (العربية)',
    'pt': 'Portuguese (Português)',
    'ru': 'Russian (Русский)',
    'id': 'Indonesian (Bahasa)',
    'ms': 'Malay (Bahasa Melayu)',
    'pa': 'Punjabi (ਪੰਜਾਬੀ)',
    'th': 'Thai (ไทย)',
    'ur': 'Urdu (اردو)',
    'vi': 'Vietnamese (Tiếng Việt)',
    'zh': 'Chinese (中文)',
    'bn': 'Bengali (বাংলা)',
    'fil': 'Filipino (Tagalog)',
    'tl': 'Filipino (Tagalog)',
    'de': 'German (Deutsch)',
    'it': 'Italian (Italiano)',
    'ja': 'Japanese (日本語)',
    'ko': 'Korean (한국어)',
    'tr': 'Turkish (Türkçe)',
    'sw': 'Swahili (Kiswahili)',
    'ha': 'Hausa',
  };

  if (code && MAP[code]) return MAP[code];
  if (name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('english')) return 'English';
    if (lowerName.includes('español') || lowerName.includes('spanish')) return 'Spanish (Español)';
    if (lowerName.includes('हिन्दी') || lowerName.includes('hindi')) return 'Hindi (हिन्दी)';
    if (lowerName.includes('français') || lowerName.includes('french')) return 'French (Français)';
    if (lowerName.includes('عرب') || lowerName.includes('arabic')) return 'Arabic (العربية)';
    if (lowerName.includes('português') || lowerName.includes('portuguese')) return 'Portuguese (Português)';
    if (lowerName.includes('русский') || lowerName.includes('russian')) return 'Russian (Русский)';
    if (lowerName.includes('indonesia')) return 'Indonesian (Bahasa)';
    if (lowerName.includes('malay')) return 'Malay (Bahasa Melayu)';
    if (lowerName.includes('ਪੰਜਾਬੀ') || lowerName.includes('punjabi')) return 'Punjabi (ਪੰਜਾਬੀ)';
    if (lowerName.includes('ไทย') || lowerName.includes('thai')) return 'Thai (ไทย)';
    if (lowerName.includes('اردو') || lowerName.includes('urdu')) return 'Urdu (اردو)';
    if (lowerName.includes('việt') || lowerName.includes('vietnam')) return 'Vietnamese (Tiếng Việt)';
    if (lowerName.includes('中文') || lowerName.includes('chinese')) return 'Chinese (中文)';
    if (lowerName.includes('বাংলা') || lowerName.includes('bengali')) return 'Bengali (বাংলা)';
    if (lowerName.includes('filipino') || lowerName.includes('tagalog')) return 'Filipino (Tagalog)';
    return name;
  }
  return lanCode || 'Subtitle';
}

// Real SRT Subtitle Parser (converts .srt text to timestamped clean cue objects)
function parseSRT(data) {
  if (!data || typeof data !== 'string') return [];
  // Strip UTF-8 BOM
  const cleanedData = data.replace(/^\ufeff/, '');
  const normalized = cleanedData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        const parts = lines[i].split('-->');
        if (parts.length === 2) {
          const start = parseTimestamp(parts[0].trim());
          const end = parseTimestamp(parts[1].trim());
          const rawText = lines.slice(i + 1).join('\n');
          const text = cleanSubtitleText(rawText);
          if (!isNaN(start) && !isNaN(end) && text) {
            cues.push({ start, end, text });
          }
        }
        break;
      }
    }
  }
  return cues;
}

function parseTimestamp(tStr) {
  if (!tStr) return 0;
  const cleaned = tStr.replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(tStr) || 0;
}

// Complete Global Subtitle Languages for full multi-language coverage
const ALL_SUBTITLE_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'tl', name: 'Filipino', native: 'Tagalog' },
];

const translationCache = {};

// Fast client-side translation engine for on-the-fly multi-language subtitles
async function translateText(text, targetLang) {
  if (!text || !targetLang || targetLang === 'en') return text;
  const cacheKey = `${targetLang}:${text}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|${targetLang}`;
    const res = await fetch(url);
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (translated && typeof translated === 'string' && !translated.includes('MYMEMORY WARNING')) {
      translationCache[cacheKey] = cleanSubtitleText(translated);
      return translationCache[cacheKey];
    }
  } catch (e) {
    // Return original text on network error
  }
  return text;
}

function getFallbackPoster(key) {
  if (!LOCAL_POSTERS || LOCAL_POSTERS.length === 0) return null;
  let str = '';
  if (typeof key === 'string') str = key;
  else if (typeof key === 'number') str = String(key);
  else if (key && typeof key === 'object') str = key.uri || key.default || (typeof key.default === 'string' ? key.default : '') || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  return LOCAL_POSTERS[Math.abs(hash) % LOCAL_POSTERS.length];
}

// Helper to parse episodes array from season object safely everywhere
function getEpisodesArray(seasonObj) {
  if (!seasonObj) return [1];
  if (seasonObj.allEp && seasonObj.allEp.trim().length > 0) {
    const list = seasonObj.allEp.split(',').map(n => parseInt(n.trim(), 10)).filter(Boolean);
    if (list.length > 0) return list;
  }
  const max = seasonObj.maxEp || 1;
  return Array.from({ length: Math.max(1, max) }, (_, idx) => idx + 1);
}

// Fast, ultra-resilient SafeImage powered by expo-image with automatic error reset, bundled require() assets, and multi-protocol fallback
const SafeImage = React.memo(function SafeImage({ uri, style, resizeMode = 'cover', contentPosition = 'center' }) {
  const [hasError, setHasError] = useState(false);
  const prevUriRef = useRef(uri);

  // Synchronously reset error state when URI prop changes so new banners display immediately
  if (prevUriRef.current !== uri) {
    prevUriRef.current = uri;
    if (hasError) {
      setHasError(false);
    }
  }

  // 1. Packaged local asset (require('./assets/...'))
  if (typeof uri === 'number') {
    return (
      <ExpoImage
        key={String(uri)}
        source={uri}
        style={style}
        contentFit={resizeMode === 'contain' ? 'contain' : (resizeMode || 'cover')}
        contentPosition={contentPosition}
        cachePolicy="memory-disk"
        transition={150}
      />
    );
  }

  // 2. Direct local filesystem URI (/storage/... or file://...)
  if (typeof uri === 'string' && (uri.startsWith('file://') || uri.startsWith('/'))) {
    const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    return (
      <ExpoImage
        key={fileUri}
        source={{ uri: fileUri }}
        style={style}
        contentFit={resizeMode === 'contain' ? 'contain' : (resizeMode || 'cover')}
        contentPosition={contentPosition}
        cachePolicy="memory-disk"
        transition={150}
        onError={() => setHasError(true)}
      />
    );
  }

  // 3. Object with uri property or string remote URL, or Web require format
  let cleanUri = null;
  if (uri && typeof uri === 'string') {
    cleanUri = uri.trim();
  } else if (uri && typeof uri === 'object') {
    if (typeof uri.uri === 'string') cleanUri = uri.uri.trim();
    else if (typeof uri.default === 'string') cleanUri = uri.default.trim();
    else if (typeof uri.src === 'string') cleanUri = uri.src.trim();
    else if (uri.default && typeof uri.default.src === 'string') cleanUri = uri.default.src.trim();
    else if (typeof uri.default === 'number') {
      return (
        <ExpoImage
          key={String(uri.default)}
          source={uri.default}
          style={style}
          contentFit={resizeMode === 'contain' ? 'contain' : (resizeMode || 'cover')}
          contentPosition={contentPosition}
          cachePolicy="memory-disk"
          transition={150}
        />
      );
    }
  }

  if (!cleanUri || hasError) {
    const fallbackPoster = getFallbackPoster(uri);
    if (fallbackPoster) {
      return (
        <ExpoImage
          key={`fallback-${cleanUri || 'none'}`}
          source={fallbackPoster}
          style={style}
          contentFit={resizeMode === 'contain' ? 'contain' : (resizeMode || 'cover')}
          contentPosition={contentPosition}
          cachePolicy="memory-disk"
          transition={150}
        />
      );
    }
    return (
      <View style={[style, styles.fallbackImageContainer]}>
        <Feather name="film" size={22} color="#3a3a3c" />
      </View>
    );
  }

  // Upgrade HTTP to HTTPS for modern web & APK security
  let effectiveUri = cleanUri;
  if (effectiveUri.startsWith('http://')) {
    effectiveUri = effectiveUri.replace('http://', 'https://');
  }

  return (
    <ExpoImage
      key={effectiveUri}
      source={{ uri: effectiveUri }}
      style={style}
      contentFit={resizeMode === 'contain' ? 'contain' : (resizeMode || 'cover')}
      contentPosition={contentPosition}
      cachePolicy="memory-disk"
      transition={150}
      onError={() => {
        setHasError(true);
      }}
    />
  );
});

// Reusable Butter-Smooth Animated Download Components
function AnimatedDownloadSpinner({ size = 15, color = '#e50914' }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Feather name="loader" size={size} color={color} />
    </Animated.View>
  );
}

function AnimatedPulseBadge({ text = 'Downloading' }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.downloadPulseBadge, { transform: [{ scale: pulseAnim }] }]}>
      <AnimatedDownloadSpinner size={11} color="#FFFFFF" />
      <Text style={styles.downloadPulseBadgeText}>{text}</Text>
    </Animated.View>
  );
}

// ----------------------------------------------------
// CURATED HERO TITLES (Wednesday, Squid Game, Money Heist, Demon Slayer)
// ----------------------------------------------------
// Curated local hero poster assets
const LOCAL_HERO_ASSETS = {
  wednesday: require('./assets/hero/wednesday.jpg'),
  squidGame: require('./assets/hero/squid_game.png'),
  moneyHeist: require('./assets/hero/money_heist.png'),
  demonSlayer: require('./assets/hero/demon_slayer.jpg'),
};

const CURATED_HERO_ITEMS = [
  {
    name: "Wednesday",
    slug: "wednesday-urChTxajYKa",
    subject_id: "9028867555875774472",
    banner_url: LOCAL_HERO_ASSETS.wednesday,
    poster_url: LOCAL_HERO_ASSETS.wednesday,
    match: "99% match",
    year: "2025",
    tag: "4K ULTRA",
    genre: "Mystery · Dark Fantasy",
    synopsis: "Wednesday Addams investigates a monstrous mystery at Nevermore Academy while navigating complex relationships and dark secrets.",
    isSeries: true,
  },
  {
    name: "Squid Game",
    slug: "squid-game-4CyZm1LfdG3",
    subject_id: "3089349649006742360",
    banner_url: LOCAL_HERO_ASSETS.squidGame,
    poster_url: LOCAL_HERO_ASSETS.squidGame,
    match: "98% match",
    year: "2025",
    tag: "4K ULTRA",
    genre: "Thriller · Survival Drama",
    synopsis: "Hundreds of cash-strapped players accept a deadly invitation to compete in children's games for a life-changing 45.6 billion won prize.",
    isSeries: true,
  },
  {
    name: "Money Heist",
    slug: "money-heist-8UcoFG3Uog",
    subject_id: "222030967182086936",
    banner_url: LOCAL_HERO_ASSETS.moneyHeist,
    poster_url: LOCAL_HERO_ASSETS.moneyHeist,
    match: "99% match",
    year: "2024",
    tag: "4K ULTRA",
    genre: "Heist · Crime · Suspense",
    synopsis: "Eight thieves lock themselves in the Royal Mint of Spain as The Professor orchestrates the biggest heist in history against the police.",
    isSeries: true,
  },
  {
    name: "Demon Slayer",
    slug: "demon-slayer-kimetsu-no-yaiba-english-cK8E2dUTaC8",
    subject_id: "7231184498325966096",
    banner_url: LOCAL_HERO_ASSETS.demonSlayer,
    poster_url: LOCAL_HERO_ASSETS.demonSlayer,
    match: "97% match",
    year: "2025",
    tag: "FHD ANIME",
    genre: "Action · Anime · Supernatural",
    synopsis: "Tanjiro Kamado embarks on a perilous quest to slay ferocious demons, avenge his slaughtered family, and find a cure for his sister Nezuko.",
    isSeries: true,
  },
];

// Money Heist is ALWAYS #1 in Trending Now
const MONEY_HEIST_TITLE = CURATED_HERO_ITEMS[2];

// Avatar is featured in Popular Movies
const AVATAR_TITLE = {
  name: "Avatar",
  slug: "avatar-WLDIi21IUBa",
  subject_id: "8906247916759695608",
  poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/27/d0afc52be1b6f93d5c9a70f9105f3a37.jpg",
  isSeries: false,
};

// Popular Anime Shows
const DEFAULT_ANIME_SHOWS = [
  CURATED_HERO_ITEMS[3], // Demon Slayer
  {
    name: "Naruto",
    slug: "naruto-2D7JgAQBGX3",
    subject_id: "3325889774849773352",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/27/a8c30c08d21f108d2c9b25fa06df81dd.jpg",
    isSeries: true,
  },
  {
    name: "Dragon Ball Super",
    slug: "dragon-ball-super-WFYWA773657",
    subject_id: "5944102003847610600",
    poster_url: "https://pbcdnw.aoneroom.com/image/2025/11/03/164b84e43344c7786c5f72f00fcdcf7c.jpg",
    isSeries: true,
  },
  {
    name: "One Piece",
    slug: "one-piece-CTqWaizwOp3",
    subject_id: "2867356962868579120",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/09/24/bdc0a7d7be9efadf49e7f06d0599b128.jpg",
    isSeries: true,
  },
  {
    name: "Attack on Titan",
    slug: "attack-on-titan-c0p85b63Xl2",
    subject_id: "1975770531236301600",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/27/2735770dff71711ed9ad492f40b5695d.jpg",
    isSeries: true,
  },
  {
    name: "Jujutsu Kaisen",
    slug: "jujutsu-kaisen-english-KD0jSM9ot5",
    subject_id: "74102370522777768",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/26/bc9427603613c8c9c239a85b2bbc552b.jpg",
    isSeries: true,
  },
];

// Cartoon & Animated Movies
const DEFAULT_CARTOON_MOVIES = [
  {
    name: "Frozen",
    slug: "frozen-qRktDt2jj04",
    subject_id: "3361412976908583976",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/27/881ec25de4ac1fda6d530bcf64ef2e66.jpg",
    isSeries: false,
  },
  {
    name: "Shrek",
    slug: "shrek-mTc8HTgoa22",
    subject_id: "1707941784464019240",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/27/ce90cfc0f62f4c1ada3e73dab3fe42b0.jpg",
    isSeries: false,
  },
  {
    name: "Toy Story",
    slug: "toy-story-OZ27JrGCWY",
    subject_id: "825025151266868920",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/27/7dac203f815b95a34875d955ab527a07.jpg",
    isSeries: false,
  },
  {
    name: "Kung Fu Panda",
    slug: "kung-fu-panda-w8qq5gY0GU3",
    subject_id: "3285148651382784248",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/27/e3af1d60e932503cf9cfde4769b02347.jpg",
    isSeries: false,
  },
];

// Hindi & Bollywood Movies
const DEFAULT_HINDI_MOVIES = [
  {
    name: "Singham Again",
    slug: "singham-again-alwCCc6RCq1",
    subject_id: "1199747538023236688",
    banner_url: "https://pbcdnw.aoneroom.com/image/2026/01/26/aca56b29eb6010435c6ecaaa294bdeff.jpg",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/26/aca56b29eb6010435c6ecaaa294bdeff.jpg",
    isSeries: false,
  },
  {
    name: "Pushpa",
    slug: "pushpa-OTJ90wVDEr2",
    subject_id: "2052974282610834608",
    banner_url: "https://pbcdnw.aoneroom.com/image/2026/04/26/f75dc1594bc341912a6274f49bf6690e.jpg",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/04/26/f75dc1594bc341912a6274f49bf6690e.jpg",
    isSeries: false,
  },
  {
    name: "Animal",
    slug: "animal-c8zmSROvma7",
    subject_id: "6015381968286796952",
    banner_url: "https://pbcdnw.aoneroom.com/image/2026/01/26/d5d4623300ebab2e73a68ace0f2b219e.jpg",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/26/d5d4623300ebab2e73a68ace0f2b219e.jpg",
    isSeries: false,
  },
  {
    name: "Stree 3",
    slug: "stree-3-ufEwn7KRXL9",
    subject_id: "8203008691864490480",
    banner_url: "https://pbcdnw.aoneroom.com/image/2026/02/10/558248244bba7eb1557c85bfff9fa870.jpg",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/02/10/558248244bba7eb1557c85bfff9fa870.jpg",
    isSeries: false,
  },
  {
    name: "Pathaan",
    slug: "pathaan-WR6qz1rLVK4",
    subject_id: "3992515881552203432",
    banner_url: "https://pbcdnw.aoneroom.com/image/2026/01/26/67063b8af69d0745c7b1ea87caeb5b8a.jpg",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/01/26/67063b8af69d0745c7b1ea87caeb5b8a.jpg",
    isSeries: false,
  },
  {
    name: "RRR",
    slug: "rrr-0GHAuwZXoo3",
    subject_id: "2848239607093808728",
    banner_url: "https://pbcdnw.aoneroom.com/image/2022/10/14/48698840c718cbe05d5524a8b734a58a.jpg",
    poster_url: "https://pbcdnw.aoneroom.com/image/2022/10/14/48698840c718cbe05d5524a8b734a58a.jpg",
    isSeries: false,
  },
];

// DELICATE ATMOSPHERIC ROLLING SMOKE & MIST EFFECT
function HeroSmokeEffect() {
  const smokeAnim1 = useRef(new Animated.Value(0)).current;
  const smokeAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(smokeAnim1, {
          toValue: 1,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(smokeAnim1, {
          toValue: 0,
          duration: 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(smokeAnim2, {
          toValue: 1,
          duration: 4600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(smokeAnim2, {
          toValue: 0,
          duration: 4600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop1.start();
    loop2.start();

    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [smokeAnim1, smokeAnim2]);

  const transX1 = smokeAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 10],
  });
  const opacity1 = smokeAnim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.06, 0.16, 0.06],
  });

  const transX2 = smokeAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -8],
  });
  const opacity2 = smokeAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.04, 0.12, 0.04],
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Top subtle fade for header text clarity */}
      <LinearGradient
        colors={['rgba(10, 10, 10, 0.65)', 'transparent']}
        style={styles.heroTopFade}
      />

      {/* Delicate subtle smoke wisp 1 */}
      <Animated.View
        style={[
          styles.smokePlume,
          styles.smokePlume1,
          {
            opacity: opacity1,
            transform: [{ translateX: transX1 }],
          },
        ]}
      />

      {/* Delicate subtle smoke wisp 2 */}
      <Animated.View
        style={[
          styles.smokePlume,
          styles.smokePlume2,
          {
            opacity: opacity2,
            transform: [{ translateX: transX2 }],
          },
        ]}
      />

      {/* Deep bottom fade for text & content clarity */}
      <LinearGradient
        colors={['transparent', 'rgba(10, 10, 10, 0.25)', 'rgba(10, 10, 10, 0.75)', 'rgba(10, 10, 10, 0.96)', '#0a0a0a']}
        locations={[0, 0.35, 0.65, 0.88, 1]}
        style={styles.heroBottomFade}
      />
    </View>
  );
}

// SLEEK DARK GLASS HOMEPAGE SKELETON LOADER
function HomeSkeletonLoader() {
  const shimmerAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.75,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.35,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  return (
    <View style={styles.skeletonContainer}>
      {/* Hero Banner Skeleton */}
      <Animated.View style={[styles.skeletonHeroBox, { opacity: shimmerAnim }]}>
        <View style={styles.skeletonHeroBottom}>
          <View style={styles.skeletonTitleBar} />
          <View style={styles.skeletonMetaRow}>
            <View style={styles.skeletonPillSmall} />
            <View style={styles.skeletonPillSmall} />
            <View style={styles.skeletonPillMed} />
          </View>
          <View style={styles.skeletonBtnRow}>
            <View style={styles.skeletonBtn} />
            <View style={styles.skeletonBtnRound} />
          </View>
        </View>
      </Animated.View>

      {/* Category Row 1 Skeletons */}
      <View style={styles.skeletonRowWrapper}>
        <Animated.View style={[styles.skeletonRowTitle, { opacity: shimmerAnim }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
          {[1, 2, 3, 4].map((k) => (
            <Animated.View key={`skel-r1-${k}`} style={[styles.skeletonCard, { opacity: shimmerAnim }]} />
          ))}
        </ScrollView>
      </View>

      {/* Category Row 2 Skeletons */}
      <View style={styles.skeletonRowWrapper}>
        <Animated.View style={[styles.skeletonRowTitle, { opacity: shimmerAnim, width: 140 }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
          {[1, 2, 3, 4].map((k) => (
            <Animated.View key={`skel-r2-${k}`} style={[styles.skeletonCard, { opacity: shimmerAnim }]} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── INSTAGRAM-STYLE 9:16 SHOTS FEED & VIDEO PLAYER ─────────────────────────
const INITIAL_SHOTS = [
  {
    id: "545117293769020152-ep1",
    subject_id: "545117293769020152",
    title: "I'm pregnant, it's not yours",
    slug: "im-pregnant-its-not-yours-iLdEdERDgE",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/19/c0a1ea39fb7a40fd3d0ec44fa6684a39.jpg",
    rating: "7.9",
    total_episodes: 37,
    author: "@DramaBox",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "8514694265598101032-ep1",
    subject_id: "8514694265598101032",
    title: "Beneath Her Gown: The Master's Claimed Wolf Pet",
    slug: "beneath-her-gown-the-masters-claimed-wolf-pet-k8xuNqboZ8a",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/11/50e2c2fc118aaacb56bf6e892743d5ff.jpg",
    rating: "7.2",
    total_episodes: 28,
    author: "@NetShort",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "3453846752107844528-ep1",
    subject_id: "3453846752107844528",
    title: "Disciplined by My Mafia Master",
    slug: "disciplined-by-my-mafia-master-IOUVnVAE874",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/12/eba98a15ea3a790581c975c58a80cf94.jpg",
    rating: "7.8",
    total_episodes: 24,
    author: "@DramaBox",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "8656852975811445184-ep1",
    subject_id: "8656852975811445184",
    title: "The Hidden Dragon Rider Returns for Justice",
    slug: "the-hidden-dragon-rider-returns-for-justice-KTqXdfFtuja",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/24/4be78c41bd06008edc758fed54b88750.jpg",
    rating: "7.9",
    total_episodes: 30,
    author: "@ShortMax",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "1893361129175368768-ep1",
    subject_id: "1893361129175368768",
    title: "The Gambling God Vanished Until the Final Hand",
    slug: "the-gambling-god-vanished-until-the-final-hand-8sEaor4CRf2",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/24/1901755c3ec30ab5e338938d3c9f0064.jpg",
    rating: "7.1",
    total_episodes: 18,
    author: "@ReelShort",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "8569709395045678544-ep1",
    subject_id: "8569709395045678544",
    title: "OMG! My Divorce Client Is My Billionaire Husband",
    slug: "omg-my-divorce-client-is-my-billionaire-husband-6Rd6xDjm3da",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/19/6b3f8c18a5311f8b344a19037c6f199b.jpg",
    rating: "7.6",
    total_episodes: 32,
    author: "@DramaBox",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "9106721078893863608-ep1",
    subject_id: "9106721078893863608",
    title: "One Move God Mode 2",
    slug: "one-move-god-mode-2-uH6hEtvSIQa",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/12/0a07afddec873b23bf2b74073424a4a4.jpg",
    rating: "7.7",
    total_episodes: 20,
    author: "@NetShort",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "8529996031482808168-ep1",
    subject_id: "8529996031482808168",
    title: "Daddy Don's Forbidden Pet",
    slug: "daddy-dons-forbidden-pet-QEduiBht7aa",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/25/f02290e1f49389c5a626cea31c20c3a0.jpg",
    rating: "7.0",
    total_episodes: 16,
    author: "@GoodShort",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "6191020716834840472-ep1",
    subject_id: "6191020716834840472",
    title: "The 100th Divorce Was Final",
    slug: "the-100th-divorce-was-final-ke4MZwjWkn7",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/18/5fbef86eb4e1a06e9708fe18412b2e60.jpg",
    rating: "7.1",
    total_episodes: 25,
    author: "@ReelShort",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  },
  {
    id: "1980899104976688224-ep1",
    subject_id: "1980899104976688224",
    title: "From XL to Extra Love",
    slug: "from-xl-to-extra-love-EOfYUApxkm2",
    poster_url: "https://pbcdnw.aoneroom.com/image/2026/03/26/68269d6d0a6b02da95bd09cb04b42cce.jpg",
    rating: "7.7",
    total_episodes: 22,
    author: "@ShortMax",
    likes: 0,
    shares: 0,
    se: 1,
    ep: 1,
  }
];

function formatShotCount(num) {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function buildPureHtmlShotsPage({ initialShots, apiBase, isMuted, targetShortId }) {
  const safeShotsJson = JSON.stringify(initialShots || []);
  const safeTargetId = JSON.stringify(targetShortId || '');
  const safeApiBase = JSON.stringify(apiBase || '');
  const safeIsMuted = isMuted ? 'true' : 'false';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Movieflix Shorts</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      user-select: none;
      -webkit-user-select: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: #000000;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #ffffff;
    }
    .feed-container {
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .feed-container::-webkit-scrollbar {
      display: none;
    }
    .slide {
      width: 100%;
      height: 100%;
      scroll-snap-align: start;
      scroll-snap-stop: always;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000000;
      overflow: hidden;
    }
    .ambient-backdrop {
      position: absolute;
      top: -10%;
      left: -10%;
      width: 120%;
      height: 120%;
      object-fit: cover;
      filter: blur(40px) brightness(0.25);
      z-index: 1;
      pointer-events: none;
    }
    .stage {
      position: relative;
      width: 100%;
      max-width: 520px;
      height: 100%;
      background: #050505;
      z-index: 2;
      overflow: hidden;
    }
    video.player {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000000;
      display: block;
      z-index: 2;
    }
    .poster-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000000;
      z-index: 3;
      transition: opacity 0.25s ease;
    }
    .poster-img.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .gradient-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.45) 0%,
        transparent 18%,
        transparent 62%,
        rgba(0, 0, 0, 0.35) 75%,
        rgba(0, 0, 0, 0.88) 100%
      );
      z-index: 4;
      pointer-events: none;
    }
    .top-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      padding: env(safe-area-inset-top, 14px) 16px 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
      pointer-events: none;
    }
    .top-header * {
      pointer-events: auto;
    }
    .header-btn {
      width: 40px;
      height: 40px;
      border-radius: 20px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #ffffff;
      transition: transform 0.15s ease, background 0.2s ease;
    }
    .header-btn:active {
      transform: scale(0.92);
      background: rgba(0, 0, 0, 0.65);
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.3px;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
    }
    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 3px;
      background: #e50914;
      box-shadow: 0 0 8px #e50914;
    }
    .right-actions {
      position: absolute;
      right: 14px;
      bottom: calc(env(safe-area-inset-bottom, 16px) + 78px);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      z-index: 20;
    }
    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: none;
      border: none;
      color: #ffffff;
      cursor: pointer;
      gap: 5px;
    }
    .action-btn:active {
      transform: scale(0.9);
    }
    .action-icon-circle {
      width: 46px;
      height: 46px;
      border-radius: 23px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .action-btn.liked .action-icon-circle {
      background: rgba(229, 9, 20, 0.25);
      border-color: rgba(229, 9, 20, 0.45);
    }
    .action-btn.liked svg {
      fill: #e50914;
      stroke: #e50914;
    }
    .action-label {
      font-size: 11px;
      font-weight: 700;
      color: #e5e5e5;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9);
    }
    .bottom-info {
      position: absolute;
      left: 16px;
      right: 80px;
      bottom: calc(env(safe-area-inset-bottom, 16px) + 20px);
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .creator-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .creator-avatar {
      width: 28px;
      height: 28px;
      border-radius: 14px;
      object-fit: cover;
      border: 1.5px solid rgba(255, 255, 255, 0.9);
    }
    .creator-name {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9);
    }
    .shot-title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.35;
      color: #ffffff;
      text-shadow: 0 1px 4px rgba(0,0,0,0.95);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ep-pill {
      display: inline-flex;
      align-items: center;
      align-self: flex-start;
      gap: 6px;
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
    }
    .ep-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 4px;
      cursor: pointer;
      opacity: 0.8;
      border: none;
      background: none;
      color: #fff;
      font-size: 9px;
    }
    .ep-btn:active {
      opacity: 1;
      transform: scale(1.2);
    }
    .progress-bar-track {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2.5px;
      background: rgba(255, 255, 255, 0.18);
      z-index: 50;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: #e50914;
      transition: width 0.15s linear;
    }
    .heart-burst {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      pointer-events: none;
      z-index: 30;
      opacity: 0;
      transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
    }
    .heart-burst.pop {
      transform: translate(-50%, -50%) scale(1.35);
      opacity: 1;
    }
    .play-pause-hud {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 68px;
      height: 68px;
      border-radius: 34px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 25;
      opacity: 0;
      transition: opacity 0.25s ease, transform 0.25s ease;
      color: #ffffff;
    }
    .play-pause-hud.show {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
    .buffer-spinner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top-color: #e50914;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      z-index: 22;
      display: none;
    }
    .buffer-spinner.active {
      display: block;
    }
    @keyframes spin {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="top-header">
    <div style="display: flex; align-items: center; gap: 12px;">
      <button class="header-btn" id="backBtn" aria-label="Back">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <div class="header-brand">
        <span style="color: #e50914;">Movieflix</span>
        <span>Shots</span>
        <div class="live-dot"></div>
      </div>
    </div>
    <button class="header-btn" id="muteBtn" aria-label="Mute">
      <svg id="muteIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
    </button>
  </div>

  <div class="feed-container" id="feed"></div>

  <script>
    (function() {
      var API_BASE = ${safeApiBase};
      var initialShots = ${safeShotsJson};
      var targetShortId = ${safeTargetId};
      var isMuted = ${safeIsMuted};
      var currentActiveIdx = -1;
      var streamCache = {};
      var shots = initialShots.slice();
      var feed = document.getElementById('feed');
      var muteBtn = document.getElementById('muteBtn');
      var muteIcon = document.getElementById('muteIcon');
      var backBtn = document.getElementById('backBtn');

      var volOnSvg = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
      var volOffSvg = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
      var playSvg = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      var pauseSvg = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

      function updateMuteIcon() {
        muteIcon.innerHTML = isMuted ? volOffSvg : volOnSvg;
      }
      updateMuteIcon();

      function postToNative(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(JSON.stringify(payload), '*');
        }
      }

      backBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        postToNative({ type: 'back' });
      });

      muteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        isMuted = !isMuted;
        updateMuteIcon();
        var allVideos = document.querySelectorAll('video.player');
        for (var i = 0; i < allVideos.length; i++) {
          allVideos[i].muted = isMuted;
        }
        postToNative({ type: 'toast', message: isMuted ? 'Muted 🔇' : 'Sound unmuted 🔊' });
      });

      function formatCount(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return String(num);
      }

      function createSlideElement(item, idx) {
        item.currentEp = item.ep || 1;
        item.total_episodes = item.total_episodes || 12;
        item.likesCount = item.likes || 0;
        item.liked = false;

        var slide = document.createElement('div');
        slide.className = 'slide';
        slide.dataset.index = idx;
        slide.dataset.id = item.subject_id || item.id;

        slide.innerHTML =
          '<img class="ambient-backdrop" src="' + (item.poster_url || '') + '" alt="" />' +
          '<div class="stage">' +
            '<video class="player" playsinline webkit-playsinline loop preload="none"></video>' +
            '<img class="poster-img" src="' + (item.poster_url || '') + '" alt="" />' +
            '<div class="gradient-overlay"></div>' +
            '<div class="buffer-spinner"></div>' +
            '<div class="play-pause-hud"></div>' +
            '<div class="heart-burst">' +
              '<svg width="90" height="90" viewBox="0 0 24 24" fill="#e50914" stroke="#e50914" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>' +
            '</div>' +
            '<div class="right-actions">' +
              '<button class="action-btn like-btn" aria-label="Like">' +
                '<div class="action-icon-circle">' +
                  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>' +
                '</div>' +
                '<span class="action-label like-count">' + formatCount(item.likesCount) + '</span>' +
              '</button>' +
              '<button class="action-btn share-btn" aria-label="Share">' +
                '<div class="action-icon-circle">' +
                  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>' +
                '</div>' +
                '<span class="action-label">Share</span>' +
              '</button>' +
            '</div>' +
            '<div class="bottom-info">' +
              '<div class="creator-row">' +
                '<img class="creator-avatar" src="' + (item.poster_url || '') + '" alt="" />' +
                '<span class="creator-name">' + (item.author || '@Movieflix') + '</span>' +
              '</div>' +
              '<div class="shot-title">' + (item.title || '') + '</div>' +
              '<div class="ep-pill">' +
                '<button class="ep-btn ep-prev-btn">&#9664;</button>' +
                '<span class="ep-text">Ep ' + item.currentEp + ' / ' + item.total_episodes + '</span>' +
                '<button class="ep-btn ep-next-btn">&#9654;</button>' +
              '</div>' +
            '</div>' +
            '<div class="progress-bar-track">' +
              '<div class="progress-bar-fill"></div>' +
            '</div>' +
          '</div>';

        setupSlideEvents(slide, item, idx);
        return slide;
      }

      function setupSlideEvents(slide, item, idx) {
        var video = slide.querySelector('video.player');
        var poster = slide.querySelector('.poster-img');
        var spinner = slide.querySelector('.buffer-spinner');
        var hud = slide.querySelector('.play-pause-hud');
        var progressFill = slide.querySelector('.progress-bar-fill');
        var likeBtn = slide.querySelector('.like-btn');
        var likeCountEl = slide.querySelector('.like-count');
        var shareBtn = slide.querySelector('.share-btn');
        var heartBurst = slide.querySelector('.heart-burst');
        var epText = slide.querySelector('.ep-text');
        var prevEpBtn = slide.querySelector('.ep-prev-btn');
        var nextEpBtn = slide.querySelector('.ep-next-btn');

        video.addEventListener('timeupdate', function() {
          if (video.duration > 0) {
            var pct = (video.currentTime / video.duration) * 100;
            progressFill.style.width = pct + '%';
          }
        });

        video.addEventListener('playing', function() {
          poster.classList.add('hidden');
          spinner.classList.remove('active');
        });

        video.addEventListener('waiting', function() {
          spinner.classList.add('active');
        });

        video.addEventListener('canplay', function() {
          spinner.classList.remove('active');
        });

        video.addEventListener('error', function() {
          spinner.classList.remove('active');
          poster.classList.remove('hidden');
        });

        function toggleLike() {
          item.liked = !item.liked;
          item.likesCount = Math.max(0, item.likesCount + (item.liked ? 1 : -1));
          likeCountEl.textContent = formatCount(item.likesCount);
          if (item.liked) {
            likeBtn.classList.add('liked');
          } else {
            likeBtn.classList.remove('liked');
          }
          postToNative({
            type: 'like',
            shotId: item.subject_id || item.id,
            liked: item.liked
          });
        }

        likeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleLike();
        });

        shareBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          postToNative({ type: 'share', item: item });
        });

        function changeEp(delta) {
          var newEp = item.currentEp + delta;
          if (newEp >= 1 && newEp <= item.total_episodes) {
            item.currentEp = newEp;
            epText.textContent = 'Ep ' + newEp + ' / ' + item.total_episodes;
            postToNative({ type: 'toast', message: 'Playing Episode ' + newEp + ' of ' + item.total_episodes });
            playSlide(idx);
          }
        }

        prevEpBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          changeEp(-1);
        });

        nextEpBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          changeEp(1);
        });

        var lastTapTime = 0;
        slide.addEventListener('click', function(e) {
          if (e.target.closest('button')) return;
          var now = Date.now();
          if (now - lastTapTime < 280) {
            heartBurst.classList.add('pop');
            setTimeout(function() { heartBurst.classList.remove('pop'); }, 400);
            if (!item.liked) toggleLike();
          } else {
            if (video.paused) {
              video.play().catch(function() {});
              hud.innerHTML = playSvg;
            } else {
              video.pause();
              hud.innerHTML = pauseSvg;
            }
            hud.classList.add('show');
            setTimeout(function() { hud.classList.remove('show'); }, 600);
          }
          lastTapTime = now;
        });

        var touchStartX = 0;
        var touchStartY = 0;
        slide.addEventListener('touchstart', function(e) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }, { passive: true });

        slide.addEventListener('touchend', function(e) {
          var dx = e.changedTouches[0].clientX - touchStartX;
          var dy = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) changeEp(1);
            else changeEp(-1);
          }
        }, { passive: true });
      }

      function renderFeed() {
        feed.innerHTML = '';
        for (var i = 0; i < shots.length; i++) {
          var slide = createSlideElement(shots[i], i);
          feed.appendChild(slide);
          observer.observe(slide);
        }
      }

      var observer = new IntersectionObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            var idx = parseInt(entry.target.dataset.index, 10);
            if (idx !== currentActiveIdx) {
              onActiveChange(idx);
            }
          }
        }
      }, { threshold: [0.55] });

      function onActiveChange(idx) {
        if (currentActiveIdx >= 0 && currentActiveIdx !== idx) {
          var oldSlide = feed.children[currentActiveIdx];
          if (oldSlide) {
            var oldVid = oldSlide.querySelector('video.player');
            if (oldVid) {
              oldVid.pause();
            }
          }
        }
        currentActiveIdx = idx;
        playSlide(idx);

        if (idx >= shots.length - 3) {
          loadMore();
        }
      }

      async function fetchStreamUrl(item) {
        var ep = item.currentEp || 1;
        var key = (item.subject_id || item.id) + '-ep-' + ep;
        if (streamCache[key]) return streamCache[key];

        try {
          var res = await fetch(API_BASE + '/api/content?endpoint=stream&id=' + encodeURIComponent(item.subject_id) + '&detail_path=' + encodeURIComponent(item.slug || '') + '&se=1&ep=' + ep);
          var data = await res.json();
          var raw = data && data.sources && data.sources[0] && data.sources[0].url;
          if (raw) {
            var proxied = API_BASE + '/api/proxy?url=' + encodeURIComponent(raw);
            streamCache[key] = proxied;
            return proxied;
          }
        } catch (e) {
          console.warn('Fetch stream error:', e);
        }
        return null;
      }

      async function playSlide(idx) {
        var slide = feed.children[idx];
        if (!slide) return;
        var item = shots[idx];
        if (!item) return;

        var video = slide.querySelector('video.player');
        var poster = slide.querySelector('.poster-img');
        var spinner = slide.querySelector('.buffer-spinner');

        spinner.classList.add('active');

        var url = await fetchStreamUrl(item);

        if (url && currentActiveIdx === idx) {
          if (video.src !== url) {
            video.src = url;
          }
          video.muted = isMuted;
          video.currentTime = 0;
          var p = video.play();
          if (p && p.catch) {
            p.then(function() {
              poster.classList.add('hidden');
              spinner.classList.remove('active');
            }).catch(function() {
              video.muted = true;
              video.play().then(function() {
                poster.classList.add('hidden');
                spinner.classList.remove('active');
              }).catch(function() {
                spinner.classList.remove('active');
              });
            });
          }
        }

        if (idx + 1 < shots.length) {
          fetchStreamUrl(shots[idx + 1]);
        }
      }

      var page = 1;
      var isLoadingMore = false;
      var hasMore = true;

      async function loadMore() {
        if (isLoadingMore || !hasMore) return;
        isLoadingMore = true;
        page++;
        try {
          var res = await fetch(API_BASE + '/api/content?endpoint=shots&page=' + page);
          var data = await res.json();
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            var existingIds = new Set(shots.map(function(s) { return String(s.subject_id || s.id); }));
            var newItems = data.items.filter(function(s) { return !existingIds.has(String(s.subject_id || s.id)); });
            for (var j = 0; j < newItems.length; j++) {
              var newIdx = shots.length;
              shots.push(newItems[j]);
              var newSlide = createSlideElement(newItems[j], newIdx);
              feed.appendChild(newSlide);
              observer.observe(newSlide);
            }
          } else {
            hasMore = false;
          }
        } catch (e) {
          console.warn('Load more error:', e);
        } finally {
          isLoadingMore = false;
        }
      }

      renderFeed();

      var startIdx = 0;
      if (targetShortId) {
        for (var t = 0; t < shots.length; t++) {
          if (String(shots[t].subject_id || shots[t].id) === String(targetShortId) || shots[t].slug === targetShortId) {
            startIdx = t;
            if (feed.children[t]) feed.children[t].scrollIntoView();
            break;
          }
        }
      }

      // Auto start target/first slide if observer hasn't fired yet
      setTimeout(function() {
        if (currentActiveIdx === -1 && shots.length > 0) {
          onActiveChange(startIdx);
        }
      }, 120);

      window.pauseActiveVideo = function() {
        if (currentActiveIdx >= 0 && feed.children[currentActiveIdx]) {
          var v = feed.children[currentActiveIdx].querySelector('video.player');
          if (v) v.pause();
        }
      };

      window.resumeActiveVideo = function() {
        if (currentActiveIdx >= 0 && feed.children[currentActiveIdx]) {
          var v = feed.children[currentActiveIdx].querySelector('video.player');
          if (v) v.play().catch(function() {});
        }
      };

      window.addEventListener('message', function(e) {
        try {
          var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data && data.type === 'pause') window.pauseActiveVideo();
          if (data && data.type === 'resume') window.resumeActiveVideo();
        } catch (_) {}
      });
    })();
  </script>
</body>
</html>`;
}

function ShotsFeedView({
  insets,
  isTabActive,
  showToast,
  triggerHaptic,
  onBack,
  authUser,
  authAccessToken,
  openAuthModal,
  targetShortId,
}) {
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const [shotsHtml, setShotsHtml] = useState(null);

  // Generate the standalone pure HTML/CSS/JS page
  useEffect(() => {
    const apiBase = Platform.OS === 'web' ? '' : 'https://movieflix-pi-six.vercel.app';
    const rankedShots = typeof rankShotsFeed === 'function'
      ? rankShotsFeed(INITIAL_SHOTS, null, new Set(), Date.now() % 100000)
      : INITIAL_SHOTS;
    const html = buildPureHtmlShotsPage({
      initialShots: rankedShots,
      apiBase,
      isMuted: Platform.OS === 'web',
      targetShortId,
    });
    setShotsHtml(html);
  }, [targetShortId]);

  // Tab switching: pause video when moving away from Shots, resume when returning
  useEffect(() => {
    if (!isTabActive) {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'pause' }), '*');
      } else {
        webViewRef.current?.injectJavaScript(
          'window.pauseActiveVideo && window.pauseActiveVideo(); true;'
        );
      }
    } else {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'resume' }), '*');
      } else {
        webViewRef.current?.injectJavaScript(
          'window.resumeActiveVideo && window.resumeActiveVideo(); true;'
        );
      }
    }
  }, [isTabActive]);

  // Handle messages from the pure HTML player
  const handleMessage = useCallback((data) => {
    if (!data || !data.type) return;

    if (data.type === 'back') {
      triggerHaptic?.('selection');
      onBack?.();
    } else if (data.type === 'toast') {
      showToast?.(data.message);
    } else if (data.type === 'haptic') {
      triggerHaptic?.(data.style || 'selection');
    } else if (data.type === 'like') {
      triggerHaptic?.('selection');
      if (authUser && authAccessToken && data.shotId) {
        apiFetch(`${API_BASE}/api/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authAccessToken}`,
          },
          body: JSON.stringify({
            action: data.liked ? 'like-shot' : 'unlike-shot',
            shot_id: String(data.shotId),
          }),
        }).catch(() => {});
      }
    } else if (data.type === 'share' && data.item) {
      triggerHaptic?.('selection');
      const sId = data.item.subject_id || data.item.id;
      const shareUrl = `https://movieflix-pi-six.vercel.app/short/${sId}`;
      Share.share({
        message: `Watch "${data.item.title || 'Movieflix Shorts'}" on Movieflix Shorts! 🎬🍿\n${shareUrl}`,
        url: shareUrl,
        title: data.item.title || 'Movieflix Shorts',
      }).catch(() => {});
    }
  }, [authUser, authAccessToken, onBack, showToast, triggerHaptic]);

  // Listen for Web iframe postMessage
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onWindowMsg = (e) => {
      try {
        const payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (payload && typeof payload === 'object') {
          handleMessage(payload);
        }
      } catch (_) {}
    };
    window.addEventListener('message', onWindowMsg);
    return () => window.removeEventListener('message', onWindowMsg);
  }, [handleMessage]);

  const onWebViewMessage = useCallback((event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload && typeof payload === 'object') {
        handleMessage(payload);
      }
    } catch (_) {}
  }, [handleMessage]);

  if (!shotsHtml) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', zIndex: 999 }]}>
        <iframe
          ref={iframeRef}
          srcDoc={shotsHtml}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#000000',
          }}
          allow="autoplay; fullscreen; encrypted-media"
        />
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', zIndex: 999 }]}>
      <WebView
        ref={webViewRef}
        source={{
          html: shotsHtml,
          baseUrl: 'https://movieflix-pi-six.vercel.app',
        }}
        style={{ flex: 1, backgroundColor: '#000000' }}
        containerStyle={{ backgroundColor: '#000000' }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        androidLayerType="hardware"
        allowsFullscreenVideo={false}
        originWhitelist={['*']}
        scrollEnabled={true}
        bounces={false}
        overScrollMode="never"
        onMessage={onWebViewMessage}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ReelApp />
    </SafeAreaProvider>
  );
}

function ReelApp() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 700 && windowWidth < 1024;
  const numGridCols = isDesktop ? 6 : isTablet ? 4 : 3;
  const contentMaxWidth = 1440;
  const effectiveGridWidth = Math.min(windowWidth, contentMaxWidth);
  const gridGap = isDesktop ? 16 : 10;
  const gridPadding = isDesktop ? 48 : 32;
  const exploreCardWidth = Math.max(
    100,
    Math.floor((effectiveGridWidth - gridPadding - (numGridCols - 1) * gridGap) / numGridCols)
  );
  const horizontalCardWidth = isDesktop ? 180 : isTablet ? 150 : 130;

  // Navigation: 'Home' | 'Shots' | 'Me'
  const [mainTab, setMainTab] = useState('Home');
  const [targetShortId, setTargetShortId] = useState(null);
  const [homeCategory, setHomeCategory] = useState('All'); // 'All' | 'Movies' | 'Series'
  const [meSubTab, setMeSubTab] = useState(null); // null (clean buttons hub) | 'History' | 'MyList' | 'Downloads'
  const [meDotDismissed, setMeDotDismissed] = useState(false);
  const meSubTabAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    meSubTabAnim.setValue(0);
    Animated.timing(meSubTabAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [meSubTab]);

  // Floating Apple-Style Navigation Bar Animation & Fluid Drag State (3 Tabs: Home | Shots | Me)
  const floatingBarWidth = Math.min(windowWidth - 36, 330);
  const floatingTabWidth = (floatingBarWidth - 8) / 3;
  const navAnim = useRef(new Animated.Value(mainTab === 'Home' ? 0 : mainTab === 'Shots' ? 1 : 2)).current;
  const mainTabRef = useRef(mainTab);

  useEffect(() => {
    mainTabRef.current = mainTab;
    if (mainTab === 'Me') {
      setMeDotDismissed(true);
    }
    const toVal = mainTab === 'Home' ? 0 : mainTab === 'Shots' ? 1 : 2;
    Animated.spring(navAnim, {
      toValue: toVal,
      tension: 280,
      friction: 24,
      useNativeDriver: true,
    }).start();
  }, [mainTab]);

  const navPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        navAnim.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const base = mainTabRef.current === 'Home' ? 0 : mainTabRef.current === 'Shots' ? 1 : 2;
        const progress = base + (gestureState.dx / floatingTabWidth);
        let clamped = progress;
        if (progress < 0) {
          clamped = progress * 0.2;
        } else if (progress > 2) {
          clamped = 2 + (progress - 2) * 0.2;
        }
        navAnim.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const base = mainTabRef.current === 'Home' ? 0 : mainTabRef.current === 'Shots' ? 1 : 2;
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        let nextIdx = base;

        if (dx > floatingTabWidth * 0.35 || vx > 0.35) {
          nextIdx = Math.min(2, base + 1);
        } else if (dx < -floatingTabWidth * 0.35 || vx < -0.35) {
          nextIdx = Math.max(0, base - 1);
        }

        const tabs = ['Home', 'Shots', 'Me'];
        const nextTab = tabs[nextIdx];

        Animated.spring(navAnim, {
          toValue: nextIdx,
          tension: 280,
          friction: 24,
          useNativeDriver: true,
        }).start();

        if (nextTab !== mainTabRef.current) {
          triggerHaptic('selection');
          setMainTab(nextTab);
          if (nextTab === 'Me') {
            setMeSubTab(null);
          }
        }
      },
      onPanResponderTerminate: () => {
        const toVal = mainTabRef.current === 'Home' ? 0 : mainTabRef.current === 'Shots' ? 1 : 2;
        Animated.spring(navAnim, {
          toValue: toVal,
          tension: 280,
          friction: 24,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [floatingTabWidth]);

  const indicatorTranslateX = navAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, floatingTabWidth, floatingTabWidth * 2],
  });

  // ─── Auth State ────────────────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(null);       // { id, email } | null
  const [authAccessToken, setAuthAccessToken] = useState(null);
  const [authRefreshToken, setAuthRefreshToken] = useState(null);
  const [isAuthPageOpen, setIsAuthPageOpen] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(Platform.OS === 'web');
  // Ref mirrors authUser so async callbacks (launchPlayer) always read latest value
  const authUserRef = useRef(null);
  const authRedirectPathRef = useRef(null); // '/download' | '/privacy' | null
  const [authMode, setAuthMode] = useState('login');    // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authInitDone, setAuthInitDone] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [isPrivacyPageOpen, setIsPrivacyPageOpen] = useState(false);
  const [isDownloadPageOpen, setIsDownloadPageOpen] = useState(false);
  const [is404PageOpen, setIs404PageOpen] = useState(false);
  const [notFoundPath, setNotFoundPath] = useState('');
  const [showWebInstallBanner, setShowWebInstallBanner] = useState(true);
  const [securityStatus, setSecurityStatus] = useState({ verified: true, authentic: true, isTampered: false });

  // Sync access token to module-level var so apiFetch picks it up automatically
  useEffect(() => { _authToken = authAccessToken; }, [authAccessToken]);
  // Keep ref in sync with state so async functions always see latest authUser
  useEffect(() => { authUserRef.current = authUser; }, [authUser]);

  // Load saved session and welcome status from AsyncStorage on startup
  useEffect(() => {
    (async () => {
      // 0. Perform APK build server security & fingerprint integrity check
      if (Platform.OS !== 'web') {
        try {
          const secRes = await verifyAppSecurityAsync(OFFICIAL_DOWNLOAD_ORIGIN);
          if (secRes) {
            setSecurityStatus(secRes);
          }
        } catch (_) {}
      }

      // 1. Check if native APK user has seen welcome onboarding screen
      if (Platform.OS !== 'web') {
        try {
          const seen = await AsyncStorage.getItem('@mf_seen_welcome');
          setHasSeenWelcome(seen === 'true');
        } catch (_) {
          setHasSeenWelcome(true);
        }
      }

      // 2. Load saved session
      try {
        const saved = await AsyncStorage.getItem('@mf_session');
        if (saved) {
          const { user, accessToken, refreshToken } = JSON.parse(saved);
          // Try to refresh immediately since access token may be expired
          const refreshed = await _authRefresh(refreshToken, true);
          if (refreshed) {
            setAuthUser(refreshed.user);
            setAuthAccessToken(refreshed.access_token);
            setAuthRefreshToken(refreshed.refresh_token);
            await AsyncStorage.setItem('@mf_session', JSON.stringify({
              user: refreshed.user,
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
            }));
          } else {
            // Fallback: use stored token as-is
            setAuthUser(user);
            setAuthAccessToken(accessToken);
            setAuthRefreshToken(refreshToken);
          }
        }
      } catch (_) {}
      setAuthInitDone(true);
    })();
  }, []);

  // Auto-refresh access token every 50 minutes (before 1hr expiry)
  useEffect(() => {
    if (!authRefreshToken) return;
    const interval = setInterval(async () => {
      const refreshed = await _authRefresh(authRefreshToken, true);
      if (refreshed) {
        setAuthAccessToken(refreshed.access_token);
        setAuthRefreshToken(refreshed.refresh_token);
        await AsyncStorage.setItem('@mf_session', JSON.stringify({
          user: authUser,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
        }));
      }
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authRefreshToken, authUser]);

  const pendingPlayRef = useRef(null);

  const _authRefresh = async (refreshToken, silent = false) => {
    if (!refreshToken) return null;
    try {
      const res = await authFetch('refresh', { refresh_token: refreshToken });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  };

  const openAuthPage = (mode = 'login', returnTo = null) => {
    setAuthMode(mode);
    setAuthError('');
    if (returnTo) {
      authRedirectPathRef.current = returnTo;
    } else if (isDownloadPageOpen) {
      authRedirectPathRef.current = '/download';
    } else if (isPrivacyPageOpen) {
      authRedirectPathRef.current = '/privacy';
    } else {
      authRedirectPathRef.current = null;
    }

    if (detailMovie) setDetailMovie(null);
    if (isPlayerOpen) setIsPlayerOpen(false);
    if (isDownloadPageOpen) setIsDownloadPageOpen(false);
    if (isPrivacyPageOpen) setIsPrivacyPageOpen(false);
    if (is404PageOpen) setIs404PageOpen(false);

    setIsAuthPageOpen(true);
    if (Platform.OS === 'web') {
      navigateWeb('/auth', false);
    }
  };

  const closeAuthPage = () => {
    setIsAuthPageOpen(false);
    const returnPath = authRedirectPathRef.current;
    authRedirectPathRef.current = null;

    if (returnPath === '/download') {
      setIsDownloadPageOpen(true);
      if (Platform.OS === 'web') {
        navigateWeb('/download', true);
      }
    } else if (returnPath === '/privacy') {
      setIsPrivacyPageOpen(true);
      if (Platform.OS === 'web') {
        navigateWeb('/privacy', true);
      }
    } else if (Platform.OS === 'web') {
      navigateWeb('/', true);
    }
  };

  const handleOpenPrivacy = () => {
    if (Platform.OS !== 'web') {
      Linking.openURL(PRIVACY_POLICY_URL).catch((err) => {
        console.warn('Failed to open external privacy policy URL:', err);
      });
    } else {
      if (detailMovie) setDetailMovie(null);
      if (isPlayerOpen) setIsPlayerOpen(false);
      if (isDownloadPageOpen) setIsDownloadPageOpen(false);
      if (is404PageOpen) setIs404PageOpen(false);
      setIsPrivacyPageOpen(true);
      navigateWeb('/privacy', false);
    }
  };

  const closePrivacyPage = () => {
    setIsPrivacyPageOpen(false);
    if (Platform.OS === 'web') {
      navigateWeb('/', true);
    }
  };

  const handleOpenDownload = () => {
    if (detailMovie) setDetailMovie(null);
    if (isPlayerOpen) setIsPlayerOpen(false);
    if (isPrivacyPageOpen) setIsPrivacyPageOpen(false);
    if (is404PageOpen) setIs404PageOpen(false);
    setIsDownloadPageOpen(true);
    if (Platform.OS === 'web') {
      navigateWeb('/download', false);
    }
  };

  const closeDownloadPage = () => {
    setIsDownloadPageOpen(false);
    if (Platform.OS === 'web') {
      navigateWeb('/', true);
    }
  };

  const handleOpenNotFound = (badPath = '') => {
    if (detailMovie) setDetailMovie(null);
    if (isPlayerOpen) setIsPlayerOpen(false);
    if (isDownloadPageOpen) setIsDownloadPageOpen(false);
    if (isPrivacyPageOpen) setIsPrivacyPageOpen(false);
    if (isAuthPageOpen) setIsAuthPageOpen(false);
    setNotFoundPath(badPath);
    setIs404PageOpen(true);
  };

  const closeNotFoundPage = () => {
    setIs404PageOpen(false);
    setNotFoundPath('');
    setMainTab('Home');
    if (Platform.OS === 'web') {
      navigateWeb('/', true);
    }
  };

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('@mf_seen_welcome', 'true');
    } catch (_) {}
    setHasSeenWelcome(true);
    setSplashFinished(true);
    setAuthInitDone(true);
    if (!authUserRef.current) {
      openAuthPage('register');
    }
  };

  const handleAuthSubmit = async (customEmail, customPassword, customMode) => {
    setAuthError('');
    const finalEmail = (customEmail || authEmail).trim().toLowerCase();
    const finalPassword = (customPassword || authPassword).trim();
    const finalMode = customMode || authMode;

    if (!finalEmail || !finalPassword) {
      setAuthError('Please enter your email and password.');
      return;
    }
    if (!finalEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (finalMode === 'register' && finalPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await authFetch(finalMode, {
        email: finalEmail,
        password: finalPassword,
      });

      let data;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server response error: ${text.slice(0, 100)}`);
      }

      if (!res.ok) {
        setAuthError(data?.error || data?.detail || `Error (${res.status}). Please try again.`);
        return;
      }

      setAuthUser(data.user);
      setAuthAccessToken(data.access_token);
      setAuthRefreshToken(data.refresh_token);
      setSplashFinished(true);
      await AsyncStorage.setItem('@mf_session', JSON.stringify({
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      }));
      setIsAuthPageOpen(false);
      setAuthEmail('');
      setAuthPassword('');

      const returnPath = authRedirectPathRef.current;
      authRedirectPathRef.current = null;

      if (returnPath === '/download') {
        setIsDownloadPageOpen(true);
        if (Platform.OS === 'web') {
          navigateWeb('/download', true);
        }
        return;
      }
      if (returnPath === '/privacy') {
        setIsPrivacyPageOpen(true);
        if (Platform.OS === 'web') {
          navigateWeb('/privacy', true);
        }
        return;
      }

      // Auto-launch playback if user was trying to play
      if (pendingPlayRef.current) {
        const p = pendingPlayRef.current;
        pendingPlayRef.current = null;
        setTimeout(() => {
          launchPlayer(
            p.rawMovie,
            p.se,
            p.ep,
            p.seriesFlag,
            p.resumeTime,
            p.offlineVideoUrl,
            p.offlineSubUrl,
            p.syncHistory
          );
        }, 120);
      } else if (Platform.OS === 'web') {
        navigateWeb('/', true);
      }
    } catch (e) {
      setAuthError(e.message || 'Network error. Check connection and try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch('logout', { refresh_token: authRefreshToken || '' });
    } catch (_) {}
    setAuthUser(null);
    setAuthAccessToken(null);
    setAuthRefreshToken(null);
    _authToken = null;
    await AsyncStorage.removeItem('@mf_session');
  };
  // ─── End Auth State ────────────────────────────────────────────────────────

  // App Update State
  const [updateInfo, setUpdateInfo] = useState(null); // null | { hasUpdate, latestVersion, ... }
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [apkDownloadProgress, setApkDownloadProgress] = useState(null); // null | { percent, writtenFormatted, totalFormatted }
  const [apkDownloadError, setApkDownloadError] = useState(null);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);

  // Safe Local Storage State
  const [watchHistory, setWatchHistory] = useState([]);
  const [myList, setMyList] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [secureStorageStatus, setSecureStorageStatus] = useState('Encrypted Storage Active');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Content Data
  const [loading, setLoading] = useState(true);
  const [heroList, setHeroList] = useState(CURATED_HERO_ITEMS);
  const [heroIndex, setHeroIndex] = useState(0);
  const [trendingNow, setTrendingNow] = useState(TRENDING_NOW);
  const [latestReleases, setLatestReleases] = useState(LATEST_RELEASES);
  const [netflixPopular, setNetflixPopular] = useState(NETFLIX_POPULAR);
  const [hindiMoviesList, setHindiMoviesList] = useState(HINDI_MOVIES);
  const [animeTrending, setAnimeTrending] = useState(ANIME_TRENDING);
  const [animeLatest, setAnimeLatest] = useState(ANIME_LATEST);
  const [webSeriesLatest, setWebSeriesLatest] = useState(WEBSERIES_LATEST);
  const [cartoonsList, setCartoonsList] = useState(CARTOONS);
  const [exploreGridList, setExploreGridList] = useState([]);
  const [exploreVisibleCount, setExploreVisibleCount] = useState(15);
  const [relatedTitles, setRelatedTitles] = useState([]);

  // Offline & Server Category States
  const [isOffline, setIsOffline] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [serverCategories, setServerCategories] = useState(INITIAL_SERVER_CATEGORIES);
  const [categoryItemsMap, setCategoryItemsMap] = useState({});

  const handleAllowNotifications = async () => {
    setShowNotificationPrompt(false);
    try {
      await AsyncStorage.setItem('@notification_prompt_answered', 'true');
    } catch (e) {}
    const granted = await requestNotificationPermission();
    if (granted) {
      showToast('Notifications enabled! 🔔');
    }
  };

  const handleDismissNotificationPrompt = async () => {
    setShowNotificationPrompt(false);
    try {
      await AsyncStorage.setItem('@notification_prompt_answered', 'true');
    } catch (e) {}
  };

  const [refreshing, setRefreshing] = useState(false);

  // References to ensure explore grid never fetches or shows the same items
  const catalogPoolRef = useRef([]);
  const shownSlugsRef = useRef(new Set());
  const mainScrollRef = useRef(null);

  // Vectorized Recommendation Engine: Personalized Catalog Recommendations
  const nextViperRecommendations = useMemo(() => {
    const allPool = [
      ...trendingNow,
      ...latestReleases,
      ...netflixPopular,
      ...hindiMoviesList,
      ...animeTrending,
      ...animeLatest,
      ...webSeriesLatest,
      ...cartoonsList,
      ...(catalogPoolRef.current || []),
    ];
    return getPersonalizedRecommendations({
      userProfile: { watchHistory, myList },
      catalog: allPool,
      limit: 12,
    });
  }, [
    watchHistory,
    myList,
    trendingNow,
    latestReleases,
    netflixPopular,
    hindiMoviesList,
    animeTrending,
    animeLatest,
    webSeriesLatest,
    cartoonsList,
  ]);

  // Handle Android Hardware Back Button for Me subpages and Shots tab
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (mainTab === 'Me' && meSubTab !== null) {
        setMeSubTab(null);
        return true;
      }
      if (mainTab === 'Shots') {
        setMainTab('Home');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [mainTab, meSubTab]);

  // Hero auto-rotate poster every 3 seconds smoothly
  useEffect(() => {
    if (homeCategory !== 'All' || isSearching) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % (heroList.length > 0 ? heroList.length : 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [homeCategory, isSearching, heroList.length]);

  // Butter-smooth pure crossfade on hero poster change
  const heroFadeAnim = useRef(new Animated.Value(1)).current;
  const heroContentSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    heroFadeAnim.setValue(0);
    heroContentSlideAnim.setValue(6);

    Animated.parallel([
      Animated.timing(heroFadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(heroContentSlideAnim, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroIndex]);

  // Always load new content randomly without duplicates in explore grid
  const handleLoadMoreExplore = async () => {
    // 1. Find items in catalog pool that haven't been shown yet
    const unshown = (catalogPoolRef.current || []).filter(
      item => !shownSlugsRef.current.has(item.slug || item.subject_id)
    );

    if (unshown.length > 0) {
      const nextBatch = [...unshown].sort(() => 0.5 - Math.random()).slice(0, 15);
      nextBatch.forEach(item => shownSlugsRef.current.add(item.slug || item.subject_id));
      setExploreGridList(prev => [...prev, ...nextBatch]);
      setExploreVisibleCount(prev => prev + nextBatch.length);
      return;
    }

    // 2. All catalog pool items shown - fetch fresh random page from server
    try {
      const randPage = Math.floor(Math.random() * 50) + 1;
      const endpoint = Math.random() > 0.5 ? 'movies' : 'tv-series';
      const res = await apiFetch(`${API_BASE}/api/content?endpoint=${endpoint}&page=${randPage}`);
      const data = await res.json();
      const freshOnline = (data.items || [])
        .map(item => normalizeMovie({ ...item, isSeries: endpoint === 'tv-series' }))
        .filter(item => item && !shownSlugsRef.current.has(item.slug || item.subject_id));

      if (freshOnline.length > 0) {
        const nextBatch = freshOnline.slice(0, 15);
        nextBatch.forEach(item => shownSlugsRef.current.add(item.slug || item.subject_id));
        catalogPoolRef.current = [...(catalogPoolRef.current || []), ...freshOnline];
        setExploreGridList(prev => [...prev, ...nextBatch]);
        setExploreVisibleCount(prev => prev + nextBatch.length);
        return;
      }
    } catch (e) {
      // offline or network hiccup
    }

    // 3. Fallback: reset shown set and re-shuffle fresh permutation so it never repeats contiguous batches
    shownSlugsRef.current.clear();
    const freshShuffle = [...catalogPoolRef.current].sort(() => 0.5 - Math.random()).slice(0, 15);
    freshShuffle.forEach(item => shownSlugsRef.current.add(item.slug || item.subject_id));
    setExploreGridList(prev => [...prev, ...freshShuffle]);
    setExploreVisibleCount(prev => prev + freshShuffle.length);
  };

  // Filtered titles for active server category selection
  const filteredCategoryList = useMemo(() => {
    if (homeCategory === 'All') return [];

    // Direct server-loaded items for this section if present
    if (categoryItemsMap[homeCategory] && categoryItemsMap[homeCategory].length > 0) {
      return categoryItemsMap[homeCategory];
    }

    // Top-level server catalog shortcuts
    if (homeCategory === 'Movies') return [...trendingNow, ...latestReleases];
    if (homeCategory === 'TV Series') return [...netflixPopular, ...webSeriesLatest];
    if (homeCategory === 'Animation') return [...animeTrending, ...animeLatest, ...cartoonsList];

    // Fallback search match against all available content
    const searchTerms = homeCategory.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const pool = [
      ...trendingNow,
      ...latestReleases,
      ...netflixPopular,
      ...hindiMoviesList,
      ...animeTrending,
      ...animeLatest,
      ...webSeriesLatest,
      ...cartoonsList,
    ];

    const matches = [];
    const seen = new Set();
    for (const item of pool) {
      const key = item.slug || item.subject_id;
      if (!key || seen.has(key)) continue;

      const haystack = `${item.name || ''} ${item.genre || ''} ${item.synopsis || ''} ${item.slug || ''}`.toLowerCase();
      const isMatch = searchTerms.length === 0 || searchTerms.some(kw => haystack.includes(kw));
      if (isMatch) {
        seen.add(key);
        matches.push(item);
      }
    }
    return matches;
  }, [homeCategory, categoryItemsMap, trendingNow, latestReleases, netflixPopular, hindiMoviesList, animeTrending, animeLatest, webSeriesLatest, cartoonsList]);

  // Handler for category selection with lazy API fetching
  const handleSelectCategory = async (catId) => {
    triggerHaptic('light');
    setHomeCategory(catId);
    setIsCategoryModalOpen(false);

    if (catId === 'Movies' && !categoryItemsMap['Movies']) {
      try {
        const res = await apiFetch(`${API_BASE}/api/content?endpoint=movies&page=1`);
        const data = await res.json();
        if (data && data.items) {
          setCategoryItemsMap(prev => ({ ...prev, Movies: data.items }));
        }
      } catch (e) {}
    } else if (catId === 'TV Series' && !categoryItemsMap['TV Series']) {
      try {
        const res = await apiFetch(`${API_BASE}/api/content?endpoint=tv-series&page=1`);
        const data = await res.json();
        if (data && data.items) {
          setCategoryItemsMap(prev => ({ ...prev, 'TV Series': data.items }));
        }
      } catch (e) {}
    } else if (catId === 'Animation' && !categoryItemsMap['Animation']) {
      try {
        const res = await apiFetch(`${API_BASE}/api/content?endpoint=animation&page=1`);
        const data = await res.json();
        if (data && data.items) {
          setCategoryItemsMap(prev => ({ ...prev, Animation: data.items }));
        }
      } catch (e) {}
    }
  };

  // Handler for 'See More' on shelves: displays all items in responsive grid view
  const handleSeeMoreSection = (title, items) => {
    triggerHaptic('light');
    if (Array.isArray(items) && items.length > 0) {
      setCategoryItemsMap(prev => ({
        ...prev,
        [title]: items,
      }));
    }
    setHomeCategory(title);
    if (mainScrollRef.current?.scrollTo) {
      mainScrollRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  // Detail Modal State
  const [detailMovie, setDetailMovie] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailImdb, setDetailImdb] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const detailScrollRef = useRef(null);

  // Player State
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isIntroLoading, setIsIntroLoading] = useState(false);
  const [playerMovie, setPlayerMovie] = useState(null);
  const [playerImdb, setPlayerImdb] = useState(null);
  const [currentSe, setCurrentSe] = useState(0);
  const [currentEp, setCurrentEp] = useState(0);
  const [isSeries, setIsSeries] = useState(false);
  const [availableStreams, setAvailableStreams] = useState([]);
  const [activeStreamUrl, setActiveStreamUrl] = useState('');
  const [activeResolution, setActiveResolution] = useState('720p');
  const [availableCaptions, setAvailableCaptions] = useState([]);
  const [availableAudioVariants, setAvailableAudioVariants] = useState([]);
  const [playerResumeTime, setPlayerResumeTime] = useState(0);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const seriesSeasonsRef = useRef([]);
  const seriesSeasonsMovieIdRef = useRef(null);

  // Download Modal State
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadMovie, setDownloadMovie] = useState(null);
  const [downloadDetail, setDownloadDetail] = useState(null);
  const [downloadSeasonIdx, setDownloadSeasonIdx] = useState(0);
  const [downloadEpisodeNum, setDownloadEpisodeNum] = useState(1);
  const [selectedDownloadEps, setSelectedDownloadEps] = useState([1]);
  const [downloadQuality, setDownloadQuality] = useState('720p');
  const [downloadAudio, setDownloadAudio] = useState('Original Audio (Default)');
  const [downloadSubtitle, setDownloadSubtitle] = useState('None');
  const [downloadSources, setDownloadSources] = useState([]);
  const [downloadCaptions, setDownloadCaptions] = useState([]);
  const [loadingDownloadOptions, setLoadingDownloadOptions] = useState(false);

  // ─── Shots / Reels Feed State ─────────────────────────────────────────────
  // (Managed within ShotsFeedView component)

  // Toast Notification
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (message) => {
    if (!message) return;
    setToastMsg(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 3200);
  };

  // Sync Safe Local Storage & Notifications on Mount
  useEffect(() => {
    initSecureStorage().then(res => {
      if (res?.secure) setSecureStorageStatus("Hardware Keystore Verified");
      else setSecureStorageStatus("Encrypted Safe Storage");
    });
    initNotifications();
    if (Platform.OS === 'android') {
      exitFullscreenSystemBar();
    }
    preloadIntroVideoAsync();

    // Real-time native network connectivity detection
    const unsubscribeNetInfo = NetInfo.addEventListener((netState) => {
      const offline = netState.isConnected === false;
      setIsOffline(offline);
      if (!offline) {
        fetchContent();
      }
    });

    NetInfo.fetch().then((netState) => {
      const offline = netState.isConnected === false;
      setIsOffline(offline);
    }).catch(() => {});

    fetchContent();
    loadAllLocalData();

    // Only prompt for notifications and check for updates on native mobile (disabled on web)
    if (Platform.OS !== 'web') {
      AsyncStorage.getItem('@notification_prompt_answered').then((answered) => {
        if (!answered) {
          checkNotificationPermissionStatus().then((status) => {
            if (status !== 'granted') {
              setTimeout(() => {
                setShowNotificationPrompt(true);
              }, 1800);
            }
          }).catch(() => {});
        }
      }).catch(() => {});

      // Silent background update check after 3s (non-blocking)
      setTimeout(() => {
        checkForUpdateAsync().then((info) => {
          if (info && info.hasUpdate) {
            setUpdateInfo(info);
            // Auto-show update modal if a new version is available
            setIsUpdateModalOpen(true);
          } else if (info) {
            setUpdateInfo(info);
          }
        }).catch(() => {});
      }, 3000);
    }

    return () => {
      unsubscribeNetInfo();
    };
  }, []);

  const loadAllLocalData = async () => {
    try {
      const [hist, lst, dls] = await Promise.all([
        getWatchHistory(),
        getMyList(),
        getDownloads(),
      ]);
      setWatchHistory(hist || []);
      setMyList(lst || []);
      setDownloads(dls || []);
    } catch (e) {
      console.log("Local data load note:", e);
    }
  };

  const fetchContent = async (isRefresh = false) => {
    // 1. Instant load from local storage cache if available (first launch)
    if (!isRefresh) {
      try {
        const cached = await getHomeFeedCache();
        if (cached) {
          if (cached.trendingNow?.length > 0) setTrendingNow(cached.trendingNow);
          if (cached.latestReleases?.length > 0) setLatestReleases(cached.latestReleases);
          if (cached.netflixPopular?.length > 0) setNetflixPopular(cached.netflixPopular);
          if (cached.hindiMovies?.length > 0) setHindiMoviesList(cached.hindiMovies);
          if (cached.animeTrending?.length > 0) setAnimeTrending(cached.animeTrending);
          if (cached.animeLatest?.length > 0) setAnimeLatest(cached.animeLatest);
          if (cached.webSeriesLatest?.length > 0) setWebSeriesLatest(cached.webSeriesLatest);
          if (cached.cartoons?.length > 0) setCartoonsList(cached.cartoons);
          if (cached.heroList?.length > 0) setHeroList(cached.heroList);
          setLoading(false); // Render feed instantly with zero delay!
        }
      } catch (ce) {
        console.log("Cache load note:", ce);
      }
    }

    try {
      // 2. Fetch fresh, randomized content from the server
      const randMoviesPage1 = Math.floor(Math.random() * 50) + 1;
      let randMoviesPage2 = Math.floor(Math.random() * 50) + 1;
      while (randMoviesPage2 === randMoviesPage1) {
        randMoviesPage2 = Math.floor(Math.random() * 50) + 1;
      }
      const randSeriesPage1 = Math.floor(Math.random() * 40) + 1;
      let randSeriesPage2 = Math.floor(Math.random() * 40) + 1;
      while (randSeriesPage2 === randSeriesPage1) {
        randSeriesPage2 = Math.floor(Math.random() * 40) + 1;
      }
      const randAnimPage = Math.floor(Math.random() * 25) + 1;

      const results = await Promise.allSettled([
        apiFetch(`${API_BASE}/api/content?endpoint=home`),
        apiFetch(`${API_BASE}/api/content?endpoint=movies&page=${randMoviesPage1}`),
        apiFetch(`${API_BASE}/api/content?endpoint=movies&page=${randMoviesPage2}`),
        apiFetch(`${API_BASE}/api/content?endpoint=tv-series&page=${randSeriesPage1}`),
        apiFetch(`${API_BASE}/api/content?endpoint=tv-series&page=${randSeriesPage2}`),
        apiFetch(`${API_BASE}/api/content?endpoint=animation&page=${randAnimPage}`),
      ]);

      const parseResponse = async (settledResult) => {
        if (settledResult.status !== 'fulfilled' || !settledResult.value || !settledResult.value.ok) {
          return null;
        }
        try {
          return await settledResult.value.json();
        } catch (_) {
          return null;
        }
      };

      const [homeData, moviesData1, moviesData2, seriesData1, seriesData2, animData] = await Promise.all([
        parseResponse(results[0]),
        parseResponse(results[1]),
        parseResponse(results[2]),
        parseResponse(results[3]),
        parseResponse(results[4]),
        parseResponse(results[5]),
      ]);

      setIsOffline(false);

      // Section mapping from live home endpoint
      const serverSectionMap = {};
      if (homeData && Array.isArray(homeData.sections)) {
        const serverCats = [
          { id: 'All', label: 'All Titles', icon: 'sparkles' },
          { id: 'Movies', label: 'Movies', icon: 'film-outline', isApi: true, endpoint: '/movies' },
          { id: 'TV Series', label: 'TV Series', icon: 'tv-outline', isApi: true, endpoint: '/tv-series' },
          { id: 'Animation', label: 'Animation', icon: 'color-wand-outline', isApi: true, endpoint: '/animation' },
        ];
        const itemsMap = {};
        homeData.sections.forEach(s => {
          if (s.items && s.items.length > 0) {
            const normalizedItems = s.items.map(i => normalizeMovie(i)).filter(Boolean);
            serverSectionMap[s.section] = normalizedItems;
            if (s.section !== 'Banner') {
              const rawName = s.section;
              const clean = rawName.replace(/[🔥💓]/g, '').trim();
              serverCats.push({
                id: rawName,
                label: clean,
                icon: getCategoryIcon(rawName),
                itemCount: normalizedItems.length,
              });
              itemsMap[rawName] = normalizedItems;
            }
          }
        });
        setServerCategories(serverCats);
        setCategoryItemsMap(itemsMap);
      }

      // Helper to extract & normalize items from paginated responses
      const extractItems = (data, isSeries = false) => {
        if (!data || !Array.isArray(data.items)) return [];
        return data.items.map(item => normalizeMovie({ ...item, isSeries: isSeries || item.isSeries })).filter(Boolean);
      };

      const pageMovies1 = extractItems(moviesData1, false);
      const pageMovies2 = extractItems(moviesData2, false);
      const pageSeries1 = extractItems(seriesData1, true);
      const pageSeries2 = extractItems(seriesData2, true);
      const pageAnim = extractItems(animData, false);

      // Helper function: Fisher-Yates array shuffle
      const shuffleArray = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      // Helper function: Deduplicate list by slug or subject_id
      const dedupList = (list) => {
        const seen = new Set();
        const res = [];
        for (const item of list) {
          if (!item) continue;
          const key = item.slug || item.subject_id;
          if (key && !seen.has(key)) {
            seen.add(key);
            res.push(item);
          }
        }
        return res;
      };

      // 1. Hero List (Widget posters and requested image URLs)
      const newHero = CURATED_HERO_ITEMS;
      setHeroList(newHero);

      // 2. Trending Now (Popular Movies + fresh random movies)
      const popMovies = serverSectionMap['Popular Movie'] || [];
      const trendingPool = dedupList([...popMovies, ...pageMovies1, ...TRENDING_NOW]);
      const newTrending = shuffleArray(trendingPool).slice(0, 18);
      setTrendingNow(newTrending);

      // 3. Latest Releases (Random Movies 2 + Action Movies)
      const actionMovies = serverSectionMap['Action Movies'] || serverSectionMap['Action&Thriller'] || [];
      const latestPool = dedupList([...pageMovies2, ...actionMovies, ...LATEST_RELEASES]);
      const newLatest = shuffleArray(latestPool).slice(0, 18);
      setLatestReleases(newLatest);

      // 4. Netflix Popular (Popular Series + Random Series 1)
      const popSeries = serverSectionMap['Popular Series'] || [];
      const seriesPool = dedupList([...popSeries, ...pageSeries1, ...NETFLIX_POPULAR]);
      const newNetflix = shuffleArray(seriesPool).slice(0, 18);
      setNetflixPopular(newNetflix);

      // 5. Hindi & International (K-Drama, C-Drama, Nollywood, Bet+, Hindi Movies)
      const kdrama = serverSectionMap['K-Drama'] || [];
      const cdrama = serverSectionMap['C-Drama'] || [];
      const nollywood = serverSectionMap['Nollywood Movie'] || [];
      const betPlus = serverSectionMap['Bet+'] || [];
      const hindiPool = dedupList([...kdrama, ...cdrama, ...nollywood, ...betPlus, ...HINDI_MOVIES]);
      const newHindi = shuffleArray(hindiPool).slice(0, 18);
      setHindiMoviesList(newHindi);

      // 6. Anime Trending (Anime Dubbed + Random Animation)
      const animeDub = serverSectionMap['Anime[English Dubbed]'] || [];
      const animeTrendPool = dedupList([...animeDub, ...pageAnim, ...ANIME_TRENDING]);
      const newAnimeTrend = shuffleArray(animeTrendPool).slice(0, 18);
      setAnimeTrending(newAnimeTrend);

      // 7. Latest Anime (Adult Animation + Teen Fantasy + Anime Latest)
      const adultAnim = serverSectionMap['Adult Animation'] || [];
      const teenFantasy = serverSectionMap['Teen Fantasy'] || [];
      const animeLatePool = dedupList([...adultAnim, ...teenFantasy, ...ANIME_LATEST]);
      const newAnimeLate = shuffleArray(animeLatePool).slice(0, 18);
      setAnimeLatest(newAnimeLate);

      // 8. Web Series (Superhero Series + Hot Short TV + Random Series 2)
      const superHero = serverSectionMap['Superhero Series'] || [];
      const shortTv = serverSectionMap['🔥Hot Short TV'] || [];
      const webSeriesPool = dedupList([...superHero, ...shortTv, ...pageSeries2, ...WEBSERIES_LATEST]);
      const newWebSeries = shuffleArray(webSeriesPool).slice(0, 18);
      setWebSeriesLatest(newWebSeries);

      // 9. Cartoons & Family (Sitcom, Epic Fantasy, Cartoons)
      const sitcom = serverSectionMap['Sitcom'] || [];
      const fantasy = serverSectionMap['Epic Fantasy'] || [];
      const cartoonPool = dedupList([...sitcom, ...fantasy, ...CARTOONS]);
      const newCartoons = shuffleArray(cartoonPool).slice(0, 18);
      setCartoonsList(newCartoons);

      // Master catalog pool for recommendations and explore grid (hundreds of items!)
      const masterItems = [];
      Object.values(serverSectionMap).forEach(arr => {
        if (Array.isArray(arr)) masterItems.push(...arr);
      });
      masterItems.push(...pageMovies1, ...pageMovies2, ...pageSeries1, ...pageSeries2, ...pageAnim);
      masterItems.push(
        ...TRENDING_NOW,
        ...LATEST_RELEASES,
        ...NETFLIX_POPULAR,
        ...HINDI_MOVIES,
        ...ANIME_TRENDING,
        ...ANIME_LATEST,
        ...WEBSERIES_LATEST,
        ...CARTOONS
      );

      const uniqueMasterPool = dedupList(masterItems);
      const shuffledMaster = shuffleArray(uniqueMasterPool);
      catalogPoolRef.current = shuffledMaster;

      // Pick first 15 randomized unshown items for Explore Grid
      const initialBatch = shuffledMaster.slice(0, 15);
      shownSlugsRef.current = new Set(initialBatch.map(i => i.slug || i.subject_id));
      setExploreGridList(initialBatch);
      setExploreVisibleCount(15);

      // Persist to local storage for instant loading on next app launch
      await saveHomeFeedCache({
        trendingNow: newTrending,
        latestReleases: newLatest,
        netflixPopular: newNetflix,
        hindiMovies: newHindi,
        animeTrending: newAnimeTrend,
        animeLatest: newAnimeLate,
        webSeriesLatest: newWebSeries,
        cartoons: newCartoons,
        heroList: newHero,
      });
    } catch (e) {
      console.error("Home feed fetch error:", e);
      NetInfo.fetch().then((netState) => {
        if (netState.isConnected === false) {
          setIsOffline(true);
        }
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchContent(true);
    } catch (_) {}
    setRefreshing(false);
  }, []);

  // Search Handler
  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (!text || text.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/content?endpoint=search&q=${encodeURIComponent(text.trim())}`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Open Detail Modal
  const openDetail = async (rawMovie, syncHistory = true) => {
    if (!rawMovie) return;
    const movie = normalizeMovie(rawMovie);
    setDetailMovie(movie);
    setLoadingDetail(true);
    setDetailData(null);
    setDetailImdb(null);
    setSelectedSeasonIdx(0);

    // Smoothly scroll detail modal to top when opening or switching movies
    if (detailScrollRef.current?.scrollTo) {
      detailScrollRef.current.scrollTo({ y: 0, animated: false });
    }

    // Sync Web URL slug immediately
    if (syncHistory && Platform.OS === 'web') {
      const isSeriesTitle = Boolean(movie?.isSeries || movie?.subjectType === 2);
      const slug = getMovieSlug(movie);
      const prefix = isSeriesTitle ? '/tv' : '/movie';
      navigateWeb(`${prefix}/${slug}`);
    }

    // Fetch free IMDb ratings & cast asynchronously
    getImdbData(movie?.name).then(setDetailImdb).catch(() => {});

    // Compute fresh related titles (not same, excluding current movie)
    const currentSlug = movie?.slug || '';
    const currentId = String(movie?.subject_id || '');

    const isAnime = ANIME_TRENDING.some(a => a.slug === currentSlug) ||
                    ANIME_LATEST.some(a => a.slug === currentSlug) ||
                    /anime|demon|slayer|jojo|piece|bleach|kaisen|naruto|atelier|dan/i.test(movie?.name || '');
    const isHindi = HINDI_MOVIES.some(h => h.slug === currentSlug) || /hindi|bollywood|rrr|lust|dhamaal|pushpa/i.test(movie?.name || '');
    const isCartoon = CARTOONS.some(c => c.slug === currentSlug) || /cartoon|panda|lego|sponge|dragon|toy/i.test(movie?.name || '');
    const isSeries = Boolean(movie?.isSeries);

    let priorityPool = [];
    let secondaryPool = [];

    if (isAnime) {
      priorityPool = [...ANIME_TRENDING, ...ANIME_LATEST];
      secondaryPool = [...CARTOONS, ...NETFLIX_POPULAR];
    } else if (isHindi) {
      priorityPool = [...HINDI_MOVIES, ...TRENDING_NOW];
      secondaryPool = [...LATEST_RELEASES, ...WEBSERIES_LATEST];
    } else if (isCartoon) {
      priorityPool = [...CARTOONS];
      secondaryPool = [...ANIME_TRENDING, ...LATEST_RELEASES];
    } else if (isSeries) {
      priorityPool = [...NETFLIX_POPULAR, ...WEBSERIES_LATEST];
      secondaryPool = [...TRENDING_NOW, ...HINDI_MOVIES];
    } else {
      priorityPool = [...LATEST_RELEASES, ...TRENDING_NOW, ...HINDI_MOVIES];
      secondaryPool = [...WEBSERIES_LATEST, ...CARTOONS];
    }

    // Vectorized Content-Based Recommendation (Cosine Similarity + Genre Alignment)
    const fullCatalogPool = [
      ...priorityPool,
      ...secondaryPool,
      ...trendingNow,
      ...latestReleases,
      ...netflixPopular,
      ...hindiMoviesList,
      ...animeTrending,
      ...animeLatest,
      ...webSeriesLatest,
      ...cartoonsList,
      ...(catalogPoolRef.current || []),
    ];

    const recommendedList = getContentBasedRecommendations({
      targetMovie: movie,
      catalog: fullCatalogPool,
      limit: 10,
    });

    setRelatedTitles(recommendedList.map((item) => normalizeMovie(item)));

    try {
      const res = await apiFetch(`${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(movie.slug)}`);
      const data = await res.json();
      const subject = data?.data?.subject || null;
      const resource = data?.data?.resource || null;
      const seasons = resource?.seasons || [];

      // Extract and parse available audio dubs and sibling languages
      const rawDubs = data?.dubs || data?.deep_metadata?.dubs || subject?.dubs || [];
      const parsedDubs = Array.isArray(rawDubs) ? rawDubs.map((d) => {
        const subId = String(d.subjectId || d.subject_id || d.id || '');
        const slug = String(d.detailPath || d.detail_path || d.slug || '');
        const rawLan = String(d.lanName || d.language || d.title || 'Audio Dub');
        const type = typeof d.type === 'number' ? d.type : 0;
        let label = d.label || '';
        if (!label) {
          const lLower = rawLan.toLowerCase();
          if (lLower.includes('original')) label = 'Original Audio';
          else if (lLower.includes('esla')) label = 'Spanish (Latin America) Dub';
          else if (lLower.includes('ptbr')) label = 'Portuguese (Brazil) Dub';
          else {
            const clean = rawLan.replace(/\s*(dub|sub)\b/gi, '').trim();
            label = type === 1 ? `${clean} (Sub Release)` : `${clean} Dub`;
          }
        }
        return {
          subject_id: subId,
          slug,
          detail_path: slug,
          language: rawLan,
          label,
          type,
          name: `${movie.name || 'Title'} (${label})`,
          isCurrent: (subId && subId === String(movie.subject_id)) || (slug && slug === String(movie.slug)),
        };
      }) : [];

      // Extract and parse multi-language subtitles list
      const rawSubs = data?.subtitles || data?.deep_metadata?.subtitles || (typeof subject?.subtitles === 'string' ? subject.subtitles.split(',').map(s => s.trim()).filter(Boolean) : []);
      const parsedSubs = Array.isArray(rawSubs) ? rawSubs.map(s => typeof s === 'string' ? s.trim() : (s.lanName || s.lan || '')).filter(Boolean) : [];

      // A title is strictly a series if subjectType == 2 OR it has multiple seasons/episodes
      const isRealSeries = (subject?.subjectType === 2) ||
        (seasons.length > 1) ||
        (seasons[0]?.se > 0) ||
        (seasons[0]?.maxEp > 1) ||
        Boolean(seasons[0]?.allEp && seasons[0].allEp.includes(','));

      const mergedData = {
        ...subject,
        resource,
        seasons,
        dubs: parsedDubs,
        subtitles: parsedSubs,
        audios: data?.deep_metadata?.audios || subject?.audios || null,
        isSeries: Boolean(isRealSeries),
      };
      setDetailData(mergedData);
      if (Array.isArray(seasons) && seasons.length > 0) {
        seriesSeasonsRef.current = seasons;
        seriesSeasonsMovieIdRef.current = movie.subject_id;
      }

      // Merge newly resolved fields back into detailMovie so title/poster/dubs/etc. are fully loaded
      setDetailMovie((prev) => normalizeMovie({ ...(prev || {}), ...subject, ...mergedData, dubs: parsedDubs, subtitles: parsedSubs, slug: movie.slug }));

      // Update URL with confirmed prefix if series vs movie was determined
      if (syncHistory && Platform.OS === 'web') {
        const slug = getMovieSlug(movie);
        const prefix = isRealSeries ? '/tv' : '/movie';
        navigateWeb(`${prefix}/${slug}`, true);
      }
    } catch (err) {
      console.error("Detail fetch error:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Close Detail Modal & Synchronize Web Route
  const closeDetail = (syncHistory = true) => {
    setDetailMovie(null);
    setDetailData(null);
    setDetailImdb(null);
    if (syncHistory && Platform.OS === 'web') {
      const target = mainTab === 'Me'
        ? (meSubTab ? `/me/${meSubTab.toLowerCase()}` : '/me')
        : (homeCategory === 'Movies' ? '/movies' : (homeCategory === 'TV Series' || homeCategory === 'Series') ? '/series' : '/');
      navigateWeb(target, true);
    }
  };

  // Launch Player with automatic resilient stream recovery, resume support, and offline local file support
  const launchPlayer = async (
    rawMovie,
    se = 0,
    ep = 0,
    seriesFlag = false,
    resumeTime = 0,
    offlineVideoUrl = null,
    offlineSubUrl = null,
    syncHistory = true,
    skipIntro = false
  ) => {
    if (!rawMovie) return;
    const movie = normalizeMovie(rawMovie);

    // Auth gate: redirect to /auth page if not logged in
    if (!authUserRef.current) {
      pendingPlayRef.current = {
        rawMovie, se, ep, seriesFlag, resumeTime, offlineVideoUrl, offlineSubUrl, syncHistory,
      };
      openAuthPage('login');
      return;
    }

    if (!offlineVideoUrl && isOffline) {
      showToast('You are offline. Connect to internet to stream, or watch your downloads in Me > Downloads!');
      return;
    }

    const isRealSeries = Boolean(seriesFlag || se > 0 || ep > 0 || movie?.isSeries || movie?.subjectType === 2);

    setPlayerMovie(movie);
    setPlayerImdb(null);
    getImdbData(movie?.name).then(setPlayerImdb).catch(() => {});
    setCurrentSe(se);
    setCurrentEp(ep);
    setIsSeries(isRealSeries);

    // Pre-fetch seasons in background if missing for series
    if (isRealSeries && movie?.slug && (!seriesSeasonsRef.current?.length || seriesSeasonsMovieIdRef.current !== movie.subject_id)) {
      apiFetch(`${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(movie.slug || movie.subject_id)}`)
        .then(r => r.json())
        .then(d => {
          const fetched = d?.data?.resource?.seasons || [];
          if (fetched.length > 0) {
            seriesSeasonsRef.current = fetched;
            seriesSeasonsMovieIdRef.current = movie.subject_id;
          }
        })
        .catch(() => {});
    }

    if (Platform.OS === 'web' || skipIntro) {
      setIsIntroLoading(false);
      setIsPlayerOpen(true);
    } else {
      setIsPlayerOpen(false);
      setIsIntroLoading(true);
    }
    setLoadingStream(!offlineVideoUrl);
    setStreamError(null);
    setAvailableStreams([]);
    setActiveStreamUrl(offlineVideoUrl || '');
    setAvailableCaptions([]);
    setAvailableAudioVariants([]);
    setPlayerResumeTime(resumeTime || 0);

    // Sync Web URL to /watch/:slug
    if (syncHistory && Platform.OS === 'web') {
      const slug = getMovieSlug(movie);
      const query = (seriesFlag || se > 0 || ep > 0) ? `?season=${se}&episode=${ep}` : '';
      navigateWeb(`/watch/${slug}${query}`);
    }

    enterFullscreenSystemBar();

    // Smooth landscape transition without sudden screen flash (mobile only)
    if (Platform.OS !== 'web') {
      setTimeout(() => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((e) => {
          console.log("Landscape lock note:", e);
        });
        enterFullscreenSystemBar();
      }, 150);
    }

    if (offlineVideoUrl) {
      if (offlineSubUrl) {
        setAvailableCaptions([{
          lan: 'local',
          lanName: 'Downloaded Subtitle',
          url: offlineSubUrl,
        }]);
      }
      setLoadingStream(false);
      return;
    }

    try {
      // 1. Fetch Streams with automatic fallback between movie and series modes
      let streamData = null;
      let effectiveSe = se;
      let effectiveEp = ep;

      const primaryUrl = `${API_BASE}/api/content?endpoint=stream&id=${encodeURIComponent(movie.subject_id)}&detail_path=${encodeURIComponent(movie.slug)}&se=${effectiveSe}&ep=${effectiveEp}`;
      const res = await apiFetch(primaryUrl);
      streamData = await res.json();

      // If no stream found, try automatic recovery:
      if (!streamData?.sources || streamData.sources.length === 0) {
        if (effectiveSe > 0 || effectiveEp > 0) {
          // If called as series (se>0/ep>0) but has no stream, try movie mode (se=0, ep=0)
          try {
            const fbUrl = `${API_BASE}/api/content?endpoint=stream&id=${encodeURIComponent(movie.subject_id)}&detail_path=${encodeURIComponent(movie.slug)}&se=0&ep=0`;
            const fbRes = await apiFetch(fbUrl);
            const fbData = await fbRes.json();
            if (fbData?.sources && fbData.sources.length > 0) {
              streamData = fbData;
              effectiveSe = 0;
              effectiveEp = 0;
              setCurrentSe(0);
              setCurrentEp(0);
              setIsSeries(false);
            }
          } catch (fe) {}
        } else {
          // If called as movie (se=0, ep=0) but has no stream, try series mode (se=1, ep=1)
          try {
            const fbUrl2 = `${API_BASE}/api/content?endpoint=stream&id=${encodeURIComponent(movie.subject_id)}&detail_path=${encodeURIComponent(movie.slug)}&se=1&ep=1`;
            const fbRes2 = await apiFetch(fbUrl2);
            const fbData2 = await fbRes2.json();
            if (fbData2?.sources && fbData2.sources.length > 0) {
              streamData = fbData2;
              effectiveSe = 1;
              effectiveEp = 1;
              setCurrentSe(1);
              setCurrentEp(1);
              setIsSeries(true);
            }
          } catch (fe2) {}
        }
      }

      if (streamData && streamData.sources && streamData.sources.length > 0) {
        setAvailableStreams(streamData.sources);
        const preferred = streamData.sources.find(s => s.resolution === '720p') ||
                          streamData.sources.find(s => s.resolution === '1080p') ||
                          streamData.sources[0];
        setActiveStreamUrl(preferred.url);
        setActiveResolution(preferred.resolution);
        setLoadingStream(false);
      } else {
        setStreamError(
          seriesFlag
            ? `No stream found for Season ${effectiveSe}, Episode ${effectiveEp}.`
            : "No direct stream link found for this title."
        );
        setLoadingStream(false);
      }

      // 2. Fetch Subtitles/Captions and Audio Variants in the background without blocking stream playback
      (async () => {
        try {
          let allCaptions = [];
          const seenLans = new Set();
          const capUrl = `${API_BASE}/api/content?endpoint=captions&id=${encodeURIComponent(movie.subject_id)}&detail_path=${encodeURIComponent(movie.slug)}&se=${effectiveSe}&ep=${effectiveEp}&title=${encodeURIComponent(movie.name || '')}`;
          const capRes = await apiFetch(capUrl);
          const capData = await capRes.json();
          if (capData && Array.isArray(capData.captions)) {
            for (const c of capData.captions) {
              const key = c.lanName || c.lan;
              if (key && !seenLans.has(key)) {
                seenLans.add(key);
                allCaptions.push(c);
              }
            }
          }

          // Fallback to parsed metadata subtitles if captions endpoint returned empty
          if (allCaptions.length === 0) {
            const rawSubs = Array.isArray(movie.subtitles) ? movie.subtitles : (Array.isArray(detailData?.subtitles) ? detailData.subtitles : []);
            for (const s of rawSubs) {
              const key = typeof s === 'string' ? s : (s.lanName || s.lan);
              if (key && !seenLans.has(key)) {
                seenLans.add(key);
                allCaptions.push(typeof s === 'string' ? { lan: key.toLowerCase().slice(0, 3), lanName: key, url: null } : s);
              }
            }
          }

          // 2. Extract real audio dub variants directly from MovieBox detail
          let rawDubs = (Array.isArray(movie.dubs) && movie.dubs.length > 0)
            ? movie.dubs
            : (detailData?.slug === movie.slug && Array.isArray(detailData?.dubs) && detailData.dubs.length > 0)
              ? detailData.dubs
              : null;

          if (!rawDubs || rawDubs.length === 0) {
            try {
              const dRes = await apiFetch(`${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(movie.slug || movie.subject_id)}`);
              const dData = await dRes.json();
              rawDubs = dData?.dubs || dData?.data?.subject?.dubs || [];
            } catch (de) {
              console.log("Audio dubs fetch note:", de);
            }
          }

          const detectedVariants = [];
          const seenDubKeys = new Set();

          if (Array.isArray(rawDubs) && rawDubs.length > 0) {
            for (const d of rawDubs) {
              const subId = String(d.subject_id || d.subjectId || d.id || '');
              const slg = String(d.slug || d.detail_path || d.detailPath || '');
              const rawLan = String(d.language || d.lanName || d.title || 'Audio Dub');
              const dType = typeof d.type === 'number' ? d.type : 0;

              // Only include audio dubs (type 0) in the audio selector
              if (dType === 1) {
                // If this is a subtitle release, add its language to captions if missing
                const subLan = rawLan.replace(/\s*sub\b/gi, '').trim();
                if (subLan && !seenLans.has(subLan)) {
                  seenLans.add(subLan);
                  allCaptions.push({
                    lan: subLan.toLowerCase().slice(0, 3),
                    lanName: `${subLan} (Release)`,
                    subject_id: subId,
                    detailPath: slg,
                  });
                }
                continue;
              }

              let label = d.label || '';
              if (!label) {
                const lLower = rawLan.toLowerCase();
                if (lLower.includes('original')) label = 'Original Audio';
                else if (lLower.includes('esla')) label = 'Spanish (Latin America) Dub';
                else if (lLower.includes('ptbr')) label = 'Portuguese (Brazil) Dub';
                else {
                  const clean = rawLan.replace(/\s*(dub|sub)\b/gi, '').trim();
                  label = `${clean} Dub`;
                }
              }

              const isCurrent = (subId && subId === String(movie.subject_id)) || (slg && slg === String(movie.slug));
              const key = label || slg || subId;
              if (key && !seenDubKeys.has(key)) {
                seenDubKeys.add(key);
                detectedVariants.push({
                  label,
                  name: `${movie.name || 'Title'} (${label})`,
                  subject_id: subId || movie.subject_id,
                  slug: slg || movie.slug,
                  isCurrent,
                });
              }
            }
          }

          // If current stream not yet marked, find original audio or prepend default
          if (!detectedVariants.some(v => v.isCurrent)) {
            const orig = detectedVariants.find(v => v.label.toLowerCase().includes('original'));
            if (orig) {
              orig.isCurrent = true;
            } else {
              detectedVariants.unshift({
                label: 'Original Audio (Default)',
                name: movie.name || 'Current Stream',
                subject_id: movie.subject_id,
                slug: movie.slug,
                isCurrent: true,
              });
            }
          }

          setAvailableAudioVariants(detectedVariants);

          setAvailableCaptions(allCaptions);
        } catch (ce) {
          console.log("Captions fetch skipped:", ce);
        }
      })();
    } catch (err) {
      console.error("Stream extraction error:", err);
      setStreamError("Failed to connect to stream server.");
    } finally {
      setLoadingStream(false);
    }
  };

  // Seamless Audio Dub Switching with position retention
  const switchAudioDub = async (variant, resumeTime = 0) => {
    if (!variant || variant.slug === playerMovie?.slug) return;
    setLoadingStream(true);
    try {
      const url = `${API_BASE}/api/content?endpoint=stream&id=${encodeURIComponent(variant.subject_id)}&detail_path=${encodeURIComponent(variant.slug)}&se=${currentSe}&ep=${currentEp}`;
      const res = await apiFetch(url);
      const data = await res.json();
      if (data && data.sources && data.sources.length > 0) {
        setAvailableStreams(data.sources);
        const preferred = data.sources.find(s => s.resolution === activeResolution) ||
                          data.sources.find(s => s.resolution === '720p') ||
                          data.sources[0];
        setPlayerResumeTime(resumeTime);
        setActiveStreamUrl(preferred.url);
        setPlayerMovie(prev => ({
          ...prev,
          subject_id: variant.subject_id,
          slug: variant.slug,
          name: variant.name || prev?.name,
        }));
      }
    } catch (e) {
      console.warn("Failed to switch audio dub:", e);
    } finally {
      setLoadingStream(false);
    }
  };

  // Save watch progress to local safe storage during playback
  const lastSaveHistoryRef = useRef(0);
  const handlePlayerProgressUpdate = (currentTime, duration) => {
    if (!playerMovie || !duration || duration <= 0) return;
    const now = Date.now();
    if (now - lastSaveHistoryRef.current > 4000) {
      lastSaveHistoryRef.current = now;
      saveWatchProgress({
        movie: playerMovie,
        isSeries,
        se: currentSe,
        ep: currentEp,
        positionMillis: currentTime * 1000,
        durationMillis: duration * 1000,
      }).then(() => {
        getWatchHistory().then(setWatchHistory);
      });
    }
  };

  // Close Player & Restore Portrait
  const closePlayer = async (syncHistory = true) => {
    setIsIntroLoading(false);
    setIsPlayerOpen(false);
    if (Platform.OS !== 'web') {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (e) {
        console.log("Portrait restore error:", e);
      }
    } else {
      if (typeof document !== 'undefined' && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          }
          if (window.screen?.orientation?.unlock) {
            window.screen.orientation.unlock();
          }
        } catch (e) {
          console.log("Web exit fullscreen error:", e);
        }
      }
    }
    exitFullscreenSystemBar();
    // Refresh watch history immediately on exit
    getWatchHistory().then(setWatchHistory).catch(() => {});

    // Sync Web URL back to movie detail or previous tab
    if (syncHistory && Platform.OS === 'web') {
      if (detailMovie) {
        const isSeriesTitle = Boolean(detailMovie.isSeries || detailData?.isSeries || detailMovie.subjectType === 2);
        const slug = getMovieSlug(detailMovie);
        const prefix = isSeriesTitle ? '/tv' : '/movie';
        navigateWeb(`${prefix}/${slug}`, true);
      } else if (mainTab === 'Me') {
        const sub = meSubTab ? `/me/${meSubTab.toLowerCase()}` : '/me';
        navigateWeb(sub, true);
      } else {
        const cat = homeCategory === 'Movies' ? '/movies' : (homeCategory === 'TV Series' || homeCategory === 'Series') ? '/series' : '/';
        navigateWeb(cat, true);
      }
    }
  };

  // Switch Video Quality
  const switchQuality = (source) => {
    if (source.url === activeStreamUrl) return;
    setActiveResolution(source.resolution);
    setActiveStreamUrl(source.url);
  };

  // Play Next Episode
  const isSwitchingEpisodeRef = useRef(false);
  const playNextEpisode = async () => {
    if (isSwitchingEpisodeRef.current) return;
    isSwitchingEpisodeRef.current = true;
    setTimeout(() => { isSwitchingEpisodeRef.current = false; }, 1200);

    const movie = playerMovie || detailMovie;
    if (!movie) return;

    triggerHaptic('light');

    const isRealSeries = Boolean(
      isSeries || currentSe > 0 || currentEp > 0 || movie.isSeries || movie.subjectType === 2
    );
    if (!isRealSeries) return;

    const activeSe = currentSe || 1;
    const activeEp = currentEp || 1;

    // 1. Get seasons list from ref, detailData, or fetch on demand
    let seasons = null;
    const isIdMatch = seriesSeasonsMovieIdRef.current && (seriesSeasonsMovieIdRef.current === movie.subject_id || seriesSeasonsMovieIdRef.current === movie.slug);
    if (isIdMatch && seriesSeasonsRef.current?.length > 0) {
      seasons = seriesSeasonsRef.current;
    } else if (detailData?.seasons?.length > 0 && (detailMovie?.slug === movie.slug || detailMovie?.subject_id === movie.subject_id)) {
      seasons = detailData.seasons;
    }

    if (!seasons || seasons.length === 0) {
      try {
        const res = await apiFetch(
          `${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(movie.slug || movie.subject_id)}`
        );
        const data = await res.json();
        const fetched = data?.data?.resource?.seasons || [];
        if (fetched.length > 0) {
          seasons = fetched;
          seriesSeasonsRef.current = fetched;
          seriesSeasonsMovieIdRef.current = movie.subject_id || movie.slug;
        }
      } catch (err) {
        console.warn('Seasons lookup failed:', err);
      }
    }

    let nextSe = activeSe;
    let nextEp = activeEp + 1;

    if (Array.isArray(seasons) && seasons.length > 0) {
      // Find active season by season number `se`
      const curSeasonIdx = seasons.findIndex((s) => s.se === activeSe);
      const activeSeasonIdx = curSeasonIdx >= 0 ? curSeasonIdx : 0;
      const curSeasonObj = seasons[activeSeasonIdx];
      const episodes = getEpisodesArray(curSeasonObj);

      const curEpIdx = episodes.indexOf(activeEp);
      if (curEpIdx >= 0 && curEpIdx + 1 < episodes.length) {
        // Next episode in the same season
        nextEp = episodes[curEpIdx + 1];
        nextSe = curSeasonObj.se || activeSe;
      } else if (activeSeasonIdx + 1 < seasons.length) {
        // Next season!
        const nextSeasonObj = seasons[activeSeasonIdx + 1];
        nextSe = nextSeasonObj.se || (activeSe + 1);
        const nextEpisodes = getEpisodesArray(nextSeasonObj);
        nextEp = nextEpisodes[0] || 1;
        setSelectedSeasonIdx(activeSeasonIdx + 1);
      } else {
        // Reached the end of all available episodes
        showToast("You've reached the latest episode!");
        return;
      }
    }

    showToast(`Playing Season ${nextSe} · Episode ${nextEp}...`);
    launchPlayer(movie, nextSe, nextEp, true, 0, null, null, true, true);
  };

  // =====================================================
  // WEB URL SLUG ROUTING & BROWSER HISTORY SYNCHRONIZATION
  // Prevents blank screens on back navigation & direct URLs
  // =====================================================

  // 1. Sync Web URL with Main Tabs only when browsing known hub tabs
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (is404PageOpen || detailMovie || isPlayerOpen || isIntroLoading || isAuthPageOpen || isPrivacyPageOpen || isDownloadPageOpen) return;

    const currentUrl = window.location.pathname || '/';

    // Strictly check if current URL is a known tab URL before synchronizing
    const isTabRoute =
      currentUrl === '/' ||
      currentUrl === '/movies' ||
      currentUrl === '/series' ||
      currentUrl === '/tv' ||
      currentUrl === '/animation' ||
      currentUrl === '/shots' ||
      currentUrl === '/reels' ||
      currentUrl.startsWith('/me');

    if (!isTabRoute) return;

    let targetUrl = '/';
    if (mainTab === 'Me') {
      if (meSubTab === 'History') targetUrl = '/me/history';
      else if (meSubTab === 'MyList') targetUrl = '/me/mylist';
      else if (meSubTab === 'Downloads') targetUrl = '/me/downloads';
      else targetUrl = '/me';
    } else if (mainTab === 'Shots') {
      targetUrl = '/shots';
    } else {
      if (homeCategory === 'Movies') targetUrl = '/movies';
      else if (homeCategory === 'TV Series' || homeCategory === 'Series') targetUrl = '/series';
      else if (homeCategory === 'Animation') targetUrl = '/animation';
      else targetUrl = '/';
    }

    if (currentUrl !== targetUrl) {
      navigateWeb(targetUrl);
    }
  }, [mainTab, homeCategory, meSubTab, detailMovie, isPlayerOpen, isIntroLoading, isAuthPageOpen, isPrivacyPageOpen, isDownloadPageOpen, is404PageOpen]);

  // ─── DYNAMIC SEO & SOCIAL SHARING META TAGS ──────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    if (is404PageOpen) {
      updateWebMetaTags(
        '404 - Page Not Found | MovieFlix',
        'The page you are looking for does not exist on MovieFlix. Browse thousands of free movies and TV shows or download our Android APK.',
        'https://movieflix-pi-six.vercel.app/assets/og-banner.png',
        typeof window !== 'undefined' ? window.location.href : 'https://movieflix-pi-six.vercel.app/404'
      );
    } else if (isDownloadPageOpen) {
      updateWebMetaTags(
        'Download MovieFlix Android APK (v1.1.6) - Free Movies & TV Shows',
        'Download the official MovieFlix Android app. Stream & download movies and series in 4K/1080p offline with zero ads.',
        'https://movieflix-pi-six.vercel.app/assets/og-banner.png',
        'https://movieflix-pi-six.vercel.app/download'
      );
    } else if (isPrivacyPageOpen) {
      updateWebMetaTags(
        'Privacy Policy - MovieFlix',
        'MovieFlix is built on zero tracking, zero personal data collection, and 100% user privacy. Read our transparent privacy policy.',
        'https://movieflix-pi-six.vercel.app/assets/og-banner.png',
        'https://movieflix-pi-six.vercel.app/privacy'
      );
    } else if (detailMovie) {
      const title = `${detailMovie.name || 'Movie'} - Watch & Download Free on MovieFlix`;
      const desc = detailMovie.desc || `Watch ${detailMovie.name || 'this title'} in full HD with subtitles and multi-audio on MovieFlix. 100% free streaming.`;
      const img = detailMovie.poster_url || 'https://movieflix-pi-six.vercel.app/assets/og-banner.png';
      const url = `https://movieflix-pi-six.vercel.app/movie/${encodeURIComponent(detailMovie.slug || 'watch')}`;
      updateWebMetaTags(title, desc, img, url);
    } else {
      updateWebMetaTags(
        'MovieFlix - Watch & Download Free Movies, TV Series & Official APK (v1.1.6)',
        'Stream and download thousands of HD movies, web series, Hindi dubbed blockbusters, and anime in 4K/1080p with zero ads. Download the official MovieFlix Android APK.',
        'https://movieflix-pi-six.vercel.app/assets/og-banner.png',
        'https://movieflix-pi-six.vercel.app/'
      );
    }
  }, [isDownloadPageOpen, isPrivacyPageOpen, is404PageOpen, detailMovie]);

  // 2. Handle Web Browser Back / Forward History (popstate)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const findMovieBySlug = (slug) => {
      if (!slug) return null;
      const lower = slug.toLowerCase();

      // Check active detailMovie or playerMovie first
      if (detailMovie) {
        const dSlug = (detailMovie.slug || '').toLowerCase();
        const dId = String(detailMovie.subject_id || '').toLowerCase();
        if (dSlug === lower || getMovieSlug(detailMovie).toLowerCase() === lower || dId === lower) {
          return detailMovie;
        }
      }
      if (playerMovie) {
        const pSlug = (playerMovie.slug || '').toLowerCase();
        const pId = String(playerMovie.subject_id || '').toLowerCase();
        if (pSlug === lower || getMovieSlug(playerMovie).toLowerCase() === lower || pId === lower) {
          return playerMovie;
        }
      }

      const allItems = [
        ...heroList,
        ...trendingNow,
        ...latestReleases,
        ...netflixPopular,
        ...hindiMoviesList,
        ...animeTrending,
        ...animeLatest,
        ...webSeriesLatest,
        ...cartoonsList,
        ...exploreGridList,
        ...myList,
        ...watchHistory.map((w) => w.movie).filter(Boolean),
      ];

      // 1. Exact slug or getMovieSlug match
      const exact = allItems.find(
        (i) => i.slug === slug || (i.slug && i.slug.toLowerCase() === lower) || getMovieSlug(i).toLowerCase() === lower
      );
      if (exact) return exact;

      // 2. Slug ending with subject_id (e.g. east-of-eden-eHk1HP0pn3a)
      const slugParts = slug.split('-');
      const possibleId = slugParts[slugParts.length - 1];
      if (possibleId && possibleId.length >= 4) {
        const idMatch = allItems.find(
          (i) => String(i.subject_id || '').toLowerCase() === possibleId.toLowerCase()
        );
        if (idMatch) return idMatch;
      }

      // 3. Partial slug or name match
      const partial = allItems.find((i) => {
        const iSlug = (i.slug || '').toLowerCase();
        const iName = (i.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return (iSlug && lower.includes(iSlug)) || (iName && lower.includes(iName));
      });
      if (partial) return partial;

      return null;
    };

    const handlePopState = async () => {
      const pathname = window.location.pathname || '/';
      const search = window.location.search || '';

      // Route: /auth
      if (pathname.startsWith('/auth')) {
        setIsDownloadPageOpen(false);
        setIsPrivacyPageOpen(false);
        setIs404PageOpen(false);
        setIsAuthPageOpen(true);
        return;
      } else {
        setIsAuthPageOpen(false);
      }

      // Route: /privacy
      if (pathname.startsWith('/privacy')) {
        setIsDownloadPageOpen(false);
        setIsAuthPageOpen(false);
        setIs404PageOpen(false);
        setIsPrivacyPageOpen(true);
        return;
      } else {
        setIsPrivacyPageOpen(false);
      }

      // Route: /download
      if (pathname.startsWith('/download')) {
        setIsAuthPageOpen(false);
        setIsPrivacyPageOpen(false);
        setIs404PageOpen(false);
        setIsDownloadPageOpen(true);
        return;
      } else {
        setIsDownloadPageOpen(false);
      }

      // Route: /telegram
      if (pathname.startsWith('/telegram')) {
        try {
          if (typeof window !== 'undefined') {
            window.location.href = 'https://t.me/movieflixlol';
          }
        } catch (_) {}
        return;
      }

      // Route: /watch/:slug
      if (pathname.startsWith('/watch/')) {
        const slug = pathname.replace('/watch/', '').split('/')[0];
        const params = new URLSearchParams(search);
        const se = parseInt(params.get('season') || params.get('se') || '0', 10);
        const ep = parseInt(params.get('episode') || params.get('ep') || '0', 10);

        let movie = findMovieBySlug(slug);
        if (!movie) {
          try {
            const res = await apiFetch(`${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(slug)}`);
            const data = await res.json();
            if (data?.data?.subject) {
              movie = normalizeMovie({ ...data.data.subject, slug });
            }
          } catch (e) {}
        }
        if (movie) {
          launchPlayer(normalizeMovie(movie), se, ep, se > 0 || ep > 0 || Boolean(movie.isSeries), 0, null, null, false);
        } else {
          setIsIntroLoading(false);
          setIsPlayerOpen(false);
          setDetailMovie(null);
          handleOpenNotFound(pathname);
        }
        return;
      }

      // If user navigated away from /watch/:
      setIsIntroLoading(false);
      setIsPlayerOpen(false);

      // Route: /movie/:slug or /tv/:slug or /series/:slug
      if (
        pathname.startsWith('/movie/') ||
        pathname.startsWith('/tv/') ||
        pathname.startsWith('/series/')
      ) {
        const slug = pathname.replace(/^\/(movie|tv|series)\//, '').split('/')[0];
        if (detailMovie && (detailMovie.slug === slug || getMovieSlug(detailMovie) === slug)) {
          return;
        }

        let movie = findMovieBySlug(slug);
        if (!movie) {
          try {
            const res = await apiFetch(`${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(slug)}`);
            const data = await res.json();
            if (data?.data?.subject) {
              movie = normalizeMovie({ ...data.data.subject, slug });
            }
          } catch (e) {}
        }
        if (movie) {
          openDetail(normalizeMovie(movie), false);
        } else {
          setDetailMovie(null);
          handleOpenNotFound(pathname);
        }
        return;
      }

      // If user navigated away from detail modal or player to Home / Me:
      setDetailMovie(null);
      setDetailData(null);
      setDetailImdb(null);
      setIsIntroLoading(false);
      setIsPlayerOpen(false);

      // Route: /404
      if (pathname.startsWith('/404')) {
        handleOpenNotFound(pathname);
        return;
      }

      // Route: /me and subtabs
      if (pathname.startsWith('/me')) {
        setIs404PageOpen(false);
        setNotFoundPath('');
        setMainTab('Me');
        if (pathname.includes('/history')) setMeSubTab('History');
        else if (pathname.includes('/mylist')) setMeSubTab('MyList');
        else if (pathname.includes('/downloads')) setMeSubTab('Downloads');
        else setMeSubTab(null);
        return;
      }

      // Route: Home categories
      if (pathname === '/' || pathname === '') {
        setIs404PageOpen(false);
        setNotFoundPath('');
        setMainTab('Home');
        setHomeCategory('All');
        return;
      }
      if (pathname === '/movies') {
        setIs404PageOpen(false);
        setNotFoundPath('');
        setMainTab('Home');
        setHomeCategory('Movies');
        return;
      }
      if (pathname === '/series' || pathname === '/tv') {
        setIs404PageOpen(false);
        setNotFoundPath('');
        setMainTab('Home');
        setHomeCategory('TV Series');
        return;
      }
      if (pathname === '/animation') {
        setIs404PageOpen(false);
        setNotFoundPath('');
        setMainTab('Home');
        setHomeCategory('Animation');
        return;
      }
      if (
        pathname === '/shots' ||
        pathname === '/reels' ||
        pathname.startsWith('/shots/') ||
        pathname.startsWith('/short/')
      ) {
        setIs404PageOpen(false);
        setNotFoundPath('');
        const sId = pathname.startsWith('/short/')
          ? pathname.replace('/short/', '').split('/')[0]
          : pathname.startsWith('/shots/')
          ? pathname.replace('/shots/', '').split('/')[0]
          : '';
        if (sId) setTargetShortId(sId);
        setMainTab('Shots');
        return;
      }

      // Unrecognized route: display minimal 404 without redirecting
      handleOpenNotFound(pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isPlayerOpen,
    isIntroLoading,
    detailMovie,
    playerMovie,
    heroList,
    trendingNow,
    latestReleases,
    netflixPopular,
    hindiMoviesList,
    animeTrending,
    animeLatest,
    webSeriesLatest,
    cartoonsList,
    exploreGridList,
    myList,
    watchHistory,
  ]);

  // 3. Initial URL resolution (Deep Linking on direct refresh or bookmark load)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const pathname = window.location.pathname || '/';
    const search = window.location.search || '';

    if (pathname === '/' || pathname === '') return;

    const initialRouteResolver = async () => {
      // Direct deep link visit: prime browser history stack [/, pathname] so Back button cleanly goes to Home instead of blank
      if (
        pathname.startsWith('/movie/') ||
        pathname.startsWith('/tv/') ||
        pathname.startsWith('/series/') ||
        pathname.startsWith('/watch/')
      ) {
        try {
          if (window.history && window.history.replaceState && window.history.pushState) {
            window.history.replaceState({ url: '/' }, '', '/');
            window.history.pushState({ url: pathname }, '', pathname);
          }
        } catch (e) {}
      }

      if (pathname.startsWith('/404')) {
        handleOpenNotFound(pathname);
        return;
      }
      if (pathname.startsWith('/auth')) {
        setIsDownloadPageOpen(false);
        setIsPrivacyPageOpen(false);
        setIsAuthPageOpen(true);
        return;
      }
      if (pathname.startsWith('/privacy')) {
        setIsDownloadPageOpen(false);
        setIsAuthPageOpen(false);
        setIsPrivacyPageOpen(true);
        return;
      }
      if (pathname.startsWith('/download')) {
        setIsAuthPageOpen(false);
        setIsPrivacyPageOpen(false);
        setIsDownloadPageOpen(true);
        return;
      }
      if (pathname.startsWith('/telegram')) {
        try {
          if (typeof window !== 'undefined') {
            window.location.href = 'https://t.me/movieflixlol';
          }
        } catch (_) {}
        return;
      }
      if (pathname.startsWith('/me')) {
        setMainTab('Me');
        if (pathname.includes('/history')) setMeSubTab('History');
        else if (pathname.includes('/mylist')) setMeSubTab('MyList');
        else if (pathname.includes('/downloads')) setMeSubTab('Downloads');
        return;
      }
      if (pathname === '/movies') {
        setHomeCategory('Movies');
        return;
      }
      if (pathname === '/series' || pathname === '/tv') {
        setHomeCategory('TV Series');
        return;
      }
      if (pathname === '/animation') {
        setHomeCategory('Animation');
        return;
      }
      if (
        pathname === '/shots' ||
        pathname === '/reels' ||
        pathname.startsWith('/shots/') ||
        pathname.startsWith('/short/')
      ) {
        const sId = pathname.startsWith('/short/')
          ? pathname.replace('/short/', '').split('/')[0]
          : pathname.startsWith('/shots/')
          ? pathname.replace('/shots/', '').split('/')[0]
          : '';
        if (sId) setTargetShortId(sId);
        setMainTab('Shots');
        return;
      }
      if (
        pathname.startsWith('/movie/') ||
        pathname.startsWith('/tv/') ||
        pathname.startsWith('/series/')
      ) {
        const slug = pathname.replace(/^\/(movie|tv|series)\//, '').split('/')[0];
        try {
          const res = await apiFetch(`${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(slug)}`);
          const data = await res.json();
          if (data?.data?.subject) {
            openDetail(normalizeMovie({ ...data.data.subject, slug }), false);
          } else {
            const sRes = await apiFetch(`${API_BASE}/api/content?endpoint=search&q=${encodeURIComponent(slug.replace(/-/g, ' '))}`);
            const sData = await sRes.json();
            if (sData?.items?.[0]) {
              openDetail(normalizeMovie(sData.items[0]), false);
            } else {
              setDetailMovie(null);
              handleOpenNotFound(pathname);
            }
          }
        } catch (e) {
          setDetailMovie(null);
          handleOpenNotFound(pathname);
        }
        return;
      }
      if (pathname.startsWith('/watch/')) {
        const slug = pathname.replace('/watch/', '').split('/')[0];
        const params = new URLSearchParams(search);
        const se = parseInt(params.get('season') || params.get('se') || '0', 10);
        const ep = parseInt(params.get('episode') || params.get('ep') || '0', 10);
        try {
          const res = await apiFetch(`${API_BASE}/api/content?endpoint=detail&slug=${encodeURIComponent(slug)}`);
          const data = await res.json();
          if (data?.data?.subject) {
            launchPlayer(normalizeMovie({ ...data.data.subject, slug }), se, ep, se > 0 || ep > 0, 0, null, null, false);
          } else {
            const sRes = await apiFetch(`${API_BASE}/api/content?endpoint=search&q=${encodeURIComponent(slug.replace(/-/g, ' '))}`);
            const sData = await sRes.json();
            if (sData?.items?.[0]) {
              launchPlayer(normalizeMovie(sData.items[0]), se, ep, se > 0 || ep > 0, 0, null, null, false);
            } else {
              setIsIntroLoading(false);
              setIsPlayerOpen(false);
              handleOpenNotFound(pathname);
            }
          }
        } catch (e) {
          setIsIntroLoading(false);
          setIsPlayerOpen(false);
          handleOpenNotFound(pathname);
        }
        return;
      }

      // Any other unrecognized route on initial load: show 404 without redirecting
      handleOpenNotFound(pathname);
    };

    initialRouteResolver();
  }, []);

  // Safe Local Storage Toggle for My List
  const toggleMyList = async (movie) => {
    if (!movie) return;
    const { myList: updated, isAdded } = await toggleMyListStorage(movie);
    setMyList([...updated]);
    showToast(isAdded ? `Added "${movie.name || 'Title'}" to My List` : `Removed from My List`);
  };

  const isInMyList = (movie) => {
    if (!movie) return false;
    return myList.some(m => (m.slug && m.slug === movie.slug) || (m.subject_id && m.subject_id === movie.subject_id));
  };

  // Watch History Handlers
  const handleClearHistory = async () => {
    await clearWatchHistory();
    setWatchHistory([]);
    showToast("Watch history cleared");
  };

  const handleRemoveHistory = async (id) => {
    const updated = await removeWatchHistory(id);
    setWatchHistory([...updated]);
  };

  // Downloads Handlers
  const handleDeleteDownload = async (item) => {
    await deleteDownloadedItem(item);
    const updated = await getDownloads();
    setDownloads([...updated]);
    showToast(`Deleted ${item.movie?.name || 'download'}`);
  };

  const handleCancelDownload = async (id) => {
    await cancelDownload(id);
    const updated = await getDownloads();
    setDownloads([...updated]);
    showToast("Download canceled");
  };

  // Open Download Modal for Movie or Episode
  const openDownloadModal = async (movie, detail, forcedSeasonIdx = null, forcedEp = null) => {
    if (!movie) return;
    setDownloadMovie(movie);
    setDownloadDetail(detail);
    const isSer = Boolean(detail?.isSeries);
    const seIdx = forcedSeasonIdx !== null ? forcedSeasonIdx : selectedSeasonIdx;
    const se = isSer ? (detail?.seasons?.[seIdx]?.se || 1) : 0;
    const ep = forcedEp !== null ? forcedEp : (isSer ? 1 : 0);

    setDownloadSeasonIdx(seIdx);
    setDownloadEpisodeNum(ep);
    setSelectedDownloadEps(isSer ? [ep] : [0]);
    setDownloadAudio('Original Audio (Default)');
    setDownloadSubtitle('None');
    setIsDownloadModalOpen(true);
    setLoadingDownloadOptions(true);

    try {
      const streamUrl = `${API_BASE}/api/content?endpoint=stream&id=${encodeURIComponent(movie.subject_id)}&detail_path=${encodeURIComponent(movie.slug)}&se=${se}&ep=${ep}`;
      const sRes = await apiFetch(streamUrl);
      const sJson = await sRes.json();
      const sources = sJson?.sources || [];
      setDownloadSources(sources);

      // Auto-select best available quality from real sources
      if (sources.length > 0) {
        const has720 = sources.find(s => s.resolution === '720p');
        const has1080 = sources.find(s => s.resolution === '1080p');
        setDownloadQuality((has720 || has1080 || sources[0]).resolution);
      } else {
        setDownloadQuality('720p');
      }

      const capUrl = `${API_BASE}/api/content?endpoint=captions&id=${encodeURIComponent(movie.subject_id)}&detail_path=${encodeURIComponent(movie.slug)}&se=${se}&ep=${ep}&title=${encodeURIComponent(movie.name || '')}`;
      const cRes = await apiFetch(capUrl);
      const cJson = await cRes.json();
      setDownloadCaptions(cJson?.captions || []);
    } catch (e) {
      console.log("Download options fetch:", e);
    } finally {
      setLoadingDownloadOptions(false);
    }
  };

  const handleDownloadSeasonEpChange = async (newSeIdx, newEp) => {
    setDownloadSeasonIdx(newSeIdx);
    setDownloadEpisodeNum(newEp);
    setSelectedDownloadEps([newEp]);
    setLoadingDownloadOptions(true);
    const se = downloadDetail?.seasons?.[newSeIdx]?.se || 1;
    try {
      const streamUrl = `${API_BASE}/api/content?endpoint=stream&id=${encodeURIComponent(downloadMovie.subject_id)}&detail_path=${encodeURIComponent(downloadMovie.slug)}&se=${se}&ep=${newEp}`;
      const sRes = await apiFetch(streamUrl);
      const sJson = await sRes.json();
      const sources = sJson?.sources || [];
      setDownloadSources(sources);

      if (sources.length > 0) {
        const hasCurrent = sources.find(s => s.resolution === downloadQuality);
        if (!hasCurrent) {
          const has720 = sources.find(s => s.resolution === '720p');
          setDownloadQuality((has720 || sources[0]).resolution);
        }
      }

      const capUrl = `${API_BASE}/api/content?endpoint=captions&id=${encodeURIComponent(downloadMovie.subject_id)}&detail_path=${encodeURIComponent(downloadMovie.slug)}&se=${se}&ep=${newEp}&title=${encodeURIComponent(downloadMovie.name || '')}`;
      const cRes = await apiFetch(capUrl);
      const cJson = await cRes.json();
      setDownloadCaptions(cJson?.captions || []);
    } catch (e) {
      console.log("Download update err:", e);
    } finally {
      setLoadingDownloadOptions(false);
    }
  };

  const toggleEpisodeSelection = (epNum) => {
    setSelectedDownloadEps(prev => {
      if (prev.includes(epNum)) {
        if (prev.length === 1) return prev; // keep at least 1 selected
        return prev.filter(e => e !== epNum);
      } else {
        return [...prev, epNum].sort((a, b) => a - b);
      }
    });
    setDownloadEpisodeNum(epNum);
  };

  const handleSelectAllEpisodes = () => {
    if (!downloadDetail?.seasons?.[downloadSeasonIdx]) return;
    const allEps = getEpisodesArray(downloadDetail.seasons[downloadSeasonIdx]);
    if (selectedDownloadEps.length === allEps.length) {
      setSelectedDownloadEps([allEps[0] || 1]);
    } else {
      setSelectedDownloadEps(allEps);
    }
  };

  const handleStartDownload = async () => {
    if (!downloadMovie) return;
    const isSer = Boolean(downloadDetail?.isSeries);
    const se = isSer ? (downloadDetail?.seasons?.[downloadSeasonIdx]?.se || 1) : 0;
    const epsToDownload = isSer ? (selectedDownloadEps.length > 0 ? selectedDownloadEps : [downloadEpisodeNum]) : [0];

    setIsDownloadModalOpen(false);

    if (epsToDownload.length > 1) {
      showToast(`Downloading ${epsToDownload.length} episodes simultaneously! Track progress in Me > Downloads.`);
    } else {
      showToast(`Started download: ${downloadMovie.name} (${downloadQuality})... Check Me > Downloads.`);
    }

    // Concurrently trigger downloads for all selected episodes
    for (const ep of epsToDownload) {
      (async () => {
        try {
          let targetSource = null;
          let subUrl = null;

          if (ep === downloadEpisodeNum && downloadSources.length > 0) {
            targetSource = downloadSources.find(s => s.resolution === downloadQuality) || downloadSources[0];
            if (downloadSubtitle !== 'None') {
              const matchedCap = downloadCaptions.find(c => {
                const name = getFriendlyLanguageName(c.lanName, c.lan);
                return name.toLowerCase().includes(downloadSubtitle.toLowerCase()) ||
                       (c.lan && c.lan.toLowerCase() === downloadSubtitle.toLowerCase());
              });
              if (matchedCap?.url) subUrl = matchedCap.url;
            }
          } else {
            const streamUrl = `${API_BASE}/api/content?endpoint=stream&id=${encodeURIComponent(downloadMovie.subject_id)}&detail_path=${encodeURIComponent(downloadMovie.slug)}&se=${se}&ep=${ep}`;
            const sRes = await apiFetch(streamUrl);
            const sJson = await sRes.json();
            const sources = sJson?.sources || [];
            targetSource = sources.find(s => s.resolution === downloadQuality) || sources[0];

            if (downloadSubtitle !== 'None') {
              try {
                const capUrl = `${API_BASE}/api/content?endpoint=captions&id=${encodeURIComponent(downloadMovie.subject_id)}&detail_path=${encodeURIComponent(downloadMovie.slug)}&se=${se}&ep=${ep}&title=${encodeURIComponent(downloadMovie.name || '')}`;
                const cRes = await apiFetch(capUrl);
                const cJson = await cRes.json();
                const caps = cJson?.captions || [];
                const matchedCap = caps.find(c => {
                  const name = getFriendlyLanguageName(c.lanName, c.lan);
                  return name.toLowerCase().includes(downloadSubtitle.toLowerCase()) ||
                         (c.lan && c.lan.toLowerCase() === downloadSubtitle.toLowerCase());
                });
                if (matchedCap?.url) subUrl = matchedCap.url;
              } catch (ce) {}
            }
          }

          const videoUrl = targetSource?.url;
          if (!videoUrl) {
            console.warn(`No stream found for episode ${ep}`);
            return;
          }

          await startDownload({
            movie: downloadMovie,
            isSeries: isSer,
            se,
            ep,
            videoUrl,
            subtitleUrl: subUrl,
            resolution: targetSource.resolution || downloadQuality,
            language: downloadAudio,
            subtitleLang: downloadSubtitle,
            onProgress: () => {
              getDownloads().then(setDownloads);
            },
            onStatusChange: (status) => {
              getDownloads().then(setDownloads);
              if (status === 'completed') {
                showToast(`Finished: ${downloadMovie.name}${isSer ? ` S${se}:E${ep}` : ''}!`);
              }
            },
          });
          getDownloads().then(setDownloads);
        } catch (e) {
          console.warn(`Download error for ep ${ep}:`, e);
        }
      })();
    }
  };

  // ─── In-App Update Handlers ───────────────────────────────────────────────
  const handleCheckForUpdate = async () => {
    setIsCheckingUpdate(true);
    setApkDownloadError(null);
    setApkDownloadProgress(null);
    try {
      const info = await checkForUpdateAsync();
      setUpdateInfo(info);
      setIsUpdateModalOpen(true);
    } catch (e) {
      setUpdateInfo({ hasUpdate: false, currentVersion: CURRENT_APP_VERSION, error: e.message });
      setIsUpdateModalOpen(true);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadAndInstallApk = async () => {
    if (!updateInfo?.apkAsset) {
      showToast('No APK file attached to this release. Visit GitHub to download manually.');
      return;
    }
    setIsDownloadingApk(true);
    setApkDownloadError(null);
    setApkDownloadProgress({ percent: 0, writtenFormatted: '0 B', totalFormatted: updateInfo.apkAsset.sizeFormatted || '...' });
    try {
      await downloadAndInstallApkAsync(updateInfo.apkAsset, (progress) => {
        setApkDownloadProgress(progress);
      });
      setIsDownloadingApk(false);
      setIsUpdateModalOpen(false);
      showToast('Update downloaded! Installing...');
    } catch (err) {
      setIsDownloadingApk(false);
      setApkDownloadError(err.message || 'Download failed. Please try again.');
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const heroItem = heroList[heroIndex] || heroList[0];

  // ─── NATIVE (APK) ONBOARDING & AUTH GATE ─────────────────────────────────
  if (Platform.OS !== 'web') {
    // 1. Every time user opens the APK cold: show custom splash screen FIRST!
    if (!splashFinished) {
      return (
        <CustomSplashScreen
          onFinish={() => {
            setSplashFinished(true);
          }}
        />
      );
    }

    // 2. While session is restoring from storage (if still loading):
    if (!authInitDone) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: insets.top }}>
          <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent />
          <HomeSkeletonLoader />
        </View>
      );
    }

    // 2. Unauthenticated user:
    if (!authUser) {
      // If user tapped "Get Started" or "Sign In", display the AuthScreen:
      if (isAuthPageOpen) {
        return (
          <AuthScreen
            initialMode={authMode}
            authError={authError}
            authLoading={authLoading}
            onSubmit={handleAuthSubmit}
            onClose={() => setIsAuthPageOpen(false)}
            onOpenPrivacy={handleOpenPrivacy}
          />
        );
      }

      // If user has not seen welcome onboarding yet, show WelcomeScreen:
      if (!hasSeenWelcome) {
        return (
          <WelcomeScreen
            onGetStarted={handleGetStarted}
          />
        );
      }

      // If user already saw welcome before, direct to AuthScreen:
      return (
        <AuthScreen
          initialMode="login"
          authError={authError}
          authLoading={authLoading}
          onSubmit={handleAuthSubmit}
          onClose={() => setIsAuthPageOpen(false)}
          onOpenPrivacy={handleOpenPrivacy}
        />
      );
    }
  }

  // ─── WEB / REUSABLE /auth PAGE VIEW ──────────────────────────────────────
  if (isAuthPageOpen) {
    return (
      <AuthScreen
        initialMode={authMode}
        authError={authError}
        authLoading={authLoading}
        onSubmit={handleAuthSubmit}
        onClose={closeAuthPage}
        onOpenPrivacy={handleOpenPrivacy}
      />
    );
  }

  // ─── /privacy PAGE VIEW (DIRECT ROUTE ON WEB) ─────────────────────────────
  if (isPrivacyPageOpen) {
    return (
      <PrivacyScreen
        onClose={closePrivacyPage}
      />
    );
  }

  // ─── /download PAGE VIEW (DIRECT ROUTE ON WEB) ────────────────────────────
  if (isDownloadPageOpen) {
    return (
      <DownloadScreen
        onClose={closeDownloadPage}
        onOpenPrivacy={handleOpenPrivacy}
        authUser={authUser}
        authAccessToken={authAccessToken}
        onOpenAuth={(mode) => openAuthPage(mode || 'login', '/download')}
      />
    );
  }

  // ─── 404 PAGE VIEW (DIRECT ROUTE OR NOT FOUND ON WEB) ─────────────────────
  if (is404PageOpen) {
    return (
      <NotFoundScreen
        path={notFoundPath}
        onGoHome={closeNotFoundPage}
        onOpenDownload={handleOpenDownload}
      />
    );
  }

  return (
    <View style={styles.appContainer}>
      <StatusBar style="light" backgroundColor="#0a0a0a" translucent />

      {/* Security Warning: Tampered / Injected APK Alert Banner */}
      {!isWeb && securityStatus?.isTampered && (
        <View style={styles.securityTamperBanner}>
          <Feather name="alert-triangle" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTamperTitle}>Unofficial or Modified App Detected</Text>
            <Text style={styles.securityTamperDesc}>
              This build was not downloaded from our official website or has been modified. Please download the authentic version to protect your device.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.securityTamperBtn}
            onPress={() => Linking.openURL('https://movieflix-pi-six.vercel.app')}
            activeOpacity={0.8}
          >
            <Text style={styles.securityTamperBtnText}>Download</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TOP GLASS NAVIGATION BAR (WHEN ON HOME TAB) */}
      {mainTab === 'Home' && (
        <View style={[styles.topNavBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.navBarGlassContainer}>
            {/* Brand Header Icon (IMG_20260929_162731) */}
            <TouchableOpacity
              onPress={() => { setHomeCategory('All'); handleSearch(''); }}
              activeOpacity={0.8}
              style={styles.brandLogoBtn}
            >
              <ExpoImage
                source={LOCAL_HEADER_ICON}
                style={styles.headerLogoImage}
                contentFit="contain"
              />
            </TouchableOpacity>

            {/* Clean Glass Search Capsule */}
            <View style={styles.searchCapsule}>
              <Feather name="search" size={15} color="#a3a3a3" style={{ marginRight: 6 }} />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="Search titles..."
                placeholderTextColor="#737373"
                style={styles.searchInput}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x-circle" size={15} color="#a3a3a3" />
                </TouchableOpacity>
              )}
            </View>

            {/* Header Right Actions: Explore Categories Navigation */}
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={styles.headerCategoriesBtn}
                onPress={() => setIsCategoryModalOpen(true)}
                activeOpacity={0.8}
              >
                <Feather name="grid" size={18} color="#f5f5f1" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Tabs Capsule (Live Server Categories) */}
          <View style={styles.tabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
              {serverCategories.map((tab) => {
                const isActive = homeCategory === tab.id;
                return (
                  <TouchableOpacity
                    key={`home-tab-${tab.id}`}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                    onPress={() => handleSelectCategory(tab.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ─── MAIN CONTENT: SHOTS 9:16 VERTICAL FEED OR HOME/ME SCROLLVIEW ─── */}
      {mainTab === 'Shots' ? (
        <ShotsFeedView
          insets={insets}
          isTabActive={mainTab === 'Shots'}
          showToast={showToast}
          triggerHaptic={triggerHaptic}
          onBack={() => setMainTab('Home')}
          authUser={authUser}
          authAccessToken={authAccessToken}
          openAuthModal={() => setIsAuthPageOpen(true)}
          targetShortId={targetShortId}
        />
      ) : (
        <ScrollView
          ref={mainScrollRef}
          style={styles.mainScrollView}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 96, 110) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          mainTab === 'Home' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e50914"
              colors={['#e50914']}
              progressBackgroundColor="#1a1a1a"
            />
          ) : undefined
        }
      >
        {/* ==================================================== */}
        {/* VIEW 1: ME (PROFILE, HISTORY, MY LIST, DOWNLOADS)   */}
        {/* ==================================================== */}
        {mainTab === 'Me' ? (
          <View style={[styles.meScreenContainer, { paddingTop: insets.top + 10 }]}>
            {meSubTab === null ? (
              /* ─── ROOT ME HUB: CLEAN & MINIMAL SPEC REDESIGN ─── */
              <Animated.View
                style={[
                  styles.meMinimalProfileContainer,
                  {
                    opacity: meSubTabAnim,
                    transform: [
                      {
                        translateY: meSubTabAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* Profile Hero: Avatar, Username, Email, Auth Action */}
                <View style={styles.meProfileHero}>
                  <View style={styles.meAvatarLarge}>
                    <Text style={styles.meAvatarInitial}>
                      {authUser
                        ? (authUser.name || authUser.email || 'J').charAt(0).toUpperCase()
                        : 'J'}
                    </Text>
                    {authUser && <View style={styles.meAvatarOnlineDot} />}
                  </View>

                  <Text style={styles.meProfileUsername}>
                    {authUser
                      ? (authUser.name || authUser.email.split('@')[0])
                      : 'jndjdk'}
                  </Text>

                  <Text style={styles.meProfileEmail}>
                    {authUser
                      ? authUser.email
                      : 'jndjdk@outlook.com'}
                  </Text>

                  <TouchableOpacity
                    style={styles.meMinimalAuthBtn}
                    onPress={() => authUser ? handleLogout() : openAuthPage('login')}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={authUser ? 'log-out' : 'log-in'}
                      size={12}
                      color={authUser ? '#ef4444' : '#a3a3a3'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.meMinimalAuthBtnText, authUser && { color: '#ef4444' }]}>
                      {authUser ? 'Sign Out' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 3 Stats Row: 0 History | 0 My list | 0 Downloads */}
                <View style={styles.meMinimalStatsCard}>
                  {/* Stat 1: History */}
                  <TouchableOpacity
                    style={styles.meMinimalStatItem}
                    onPress={() => {
                      triggerHaptic('selection');
                      setMeSubTab('History');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.meMinimalStatCount}>{watchHistory.length}</Text>
                    <Text style={styles.meMinimalStatLabel}>History</Text>
                  </TouchableOpacity>

                  <View style={styles.meMinimalStatDivider} />

                  {/* Stat 2: My list */}
                  <TouchableOpacity
                    style={styles.meMinimalStatItem}
                    onPress={() => {
                      triggerHaptic('selection');
                      setMeSubTab('MyList');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.meMinimalStatCount}>{myList.length}</Text>
                    <Text style={styles.meMinimalStatLabel}>My list</Text>
                  </TouchableOpacity>

                  <View style={styles.meMinimalStatDivider} />

                  {/* Stat 3: Downloads */}
                  <TouchableOpacity
                    style={styles.meMinimalStatItem}
                    onPress={() => {
                      triggerHaptic('selection');
                      if (!isWeb) {
                        setMeSubTab('Downloads');
                      } else {
                        handleOpenDownload();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.meMinimalStatCount}>{downloads.length}</Text>
                    <Text style={styles.meMinimalStatLabel}>Downloads</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Utility Links: Privacy Policy & Web Download APK */}
                <View style={styles.meMinimalLinksContainer}>
                  {isWeb && (
                    <TouchableOpacity
                      style={styles.meMinimalLinkRow}
                      onPress={handleOpenDownload}
                      activeOpacity={0.7}
                    >
                      <View style={styles.meMinimalLinkLeft}>
                        <Feather name="download" size={16} color="#e50914" style={{ marginRight: 10 }} />
                        <Text style={styles.meMinimalLinkText}>Download Android App</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color="#525252" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.meMinimalLinkRow}
                    onPress={handleOpenPrivacy}
                    activeOpacity={0.7}
                  >
                    <View style={styles.meMinimalLinkLeft}>
                      <Feather name="shield" size={16} color="#737373" style={{ marginRight: 10 }} />
                      <Text style={styles.meMinimalLinkText}>Privacy Policy</Text>
                    </View>
                    <Feather name={isWeb ? "chevron-right" : "external-link"} size={16} color="#525252" />
                  </TouchableOpacity>
                </View>

                {/* Minimal Footer: Movieflix *v1.1.6* Up to date / Official build, verified */}
                <View style={styles.meMinimalAppFooter}>
                  <TouchableOpacity
                    style={styles.meMinimalVersionRow}
                    onPress={!isWeb ? handleCheckForUpdate : undefined}
                    activeOpacity={!isWeb ? 0.7 : 1}
                    disabled={isWeb || isCheckingUpdate}
                  >
                    <Text style={styles.meMinimalAppName}>Movieflix</Text>
                    <Text style={styles.meMinimalVersionText}>v{CURRENT_APP_VERSION}</Text>
                    <View style={styles.meMinimalStatusPill}>
                      {isCheckingUpdate ? (
                        <ActivityIndicator size="small" color="#a3a3a3" style={{ transform: [{ scale: 0.7 }] }} />
                      ) : updateInfo?.hasUpdate ? (
                        <Text style={[styles.meMinimalStatusText, { color: '#e50914' }]}>Update available</Text>
                      ) : (
                        <Text style={styles.meMinimalStatusText}>Up to date</Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {!isWeb && updateInfo?.hasUpdate && (
                    <TouchableOpacity
                      style={[styles.meMinimalUpdateActionBtn, isDownloadingApk && { opacity: 0.7 }]}
                      onPress={handleDownloadAndInstallApk}
                      activeOpacity={0.8}
                      disabled={isDownloadingApk}
                    >
                      {isDownloadingApk ? (
                        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                      ) : (
                        <Feather name="arrow-down-circle" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                      )}
                      <Text style={styles.meMinimalUpdateActionText}>
                        {isDownloadingApk ? 'Updating...' : `Update to v${updateInfo.latestVersion}`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {!isWeb && isDownloadingApk && apkDownloadProgress && (
                    <View style={[styles.minimalProgressBarTrack, { width: '80%', alignSelf: 'center', marginTop: 10 }]}>
                      <View style={[styles.minimalProgressBarFill, { width: `${apkDownloadProgress.percent || 0}%` }]} />
                      <Text style={styles.minimalProgressText}>
                        {apkDownloadProgress.percent}% ({apkDownloadProgress.writtenFormatted} / {apkDownloadProgress.totalFormatted})
                      </Text>
                    </View>
                  )}

                  {!isWeb && apkDownloadError && (
                    <View style={[styles.minimalErrorRow, { justifyContent: 'center' }]}>
                      <Feather name="alert-circle" size={12} color="#ef4444" style={{ marginRight: 4 }} />
                      <Text style={styles.minimalErrorText} numberOfLines={1}>{apkDownloadError}</Text>
                    </View>
                  )}

                  <View style={styles.meMinimalSecurityRow}>
                    <Feather
                      name={securityStatus?.isTampered ? "alert-triangle" : "check-circle"}
                      size={13}
                      color={securityStatus?.isTampered ? "#ef4444" : "#10b981"}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[
                      styles.meMinimalSecurityText,
                      securityStatus?.isTampered && { color: '#ef4444' }
                    ]}>
                      {securityStatus?.isTampered
                        ? 'Modified build detected'
                        : 'Official build, verified'}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            ) : (
              /* ─── DEDICATED SUBPAGE (ANIMATED) ─── */
              <Animated.View
                style={{
                  opacity: meSubTabAnim,
                  transform: [
                    {
                      translateY: meSubTabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.meSubPageHeader}>
                  <TouchableOpacity
                    style={styles.meSubPageBackBtn}
                    onPress={() => {
                      triggerHaptic('selection');
                      setMeSubTab(null);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="arrow-left" size={18} color="#FFFFFF" />
                    <Text style={styles.meSubPageBackText}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.meSubPageTitle}>
                    {meSubTab === 'History' && 'Watch History'}
                    {meSubTab === 'MyList' && 'My List'}
                    {meSubTab === 'Downloads' && 'Offline Downloads'}
                  </Text>

                  <View style={styles.meSubPageHeaderRight}>
                    {meSubTab === 'History' && watchHistory.length > 0 && (
                      <TouchableOpacity onPress={handleClearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.clearAllBtnText}>Clear All</Text>
                      </TouchableOpacity>
                    )}
                    {meSubTab === 'MyList' && (
                      <Text style={styles.storageInfoText}>{myList.length} titles</Text>
                    )}
                    {meSubTab === 'Downloads' && downloads.length > 0 && (
                      <Text style={styles.storageInfoText}>
                        {formatBytes(downloads.reduce((acc, d) => acc + (d.sizeBytes || 0), 0))}
                      </Text>
                    )}
                  </View>
                </View>

            {/* SUB-SECTION 1: WATCH HISTORY */}
            {meSubTab === 'History' && (
              <View style={styles.meTabSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>Continue Watching</Text>
                  {watchHistory.length > 0 && (
                    <TouchableOpacity onPress={handleClearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.clearAllBtnText}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {watchHistory.length > 0 ? (
                  watchHistory.map((item) => (
                    <View key={`history-${item.id}`} style={styles.historyCard}>
                      <TouchableOpacity
                        style={styles.historyThumbContainer}
                        onPress={() => launchPlayer(item.movie, item.se, item.ep, item.isSeries, item.positionMillis / 1000)}
                        activeOpacity={0.8}
                      >
                        <SafeImage uri={item.movie?.poster_url} style={styles.historyThumbImage} />
                        <View style={styles.historyPlayOverlay}>
                          <Feather name="play" size={16} color="#FFFFFF" />
                        </View>
                        <View style={styles.historyThumbProgressBg}>
                          <View style={[styles.historyThumbProgressFill, { width: `${item.progressPercent || 0}%` }]} />
                        </View>
                      </TouchableOpacity>

                      <View style={styles.historyInfoCol}>
                        <Text numberOfLines={1} style={styles.historyTitleText}>{item.movie?.name}</Text>
                        <View style={styles.historyMetaPills}>
                          {item.isSeries && (
                            <View style={styles.epPill}>
                              <Text style={styles.epPillText}>S{item.se}:E{item.ep}</Text>
                            </View>
                          )}
                          <Text style={styles.historyPercentText}>{item.progressPercent || 0}% watched</Text>
                        </View>
                        <Text style={styles.historyTimeAgoText}>
                          {formatTimestamp(item.positionMillis)} / {formatTimestamp(item.durationMillis)}
                        </Text>
                      </View>

                      <View style={styles.historyActionsCol}>
                        <TouchableOpacity
                          style={styles.historyResumeBtn}
                          onPress={() => launchPlayer(item.movie, item.se, item.ep, item.isSeries, item.positionMillis / 1000)}
                          activeOpacity={0.8}
                        >
                          <Feather name="play" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.historyResumeText}>Resume</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.historyDeleteBtn}
                          onPress={() => handleRemoveHistory(item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="trash-2" size={15} color="#737373" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyMePlaceholder}>
                    <Feather name="clock" size={48} color="#404040" />
                    <Text style={styles.emptyPlaceholderTitle}>No Watch History</Text>
                    <Text style={styles.emptyPlaceholderDesc}>
                      Watch any movie or episode and your playback progress will be saved here safely on your device.
                    </Text>
                    <TouchableOpacity style={styles.explorePillBtn} onPress={() => setMainTab('Home')}>
                      <Text style={styles.explorePillBtnText}>Explore Movies</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* SUB-SECTION 2: MY LIST */}
            {meSubTab === 'MyList' && (
              <View style={styles.meTabSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>Saved to My List</Text>
                  <Text style={styles.storageInfoText}>{myList.length} saved titles</Text>
                </View>

                {myList.length > 0 ? (
                  <View style={styles.gridContainer}>
                    {myList.map((item, idx) => (
                      <View key={`mylist-card-${item.slug || item.subject_id}-${idx}`} style={[styles.myListCardWrapper, { width: exploreCardWidth }]}>
                        <GlassMovieCard
                          movie={item}
                          onPress={() => openDetail(item)}
                          isSeries={item.isSeries}
                          style={{ width: '100%', aspectRatio: 2 / 3 }}
                        />
                        <TouchableOpacity
                          style={styles.myListQuickRemoveBtn}
                          onPress={() => toggleMyList(item)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Feather name="x-circle" size={20} color="#e50914" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyMePlaceholder}>
                    <Feather name="bookmark" size={48} color="#404040" />
                    <Text style={styles.emptyPlaceholderTitle}>Your List is Empty</Text>
                    <Text style={styles.emptyPlaceholderDesc}>
                      Tap "Add to List" on any movie or series to keep your favorites saved securely on your device.
                    </Text>
                    <TouchableOpacity style={styles.explorePillBtn} onPress={() => setMainTab('Home')}>
                      <Text style={styles.explorePillBtnText}>Browse Catalog</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* SUB-SECTION 3: DOWNLOADS (DISABLED ON WEB) */}
            {meSubTab === 'Downloads' && !isWeb && (
              <View style={styles.meTabSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>Offline Downloads</Text>
                  <Text style={styles.storageInfoText}>
                    {downloads.length} items · {formatBytes(downloads.reduce((acc, d) => acc + (d.sizeBytes || 0), 0))}
                  </Text>
                </View>

                {downloads.length > 0 ? (
                  downloads.map((item) => (
                    <View key={`dl-${item.id}`} style={styles.downloadCard}>
                      <View style={styles.downloadThumbWrapper}>
                        <SafeImage uri={item.movie?.poster_url} style={styles.downloadThumb} />
                        <View style={styles.downloadQualityBadge}>
                          <Text style={styles.downloadQualityBadgeText}>{item.resolution}</Text>
                        </View>
                        {item.status === 'downloading' && (
                          <View style={styles.downloadActiveThumbOverlay}>
                            <AnimatedDownloadSpinner size={22} color="#e50914" />
                          </View>
                        )}
                      </View>

                      <View style={styles.downloadInfoCol}>
                        <Text numberOfLines={1} style={styles.downloadTitleText}>{item.movie?.name}</Text>
                        
                        {item.isSeries && (
                          <View style={styles.downloadMetaRow}>
                            <View style={styles.epPill}>
                              <Text style={styles.epPillText}>S{item.se}:E{item.ep}</Text>
                            </View>
                          </View>
                        )}

                        {item.status === 'downloading' ? (
                          <View style={styles.downloadProgressBlock}>
                            <View style={styles.downloadProgressHeaderRow}>
                              <AnimatedPulseBadge text={`Downloading ${item.progress || 0}%`} />
                              <Text style={styles.downloadSizeCounter}>
                                {item.sizeBytes > 0 ? formatBytes(item.sizeBytes) : 'Queued...'}
                              </Text>
                            </View>
                            <View style={styles.downloadProgressBarBg}>
                              <View style={[styles.downloadProgressBarFill, { width: `${Math.max(item.progress || 0, 4)}%` }]} />
                            </View>
                          </View>
                        ) : item.status === 'completed' ? (
                          <View style={styles.downloadReadyRow}>
                            <Feather name="check-circle" size={13} color="#e50914" style={{ marginRight: 4 }} />
                            <Text style={styles.downloadReadyText}>Ready Offline · {formatBytes(item.sizeBytes)}</Text>
                          </View>
                        ) : (
                          <Text style={styles.downloadFailedText}>Download Failed</Text>
                        )}
                      </View>

                      <View style={styles.downloadActionsCol}>
                        {item.status === 'completed' ? (
                          <TouchableOpacity
                            style={styles.playOfflineBtn}
                            onPress={() => launchPlayer(item.movie, item.se, item.ep, item.isSeries, 0, item.localVideoUri, item.localSubtitleUri)}
                            activeOpacity={0.8}
                          >
                            <Feather name="play" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.playOfflineBtnText}>Play</Text>
                          </TouchableOpacity>
                        ) : item.status === 'downloading' ? (
                          <TouchableOpacity
                            style={styles.cancelDownloadBtn}
                            onPress={() => handleCancelDownload(item.id)}
                          >
                            <Feather name="x-circle" size={18} color="#e50914" />
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                          style={styles.deleteDownloadBtn}
                          onPress={() => handleDeleteDownload(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="trash-2" size={15} color="#737373" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyMePlaceholder}>
                    <Feather name="download-cloud" size={48} color="#404040" />
                    <Text style={styles.emptyPlaceholderTitle}>No Downloads</Text>
                    <Text style={styles.emptyPlaceholderDesc}>
                      Download movies and episodes to watch offline anywhere, with custom quality, language, and subtitles.
                    </Text>
                    <TouchableOpacity style={styles.explorePillBtn} onPress={() => setMainTab('Home')}>
                      <Text style={styles.explorePillBtnText}>Find Titles to Download</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        )}
      </View>
    ) : (
          /* ==================================================== */
          /* VIEW 2: HOME TAB (OFFLINE BANNER, SEARCH, HERO, FEED)*/
          /* ==================================================== */
          searchQuery.trim().length > 0 ? (
            <View style={styles.searchResultsContainer}>
              {isOffline && (
                <View style={styles.offlineNoticeCard}>
                  <View style={styles.offlineIconBox}>
                    <Feather name="wifi-off" size={22} color="#e50914" />
                  </View>
                  <View style={styles.offlineTextBox}>
                    <Text style={styles.offlineTitle}>You are offline</Text>
                    <Text style={styles.offlineSubtitle}>
                      {isWeb
                        ? 'Stream unavailable. Please check your internet connection to continue browsing.'
                        : 'Stream unavailable. Watch your downloaded movies & episodes offline anytime.'}
                    </Text>
                    <View style={styles.offlineActionRow}>
                      {!isWeb && (
                        <TouchableOpacity
                          style={styles.offlineSeeDownloadsBtn}
                          onPress={() => { setMainTab('Me'); setMeSubTab('Downloads'); }}
                          activeOpacity={0.8}
                        >
                          <Feather name="download" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.offlineSeeDownloadsText}>See Downloads ({downloads.length})</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.offlineRetryBtn}
                        onPress={async () => {
                          showToast('Checking connection...');
                          try {
                            const net = await NetInfo.fetch();
                            const stillOffline = net.isConnected === false;
                            setIsOffline(stillOffline);
                            if (!stillOffline) {
                              showToast('Back online! 🌐');
                              fetchContent();
                            } else {
                              showToast('Still offline. Check WiFi or mobile data.');
                            }
                          } catch (e) {
                            showToast('Offline check failed.');
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Feather name="refresh-cw" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.offlineRetryBtnText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
              <Text style={styles.sectionHeaderTitle}>
                Search Results for "{searchQuery}"
              </Text>
              {isSearching ? (
                <ActivityIndicator size="small" color="#e50914" style={{ marginTop: 24 }} />
              ) : searchResults.length > 0 ? (
                <View style={styles.exploreGridContainer}>
                  {searchResults.map((item, idx) => (
                    <GlassMovieCard
                      key={`search-${item.slug || item.subject_id}-${idx}`}
                      movie={item}
                      onPress={() => openDetail(item)}
                      style={{ width: exploreCardWidth, aspectRatio: 2 / 3, marginBottom: 10 }}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.noResultCard}>
                  <View style={styles.noResultIconCircle}>
                    <Feather name="search" size={36} color="#737373" />
                  </View>
                  <Text style={styles.noResultTitle}>No Results Found</Text>
                  <Text style={styles.noResultDesc}>
                    We couldn't find any titles matching "{searchQuery}". Try searching for another movie, actor, or genre.
                  </Text>
                  <View style={styles.noResultBtnRow}>
                    <TouchableOpacity
                      style={styles.noResultClearBtn}
                      onPress={() => handleSearch('')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.noResultClearBtnText}>Clear Search</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.noResultExploreBtn}
                      onPress={() => { handleSearch(''); setIsCategoryModalOpen(true); }}
                      activeOpacity={0.8}
                    >
                      <Feather name="grid" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.noResultExploreBtnText}>Explore Categories</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : isOffline && (!trendingNow || trendingNow.length === 0) ? (
            /* DEDICATED FULL OFFLINE SCREEN */
            <View style={styles.offlineFullContainer}>
              <View style={styles.offlineIconBoxLarge}>
                <Feather name="wifi-off" size={44} color="#e50914" />
              </View>
              <Text style={styles.offlineFullTitle}>You're Offline</Text>
              <Text style={styles.offlineFullSubtitle}>
                {isWeb
                  ? 'No internet connection detected. Please connect to the internet to stream content.'
                  : 'No internet connection detected. Check your Wi-Fi or mobile network to browse and stream online titles.'}
              </Text>
              {!isWeb && (
                <TouchableOpacity
                  style={styles.offlineFullDownloadsBtn}
                  onPress={() => { setMainTab('Me'); setMeSubTab('Downloads'); }}
                  activeOpacity={0.8}
                >
                  <Feather name="download" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.offlineFullDownloadsText}>Watch Downloads ({downloads.length})</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.offlineFullRetryBtn}
                onPress={async () => {
                  showToast('Checking connection...');
                  try {
                    const net = await NetInfo.fetch();
                    const stillOffline = net.isConnected === false;
                    setIsOffline(stillOffline);
                    if (!stillOffline) {
                      showToast('Connected! Restoring feed... 🌐');
                      fetchContent();
                    } else {
                      showToast('Still offline. Please check your connection.');
                    }
                  } catch (e) {
                    showToast('Connection check failed.');
                  }
                }}
                activeOpacity={0.8}
              >
                <Feather name="refresh-cw" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.offlineFullRetryText}>Retry Connection</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            /* SKELETON LOADING STATE */
            <HomeSkeletonLoader />
          ) : (
            /* REGULAR BROWSING FEED */
            <>
              {/* OFFLINE BANNER ON HOME BROWSING */}
              {isOffline && (
                <View style={styles.offlineNoticeCard}>
                  <View style={styles.offlineIconBox}>
                    <Feather name="wifi-off" size={22} color="#e50914" />
                  </View>
                  <View style={styles.offlineTextBox}>
                    <Text style={styles.offlineTitle}>You are offline</Text>
                    <Text style={styles.offlineSubtitle}>
                      {isWeb
                        ? 'Stream unavailable. Please check your internet connection to stream movies.'
                        : 'Stream unavailable. Watch your downloaded movies & episodes offline anytime.'}
                    </Text>
                    <View style={styles.offlineActionRow}>
                      {!isWeb && (
                        <TouchableOpacity
                          style={styles.offlineSeeDownloadsBtn}
                          onPress={() => { setMainTab('Me'); setMeSubTab('Downloads'); }}
                          activeOpacity={0.8}
                        >
                          <Feather name="download" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.offlineSeeDownloadsText}>See Downloads ({downloads.length})</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.offlineRetryBtn}
                        onPress={async () => {
                          showToast('Checking connection...');
                          try {
                            const net = await NetInfo.fetch();
                            const stillOffline = net.isConnected === false;
                            setIsOffline(stillOffline);
                            if (!stillOffline) {
                              showToast('Back online! Syncing feed... 🌐');
                              fetchContent();
                            } else {
                              showToast('Still offline. Check WiFi or mobile data.');
                            }
                          } catch (e) {
                            showToast('Offline check failed.');
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Feather name="refresh-cw" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.offlineRetryBtnText}>Retry Connection</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* HERO BANNER SECTION (CLASSIC FULL-BLEED CINEMATIC BANNER) */}
              {heroItem && homeCategory === 'All' && (
                <View style={styles.heroSection}>
                  {/* Full-Bleed Animated Cinematic Poster Banner */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFillObject,
                      {
                        opacity: heroFadeAnim,
                      },
                    ]}
                  >
                    <SafeImage
                      key={`hero-poster-${heroItem?.slug || heroIndex}`}
                      uri={heroItem.poster_url}
                      style={styles.heroPosterImage}
                      resizeMode="cover"
                      contentPosition="center"
                    />
                    {/* Top gradient for status bar / header clarity */}
                    <LinearGradient
                      colors={['rgba(10, 10, 10, 0.75)', 'rgba(10, 10, 10, 0.25)', 'transparent']}
                      locations={[0, 0.35, 0.7]}
                      style={styles.heroTopFade}
                    />
                    {/* Bottom gradient fade into page background */}
                    <LinearGradient
                      colors={['transparent', 'rgba(10, 10, 10, 0.3)', 'rgba(10, 10, 10, 0.85)', '#0a0a0a']}
                      locations={[0, 0.45, 0.8, 1]}
                      style={styles.heroBottomFade}
                    />
                  </Animated.View>

                  {/* Atmospheric Smoke & Mist Visual Effect */}
                  <HeroSmokeEffect />

                  {/* Hero Information Overlaid At Bottom */}
                  <Animated.View
                    style={[
                      styles.heroContent,
                      {
                        opacity: heroFadeAnim,
                        transform: [{ translateY: heroContentSlideAnim }],
                      },
                    ]}
                  >
                    <Text numberOfLines={isDesktop ? 2 : 1} style={[styles.heroTitleText, !isDesktop && { fontSize: 20, marginBottom: 3 }]}>
                      {heroItem.name}
                    </Text>

                    {/* Metadata Row (Clean, No Emojis, No Tags) */}
                    <View style={[styles.heroMetaRow, !isDesktop && { marginBottom: 4 }]}>
                      <Text style={styles.heroMatchScore}>{heroItem.match || "99% match"}</Text>
                      <View style={styles.metaGlassPill}>
                        <Text style={styles.metaGlassPillText}>{heroItem.year || "2025"}</Text>
                      </View>
                      <Text style={styles.heroGenreText}>{heroItem.genre || "Action · Thriller"}</Text>
                    </View>

                    {/* Synopsis snippet (shown on wider screens for sleek cinematic balance) */}
                    {isDesktop && (
                      <Text numberOfLines={2} style={styles.heroSynopsis}>
                        {heroItem.synopsis || "A captivating journey featuring explosive action, high stakes, and unforgettable storytelling."}
                      </Text>
                    )}

                    {/* Hero Action Buttons */}
                    <View style={styles.heroActionsRow}>
                      <TouchableOpacity
                        style={styles.heroPlayButton}
                        onPress={() => launchPlayer(heroItem, 1, 1, Boolean(heroItem.isSeries))}
                        activeOpacity={0.85}
                      >
                        <Feather name="play" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.heroPlayButtonText}>Play</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.heroListButton}
                        onPress={() => toggleMyList(heroItem)}
                        activeOpacity={0.8}
                      >
                        <Feather
                          name={isInMyList(heroItem) ? "check" : "plus"}
                          size={17}
                          color="#f5f5f1"
                          style={{ marginRight: 5 }}
                        />
                        <Text style={styles.heroListButtonText}>
                          {isInMyList(heroItem) ? "In My List" : "My List"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.heroInfoButton}
                        onPress={() => openDetail(heroItem)}
                        activeOpacity={0.8}
                      >
                        <Feather name="info" size={18} color="#f5f5f1" />
                      </TouchableOpacity>
                    </View>

                    {/* Carousel Indicator Dots */}
                    {heroList.length > 1 && (
                      <View style={styles.heroDotsContainer}>
                        {heroList.slice(0, 8).map((_, idx) => (
                          <TouchableOpacity
                            key={`hero-dot-${idx}`}
                            onPress={() => setHeroIndex(idx)}
                            style={[
                              styles.heroDot,
                              (heroIndex % Math.min(heroList.length, 8)) === idx ? styles.heroDotActive : styles.heroDotInactive,
                            ]}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                          />
                        ))}
                      </View>
                    )}
                  </Animated.View>
                </View>
              )}

              {/* CATALOG CONTENT ROWS FOR 'ALL' */}
              {homeCategory === 'All' && (
                <>

                  {/* User Saved "My List" */}
                  {myList.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>My List</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => {
                            setMainTab('Me');
                            setMeSubTab('MyList');
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See All ({myList.length})</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {myList.map((movie, idx) => (
                          <GlassMovieCard
                            key={`home-mylist-${movie.slug || movie.subject_id}-${idx}`}
                            movie={movie}
                            onPress={() => openDetail(movie)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Personalized Recommendations */}
                  {nextViperRecommendations.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Recommended For You</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Recommended For You', nextViperRecommendations)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {nextViperRecommendations.map((movie, idx) => (
                          <GlassMovieCard
                            key={`nv-rec-${movie.slug || movie.subject_id}-${idx}`}
                            movie={movie}
                            onPress={() => openDetail(movie)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 1. Trending Now */}
                  {trendingNow.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Trending Now</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Trending Now', trendingNow)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {trendingNow.map((movie, idx) => (
                          <GlassMovieCard
                            key={`trending-${movie.slug || movie.subject_id}-${idx}`}
                            movie={movie}
                            onPress={() => openDetail(movie)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 2. Latest Releases */}
                  {latestReleases.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Latest Releases</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Latest Releases', latestReleases)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {latestReleases.map((movie, idx) => (
                          <GlassMovieCard
                            key={`latest-${movie.slug || movie.subject_id}-${idx}`}
                            movie={movie}
                            onPress={() => openDetail(movie)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 3. Netflix Popular */}
                  {netflixPopular.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Netflix Popular</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Netflix Popular', netflixPopular)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {netflixPopular.map((series, idx) => (
                          <GlassMovieCard
                            key={`netflix-pop-${series.slug || series.subject_id}-${idx}`}
                            movie={series}
                            onPress={() => openDetail(series)}
                            isSeries
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 4. Hindi Movies */}
                  {hindiMoviesList.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Hindi Movies</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Hindi Movies', hindiMoviesList)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {hindiMoviesList.map((movie, idx) => (
                          <GlassMovieCard
                            key={`hindi-${movie.slug || movie.subject_id}-${idx}`}
                            movie={movie}
                            onPress={() => openDetail(movie)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 5. Anime Trending */}
                  {animeTrending.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Anime Trending</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Anime Trending', animeTrending)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {animeTrending.map((anime, idx) => (
                          <GlassMovieCard
                            key={`anime-trend-${anime.slug || anime.subject_id}-${idx}`}
                            movie={anime}
                            onPress={() => openDetail(anime)}
                            isSeries
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 6. Latest Anime */}
                  {animeLatest.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Latest Anime</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Latest Anime', animeLatest)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {animeLatest.map((anime, idx) => (
                          <GlassMovieCard
                            key={`anime-late-${anime.slug || anime.subject_id}-${idx}`}
                            movie={anime}
                            onPress={() => openDetail(anime)}
                            isSeries
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 7. Web Series */}
                  {webSeriesLatest.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Web Series</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Web Series', webSeriesLatest)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {webSeriesLatest.map((show, idx) => (
                          <GlassMovieCard
                            key={`webseries-${show.slug || show.subject_id}-${idx}`}
                            movie={show}
                            onPress={() => openDetail(show)}
                            isSeries
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 8. Cartoons & Animation */}
                  {cartoonsList.length > 0 && (
                    <View style={styles.rowSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Cartoons & Animation</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={() => handleSeeMoreSection('Cartoons & Animation', cartoonsList)}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                        {cartoonsList.map((cartoon, idx) => (
                          <GlassMovieCard
                            key={`cartoon-${cartoon.slug || cartoon.subject_id}-${idx}`}
                            movie={cartoon}
                            onPress={() => openDetail(cartoon)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* 9. EXPLORE MORE (RANDOM MOVIES & SERIES IN 3-COLUMN GRID VIEW) */}
                  {exploreGridList.length > 0 && (
                    <View style={styles.exploreGridSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>Explore More</Text>
                        <TouchableOpacity
                          style={styles.seeMoreBtn}
                          onPress={handleLoadMoreExplore}
                          hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeMoreText}>See More</Text>
                          <Feather name="chevron-right" size={14} color="#e50914" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.exploreGridContainer}>
                        {exploreGridList.slice(0, exploreVisibleCount).map((item, idx) => (
                          <GlassMovieCard
                            key={`explore-grid-${item.slug || item.subject_id}-${idx}`}
                            movie={item}
                            onPress={() => openDetail(item)}
                            style={{ width: exploreCardWidth, aspectRatio: 2 / 3, marginBottom: 10 }}
                          />
                        ))}
                      </View>

                      {/* Load More Option */}
                      <View style={styles.loadMoreContainer}>
                        <TouchableOpacity
                          style={styles.loadMoreButton}
                          onPress={handleLoadMoreExplore}
                          activeOpacity={0.8}
                        >
                          <Feather name="refresh-cw" size={15} color="#f5f5f1" style={{ marginRight: 8 }} />
                          <Text style={styles.loadMoreButtonText}>Load More</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* CATEGORY & GENRE BROWSING FEED (RESPONSIVE GRID VIEW) */}
              {homeCategory !== 'All' && (
                <View style={styles.gridSection}>
                  <View style={styles.categoryHeaderRow}>
                    <View>
                      <Text style={styles.categoryHeaderTitle}>
                        {serverCategories.find(c => c.id === homeCategory)?.label || homeCategory}
                      </Text>
                      <Text style={styles.categoryHeaderSubtitle}>
                        {filteredCategoryList.length} titles available
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.categoryResetPill}
                      onPress={() => setHomeCategory('All')}
                      activeOpacity={0.7}
                    >
                      <Feather name="x-circle" size={14} color="#a3a3a3" style={{ marginRight: 4 }} />
                      <Text style={styles.categoryResetText}>All Titles</Text>
                    </TouchableOpacity>
                  </View>

                  {filteredCategoryList.length > 0 ? (
                    <View style={styles.exploreGridContainer}>
                      {filteredCategoryList.map((movie, idx) => (
                        <GlassMovieCard
                          key={`cat-${homeCategory}-${movie.slug || movie.subject_id}-${idx}`}
                          movie={movie}
                          onPress={() => openDetail(movie)}
                          style={{ width: exploreCardWidth, aspectRatio: 2 / 3, marginBottom: 10 }}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noResultCard}>
                      <View style={styles.noResultIconCircle}>
                        <Feather name="film" size={36} color="#737373" />
                      </View>
                      <Text style={styles.noResultTitle}>No Titles in {homeCategory}</Text>
                      <Text style={styles.noResultDesc}>
                        We are currently updating titles for this category. Browse other popular genres or trending releases.
                      </Text>
                      <TouchableOpacity
                        style={styles.noResultExploreBtn}
                        onPress={() => setHomeCategory('All')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.noResultExploreBtnText}>Browse All Titles</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </>
          )
        )}
      </ScrollView>
      )}

      {/* DETAIL MODAL (CLEAN GLASS, REAL DATA) */}
      <Modal
        visible={Boolean(detailMovie)}
        animationType="slide"
        transparent={false}
        onRequestClose={closeDetail}
      >
        <View style={styles.detailContainer}>
          <StatusBar style="light" backgroundColor="#0a0a0a" translucent />

          {/* Close Button Top Right */}
          <TouchableOpacity
            style={[styles.detailCloseButton, { top: insets.top + 12 }]}
            onPress={closeDetail}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView
            ref={detailScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          >
            {/* Real-Ratio Movie Poster & Ambient Backdrop (Play Page) */}
            <View style={styles.detailHeroBackdrop}>
              {/* Soft ambient background */}
              <SafeImage
                uri={detailMovie?.poster_url}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(10, 10, 10, 0.7)' }]} />
              <LinearGradient
                colors={['rgba(10, 10, 10, 0.35)', 'rgba(10, 10, 10, 0.85)', '#0a0a0a']}
                locations={[0, 0.65, 1]}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Real Ratio Poster in Center (Cinema 2:3, Full, Zero Cutoff) */}
              <View style={styles.detailRealPosterWrapper}>
                <View style={styles.detailRealPosterCard}>
                  <SafeImage
                    uri={detailMovie?.poster_url}
                    style={styles.detailRealPosterImage}
                    resizeMode="contain"
                  />
                  <View style={styles.detailPosterGlassBorder} />
                </View>
              </View>
            </View>

            {/* Clean Title & Metadata (IMDb Rating, Year, Content Rating, Duration) */}
            <View style={styles.detailTitleSection}>
              <Text style={styles.detailTitle}>{detailMovie?.name}</Text>
              <View style={styles.detailMetaRow}>
                {detailImdb?.rating ? (
                  <View style={styles.imdbRatingBadge}>
                    <Text style={styles.imdbRatingLogo}>IMDb</Text>
                    <Text style={styles.imdbRatingValue}>{detailImdb.rating}</Text>
                    {detailImdb.votes ? (
                      <Text style={styles.imdbVotesText}>({detailImdb.votes})</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.detailMatchScore}>98% match</Text>
                )}

                <View style={styles.metaGlassPill}>
                  <Text style={styles.metaGlassPillText}>
                    {detailImdb?.year || (detailData?.releaseDate ? detailData.releaseDate.split('-')[0] : '2026')}
                  </Text>
                </View>

                {Boolean(detailImdb?.rated && detailImdb.rated !== 'N/A') && (
                  <View style={styles.metaGlassPill}>
                    <Text style={styles.metaGlassPillText}>{detailImdb.rated}</Text>
                  </View>
                )}

                {detailData?.durationSeconds ? (
                  <Text style={styles.detailDurationText}>
                    {Math.floor(detailData.durationSeconds / 60)}m
                  </Text>
                ) : null}

                {Array.isArray(detailData?.dubs) && detailData.dubs.filter(d => d.type === 0).length > 1 ? (
                  <View style={[styles.metaGlassPill, { borderColor: 'rgba(229, 9, 20, 0.4)', backgroundColor: 'rgba(229, 9, 20, 0.15)' }]}>
                    <Text style={[styles.metaGlassPillText, { color: '#ff6b6b' }]}>
                      {detailData.dubs.filter(d => d.type === 0).length} Dubs
                    </Text>
                  </View>
                ) : (Array.isArray(detailData?.subtitles) && detailData.subtitles.length > 0 ? (
                  <View style={[styles.metaGlassPill, { borderColor: 'rgba(70, 211, 105, 0.4)', backgroundColor: 'rgba(70, 211, 105, 0.15)' }]}>
                    <Text style={[styles.metaGlassPillText, { color: '#46d369' }]}>
                      {detailData.subtitles.length} Subtitles
                    </Text>
                  </View>
                ) : null)}
              </View>
            </View>

            {/* Actions Bar: Play, Download, Add to List */}
            <View style={styles.detailActionsBar}>
              <TouchableOpacity
                style={styles.detailPlayButton}
                onPress={() => {
                  const isSeries = Boolean(detailData?.isSeries);
                  const se = isSeries ? (detailData?.seasons?.[selectedSeasonIdx]?.se || 1) : 0;
                  const ep = isSeries ? 1 : 0;
                  launchPlayer(detailMovie, se, ep, isSeries);
                }}
                activeOpacity={0.85}
              >
                <Feather name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.detailPlayButtonText}>
                  {detailData?.isSeries ? "Play S1:E1" : "Play Now"}
                </Text>
              </TouchableOpacity>

              {/* DOWNLOAD BUTTON (DISABLED ON WEB) */}
              {!isWeb && (
                <TouchableOpacity
                  style={styles.detailDownloadButton}
                  onPress={() => openDownloadModal(detailMovie, detailData)}
                  activeOpacity={0.85}
                >
                  <Feather name="download" size={16} color="#f5f5f1" style={{ marginRight: 6 }} />
                  <Text style={styles.detailDownloadButtonText}>Download</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.detailListButton}
                onPress={() => toggleMyList(detailMovie)}
                activeOpacity={0.8}
              >
                <Feather
                  name={isInMyList(detailMovie) ? "check" : "plus"}
                  size={16}
                  color="#f5f5f1"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.detailListButtonText}>
                  {isInMyList(detailMovie) ? "In My List" : "Add to List"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Real Synopsis / Overview & IMDb Cast & Actresses */}
            <View style={styles.detailOverviewSection}>
              {loadingDetail ? (
                <ActivityIndicator size="small" color="#e50914" style={{ marginVertical: 16 }} />
              ) : (
                <>
                  <Text style={styles.detailOverviewText}>
                    {detailImdb?.plot || detailData?.description || "An engaging and captivating watch available to stream right now in high definition."}
                  </Text>
                  {detailData?.genre && (
                    <View style={styles.detailGenresRow}>
                      {detailData.genre.split(',').map((g, idx) => (
                        <View key={`genre-${idx}`} style={styles.genrePill}>
                          <Text style={styles.genrePillText}>{g.trim()}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Single Audio Info (if not multiple dubs) */}
                  {Boolean(detailData?.audios) && (!Array.isArray(detailData?.dubs) || detailData.dubs.filter(d => d.type === 0).length <= 1) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 2 }}>
                      <Feather name="volume-2" size={12} color="#a3a3a3" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: '#a3a3a3' }}>
                        Audio: <Text style={{ color: '#ffffff', fontWeight: '600' }}>{detailData.audios}</Text>
                      </Text>
                    </View>
                  )}

                  {/* Available Audio Dubs (Hindi, French, Spanish, Tamil, Telugu, etc.) */}
                  {Array.isArray(detailData?.dubs) && detailData.dubs.filter(d => d.type === 0).length > 1 && (
                    <View style={styles.detailDubsSection}>
                      <View style={styles.detailDubsHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Feather name="volume-2" size={13} color="#e50914" style={{ marginRight: 6 }} />
                          <Text style={styles.detailDubsHeading}>Available Audio Dubs</Text>
                        </View>
                        <Text style={styles.detailDubsCountBadge}>
                          {detailData.dubs.filter(d => d.type === 0).length} Languages
                        </Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.detailDubsScroll}
                      >
                        {detailData.dubs.filter(d => d.type === 0).map((dub, dIdx) => (
                          <TouchableOpacity
                            key={`detail-dub-${dub.subject_id || dub.slug || dIdx}`}
                            style={styles.detailDubPill}
                            onPress={() => {
                              const isSeries = Boolean(detailData?.isSeries);
                              const se = isSeries ? (detailData?.seasons?.[selectedSeasonIdx]?.se || 1) : 0;
                              const ep = isSeries ? 1 : 0;
                              launchPlayer({
                                ...detailMovie,
                                subject_id: dub.subject_id,
                                slug: dub.slug || dub.detail_path,
                                name: `${detailMovie?.name || 'Title'} (${dub.label})`,
                                dubs: detailData.dubs,
                              }, se, ep, isSeries);
                            }}
                            activeOpacity={0.8}
                          >
                            <Feather name="volume-2" size={11} color="#FFFFFF" style={{ marginRight: 5 }} />
                            <Text style={styles.detailDubPillText}>{dub.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Available Multi-Language Subtitles */}
                  {Array.isArray(detailData?.subtitles) && detailData.subtitles.length > 0 && (
                    <View style={styles.detailDubsSection}>
                      <View style={styles.detailDubsHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialIcons name="subtitles" size={13} color="#46d369" style={{ marginRight: 6 }} />
                          <Text style={styles.detailDubsHeading}>Available Subtitles</Text>
                        </View>
                        <Text style={[styles.detailDubsCountBadge, { borderColor: 'rgba(70, 211, 105, 0.35)', color: '#46d369', backgroundColor: 'rgba(70, 211, 105, 0.12)' }]}>
                          {detailData.subtitles.length} Languages
                        </Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.detailDubsScroll}
                      >
                        {detailData.subtitles.map((subLan, sIdx) => (
                          <View
                            key={`detail-sub-${sIdx}`}
                            style={[styles.detailDubPill, { borderColor: 'rgba(70, 211, 105, 0.25)', backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}
                          >
                            <MaterialIcons name="closed-caption" size={11} color="#46d369" style={{ marginRight: 5 }} />
                            <Text style={styles.detailDubPillText}>{subLan}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Cast & Actresses with Photos from IMDb / TVMaze */}
                  {Boolean(detailImdb?.actors && detailImdb.actors.length > 0) && (
                    <View style={styles.detailCastSection}>
                      <View style={styles.detailCastHeaderRow}>
                        <Text style={styles.detailCastHeading}>
                          {detailData?.isSeries
                            ? `Cast & Actresses ${detailData?.seasons?.[selectedSeasonIdx]?.se ? `(Season ${detailData.seasons[selectedSeasonIdx].se})` : ''}`
                            : 'Starring Cast & Actresses'}
                        </Text>
                        <Text style={styles.detailCastCountBadge}>{detailImdb.actors.length} Cast</Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.detailCastScrollTrack}
                      >
                        {detailImdb.actors.map((castItem, idx) => {
                          const item = typeof castItem === 'string'
                            ? { name: castItem, character: '', image: null }
                            : castItem;
                          const initials = (item.name || '')
                            .split(' ')
                            .map((w) => w[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || '★';

                          return (
                            <View key={`cast-card-${item.name}-${idx}`} style={styles.detailCastCard}>
                              <View style={styles.detailCastAvatarWrapper}>
                                {item.image ? (
                                  <SafeImage
                                    uri={item.image}
                                    style={styles.detailCastAvatar}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View style={styles.detailCastAvatarFallback}>
                                    <Text style={styles.detailCastInitials}>{initials}</Text>
                                  </View>
                                )}
                              </View>
                              <Text numberOfLines={2} ellipsizeMode="tail" style={styles.detailCastNameText}>
                                {item.name}
                              </Text>
                              {Boolean(item.character) && (
                                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.detailCastRoleText}>
                                  {item.character}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Director from IMDb */}
                  {Boolean(detailImdb?.director && detailImdb.director !== 'N/A') && (
                    <View style={styles.detailDirectorRow}>
                      <Text style={styles.detailDirectorLabel}>Director:</Text>
                      <Text style={styles.detailDirectorValue}>{detailImdb.director}</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* SEASONS & EPISODES (FOR TV SERIES) */}
            {detailData?.isSeries && detailData?.seasons && detailData.seasons.length > 0 && (
              <View style={styles.episodesContainer}>
                {/* Season Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonPillsRow}
                  style={styles.seasonPillsScroll}
                >
                  {detailData.seasons.map((s, idx) => (
                    <TouchableOpacity
                      key={`season-pill-${s.se}-${idx}`}
                      style={[styles.seasonSelectPill, selectedSeasonIdx === idx && styles.seasonSelectPillActive]}
                      onPress={() => setSelectedSeasonIdx(idx)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.seasonSelectPillText, selectedSeasonIdx === idx && styles.seasonSelectPillTextActive]}>
                        Season {s.se}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Horizontal Episodes Slider */}
                <Text style={styles.episodesHeaderLabel}>Episodes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodesScrollTrack}>
                  {getEpisodesArray(detailData.seasons[selectedSeasonIdx]).map((ep, idx) => {
                    const se = detailData.seasons[selectedSeasonIdx]?.se || 1;
                    return (
                      <TouchableOpacity
                        key={`ep-${se}-${ep}-${idx}`}
                        style={styles.episodeGlassCard}
                        onPress={() => launchPlayer(detailMovie, se, ep, true)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.episodeImageWrapper}>
                          <SafeImage uri={detailMovie?.poster_url} style={styles.episodeImage} />
                          <View style={styles.episodePlayCenterIcon}>
                            <Feather name="play" size={16} color="#FFFFFF" />
                          </View>
                          {!isWeb && (
                            <TouchableOpacity
                              style={styles.epQuickDownloadBadge}
                              onPress={() => openDownloadModal(detailMovie, detailData, selectedSeasonIdx, ep)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Feather name="download" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.episodeCardTitle}>Episode {ep}</Text>
                        <Text style={styles.episodeCardSub}>Season {se}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* MORE LIKE THIS (NEW RELATED TITLES - NEVER SAME) */}
            {(relatedTitles.length > 0 ? relatedTitles : exploreGridList.slice(0, 10)).length > 0 && (
              <View style={styles.moreLikeThisSection}>
                <Text style={styles.sectionHeaderTitle}>More Like This</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalTrack}>
                  {(relatedTitles.length > 0 ? relatedTitles : exploreGridList.slice(0, 10)).map((item, idx) => (
                    <GlassMovieCard
                      key={`rec-${item.slug || item.subject_id}-${idx}`}
                      movie={item}
                      onPress={() => {
                        openDetail(item);
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ===================================================== */}
      {/* AUTO-UPDATE MODAL (pops automatically when new ver found) */}
      {/* ===================================================== */}
      <Modal
        visible={!isWeb && isUpdateModalOpen}
        animationType="slide"
        transparent={true}
        statusBarTranslucent
        onRequestClose={() => !isDownloadingApk && setIsUpdateModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => !isDownloadingApk && setIsUpdateModalOpen(false)}>
          <View style={styles.updateModalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.updateModalCard}>
                {/* Close btn */}
                {!isDownloadingApk && (
                  <TouchableOpacity
                    style={styles.updateModalCloseBtn}
                    onPress={() => setIsUpdateModalOpen(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Feather name="x" size={20} color="#8e8e93" />
                  </TouchableOpacity>
                )}

                {/* Icon + Title */}
                <View style={styles.updateModalIconHalo}>
                  <Feather
                    name={updateInfo?.hasUpdate ? 'arrow-up-circle' : 'check-circle'}
                    size={36}
                    color={updateInfo?.hasUpdate ? '#e50914' : '#FFFFFF'}
                  />
                </View>

                <Text style={styles.updateModalTitle}>
                  {updateInfo?.hasUpdate
                    ? `Update Available`
                    : updateInfo?.error
                      ? 'Update Check Failed'
                      : `You're up to date`}
                </Text>

                <Text style={styles.updateModalVersionRow}>
                  {updateInfo?.hasUpdate
                    ? `v${updateInfo.currentVersion}  →  v${updateInfo.latestVersion}`
                    : `v${updateInfo?.currentVersion || CURRENT_APP_VERSION} — Latest`}
                </Text>

                {/* Release notes */}
                {updateInfo?.hasUpdate && updateInfo.releaseNotes && (
                  <View style={styles.updateReleaseNotesBox}>
                    <Text style={styles.updateReleaseNotesTitle}>What's new:</Text>
                    <Text style={styles.updateReleaseNotesText} numberOfLines={8}>
                      {updateInfo.releaseNotes.replace(/#+\s*/g, '').replace(/[*_`]/g, '')}
                    </Text>
                  </View>
                )}

                {updateInfo?.error && (
                  <Text style={styles.updateModalErrorText}>{updateInfo.error}</Text>
                )}

                {/* Progress bar during download */}
                {isDownloadingApk && apkDownloadProgress && (
                  <View style={styles.apkProgressContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={styles.apkProgressLabel}>Downloading APK...</Text>
                      <Text style={styles.apkProgressLabel}>{apkDownloadProgress.percent}%</Text>
                    </View>
                    <View style={styles.apkProgressBarTrack}>
                      <View style={[styles.apkProgressBarFill, { width: `${apkDownloadProgress.percent || 0}%` }]} />
                    </View>
                    <Text style={[styles.apkProgressText, { marginTop: 6 }]}>
                      {apkDownloadProgress.writtenFormatted} / {apkDownloadProgress.totalFormatted}
                    </Text>
                  </View>
                )}

                {/* APK download error */}
                {apkDownloadError && !isDownloadingApk && (
                  <View style={[styles.apkErrorBox, { width: '100%' }]}>
                    <Feather name="alert-circle" size={14} color="#e50914" style={{ marginRight: 6 }} />
                    <Text style={styles.apkErrorText} numberOfLines={3}>{apkDownloadError}</Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.updateModalBtnRow}>
                  {updateInfo?.hasUpdate && !isDownloadingApk && (
                    <TouchableOpacity
                      style={styles.updateModalInstallBtn}
                      onPress={handleDownloadAndInstallApk}
                      activeOpacity={0.85}
                    >
                      <Feather name="download" size={16} color="#FFFFFF" style={{ marginRight: 7 }} />
                      <Text style={styles.updateModalInstallBtnText}>
                        Download & Install
                        {updateInfo?.apkAsset?.sizeFormatted ? ` (${updateInfo.apkAsset.sizeFormatted})` : ''}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {isDownloadingApk && (
                    <View style={[styles.updateModalInstallBtn, { backgroundColor: 'rgba(229,9,20,0.5)', justifyContent: 'center' }]}>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.updateModalInstallBtnText}>Downloading...</Text>
                    </View>
                  )}
                  {!isDownloadingApk && (
                    <TouchableOpacity
                      style={styles.updateModalSkipBtn}
                      onPress={() => setIsUpdateModalOpen(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.updateModalSkipBtnText}>
                        {updateInfo?.hasUpdate ? 'Skip for Now' : 'OK'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* SEPARATE INTRO LOADING SCREEN MODAL */}

      <Modal
        visible={isIntroLoading}
        animationType="fade"
        transparent={true}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        supportedOrientations={['landscape', 'portrait']}
        onRequestClose={() => {
          setIsIntroLoading(false);
          closePlayer();
        }}
      >
        <MovieflixIntroLoadingScreen
          movie={playerMovie}
          isSeries={isSeries}
          currentSeason={currentSe}
          currentEpisode={currentEp}
          loadingStream={loadingStream}
          activeStreamUrl={activeStreamUrl}
          streamError={streamError}
          onProceedToPlayer={() => {
            setIsIntroLoading(false);
            setIsPlayerOpen(true);
            enterFullscreenSystemBar();
          }}
          onCancel={() => {
            setIsIntroLoading(false);
            closePlayer();
          }}
          onRetry={() => {
            launchPlayer(playerMovie, currentSe, currentEp, isSeries);
          }}
        />
      </Modal>

      {/* FULLSCREEN CINEMATIC PLAYER */}
      <Modal
        visible={isPlayerOpen}
        animationType="fade"
        transparent={true}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        supportedOrientations={['landscape', 'portrait']}
        onRequestClose={closePlayer}
      >
        <View style={[styles.playerContainer, StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]}>
          <StatusBar hidden translucent />

          {activeStreamUrl ? (
            <ReelCustomPlayer
              key={`player-${playerMovie?.slug || playerMovie?.subject_id}-S${currentSe}-E${currentEp}-${activeResolution}`}
              videoUrl={activeStreamUrl}
              movie={playerMovie}
              imdbData={playerImdb}
              isSeries={isSeries}
              currentSeason={currentSe}
              currentEpisode={currentEp}
              availableStreams={availableStreams}
              activeResolution={activeResolution}
              availableCaptions={availableCaptions}
              availableAudioVariants={availableAudioVariants}
              initialResumeTime={playerResumeTime}
              onSwitchQuality={switchQuality}
              onSwitchAudioDub={switchAudioDub}
              onPlayNextEpisode={playNextEpisode}
              onProgressUpdate={handlePlayerProgressUpdate}
              onClose={closePlayer}
            />
          ) : (
            <View style={styles.playerLoadingCentered}>
              <View style={[styles.playerLoadingTopBar, { paddingTop: Math.max(insets.top, 14) }]}>
                <TouchableOpacity
                  style={styles.playerRoundGlassBtn}
                  onPress={closePlayer}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Feather name="arrow-left" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <Text numberOfLines={1} style={styles.playerLoadingTitleText}>
                  {playerMovie?.name || 'Movieflix'}
                  {isSeries ? ` · S${currentSe}:E${currentEp}` : ''}
                </Text>
              </View>

              {loadingStream ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#e50914" />
                  <Text style={styles.playerStatusMessage}>
                    {isSeries
                      ? `Loading S${currentSe}:E${currentEp} Stream...`
                      : "Loading High Quality Stream..."}
                  </Text>
                </View>
              ) : streamError ? (
                <View style={styles.playerErrorContainer}>
                  <Feather name="alert-circle" size={48} color="#e50914" />
                  <Text style={styles.playerErrorText}>{streamError}</Text>
                  <TouchableOpacity
                    style={styles.playerRetryBtn}
                    onPress={() => launchPlayer(playerMovie, currentSe, currentEp, isSeries)}
                  >
                    <Text style={styles.playerRetryBtnText}>Retry Connection</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.playerExitBtn} onPress={closePlayer}>
                    <Text style={styles.playerExitBtnText}>Exit Player</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#e50914" />
                  <Text style={styles.playerStatusMessage}>Connecting to stream...</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* DOWNLOAD SELECTION MODAL                             */}
      {/* ==================================================== */}
      <Modal
        visible={!isWeb && isDownloadModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDownloadModalOpen(false)}
      >
        <View style={styles.downloadModalBackdrop}>
          <View style={[styles.downloadModalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Top Handle & Close */}
            <View style={styles.sheetHandleRow}>
              <View style={styles.sheetDragBar} />
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIsDownloadModalOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color="#a3a3a3" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Title & Thumbnail Header */}
              <View style={styles.downloadHeaderItem}>
                <SafeImage uri={downloadMovie?.poster_url} style={styles.downloadHeaderPoster} />
                <View style={styles.downloadHeaderInfo}>
                  <Text numberOfLines={1} style={styles.downloadHeaderTitle}>{downloadMovie?.name}</Text>
                  <Text style={styles.downloadHeaderSub}>
                    {downloadDetail?.isSeries
                      ? `Season ${downloadDetail?.seasons?.[downloadSeasonIdx]?.se || 1} · ${selectedDownloadEps.length > 1 ? `${selectedDownloadEps.length} Episodes Selected` : `Episode ${selectedDownloadEps[0] || downloadEpisodeNum}`}`
                      : "Full Movie"}
                  </Text>
                  <View style={styles.safeTagPill}>
                    <Feather name="shield" size={10} color="#e50914" style={{ marginRight: 4 }} />
                    <Text style={styles.safeTagText}>Saved to Local Device Storage</Text>
                  </View>
                </View>
              </View>

              {/* 1. If Series: Season & Episode Picker (With Multi-Episode Batch Selection) */}
              {downloadDetail?.isSeries && downloadDetail?.seasons && downloadDetail.seasons.length > 0 && (
                <View style={styles.dlConfigSection}>
                  <View style={styles.dlSectionHeaderRow}>
                    <Text style={styles.dlSectionTitle}>1. Select Season & Episodes</Text>
                    <TouchableOpacity
                      style={styles.dlSelectAllBtn}
                      onPress={handleSelectAllEpisodes}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={
                          selectedDownloadEps.length === getEpisodesArray(downloadDetail.seasons[downloadSeasonIdx]).length
                            ? "check-square"
                            : "square"
                        }
                        size={14}
                        color="#e50914"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.dlSelectAllBtnText}>
                        {selectedDownloadEps.length === getEpisodesArray(downloadDetail.seasons[downloadSeasonIdx]).length
                          ? "Deselect All"
                          : "Select All"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Season Buttons */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 20 }}
                    style={{ marginBottom: 10 }}
                  >
                    {downloadDetail.seasons.map((s, idx) => (
                      <TouchableOpacity
                        key={`dl-se-btn-${s.se}-${idx}`}
                        style={[styles.dlSeasonPill, downloadSeasonIdx === idx && styles.dlSeasonPillActive]}
                        onPress={() => handleDownloadSeasonEpChange(idx, 1)}
                      >
                        <Text style={[styles.dlSeasonPillText, downloadSeasonIdx === idx && styles.dlSeasonPillTextActive]}>
                          Season {s.se}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Multi-Episode Buttons */}
                  <Text style={styles.dlSubheaderNote}>
                    Tap episodes to select multiple ({selectedDownloadEps.length} selected):
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    {getEpisodesArray(downloadDetail.seasons[downloadSeasonIdx]).map((ep) => {
                      const isSelected = selectedDownloadEps.includes(ep);
                      return (
                        <TouchableOpacity
                          key={`dl-ep-btn-${ep}`}
                          style={[styles.dlEpPillMulti, isSelected && styles.dlEpPillMultiActive]}
                          onPress={() => toggleEpisodeSelection(ep)}
                          activeOpacity={0.75}
                        >
                          {isSelected && (
                            <Feather name="check" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                          )}
                          <Text style={[styles.dlEpPillText, isSelected && styles.dlEpPillTextActive]}>
                            Ep {ep}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 2. Quality Picker with REAL Available Resolutions & Exact Stream Sizes */}
              <View style={styles.dlConfigSection}>
                <View style={styles.dlSectionHeaderRow}>
                  <Text style={styles.dlSectionTitle}>2. Available Qualities & Exact Sizes</Text>
                  {loadingDownloadOptions && (
                    <ActivityIndicator size="small" color="#e50914" />
                  )}
                </View>

                {loadingDownloadOptions ? (
                  <View style={styles.dlLoadingSkeleton}>
                    <ActivityIndicator size="small" color="#e50914" style={{ marginRight: 8 }} />
                    <Text style={styles.dlLoadingText}>Detecting real stream qualities & sizes...</Text>
                  </View>
                ) : downloadSources && downloadSources.length > 0 ? (
                  <View style={styles.dlOptionsGrid}>
                    {downloadSources.map((src, sIdx) => {
                      const res = src.resolution || '720p';
                      const isSelected = downloadQuality === res;
                      const realSizeStr = src.size && Number(src.size) > 0
                        ? formatBytes(Number(src.size))
                        : (res === '1080p' ? '~1.1 GB' : res === '720p' ? '~580 MB' : res === '480p' ? '~320 MB' : '~180 MB');
                      const formatBadge = src.format || 'MP4';

                      return (
                        <TouchableOpacity
                          key={`real-quality-${res}-${sIdx}`}
                          style={[styles.dlQualityCard, isSelected && styles.dlQualityCardActive]}
                          onPress={() => setDownloadQuality(res)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.dlQualityCardHeader}>
                            <View style={styles.dlQualityBadgeGroup}>
                              <Text style={[styles.dlQualityCardTitle, isSelected && styles.dlQualityCardTitleActive]}>
                                {res}
                              </Text>
                              <View style={styles.dlFormatTag}>
                                <Text style={styles.dlFormatTagText}>{formatBadge}</Text>
                              </View>
                            </View>
                            {isSelected && (
                              <Feather name="check-circle" size={15} color="#e50914" />
                            )}
                          </View>
                          <View style={styles.dlSizeRow}>
                            <Feather name="cpu" size={11} color={isSelected ? "#e50914" : "#8e8e93"} style={{ marginRight: 3 }} />
                            <Text style={[styles.dlQualityCardNote, isSelected && styles.dlQualityCardNoteActive]}>
                              {realSizeStr}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.dlOptionsGrid}>
                    {[
                      { id: '1080p', label: '1080p FHD', note: '~1.1 GB' },
                      { id: '720p', label: '720p HD', note: '~580 MB (Recommended)' },
                      { id: '480p', label: '480p SD', note: '~320 MB' },
                      { id: '360p', label: '360p Saver', note: '~180 MB' },
                    ].map((q) => {
                      const isSelected = downloadQuality === q.id;
                      return (
                        <TouchableOpacity
                          key={`quality-${q.id}`}
                          style={[styles.dlQualityCard, isSelected && styles.dlQualityCardActive]}
                          onPress={() => setDownloadQuality(q.id)}
                        >
                          <View style={styles.dlQualityCardHeader}>
                            <Text style={[styles.dlQualityCardTitle, isSelected && styles.dlQualityCardTitleActive]}>{q.label}</Text>
                            {isSelected && <Feather name="check-circle" size={15} color="#e50914" />}
                          </View>
                          <Text style={[styles.dlQualityCardNote, isSelected && styles.dlQualityCardNoteActive]}>{q.note}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 3. Audio / Dub Language Selector */}
              <View style={styles.dlConfigSection}>
                <Text style={styles.dlSectionTitle}>3. Select Spoken Audio</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['Original Audio (Default)', 'Hindi Dub', 'French Dub', 'Spanish Dub'].map((aud) => {
                    const isSelected = downloadAudio === aud;
                    return (
                      <TouchableOpacity
                        key={`dl-aud-${aud}`}
                        style={[styles.dlChip, isSelected && styles.dlChipActive]}
                        onPress={() => setDownloadAudio(aud)}
                      >
                        <Text style={[styles.dlChipText, isSelected && styles.dlChipTextActive]}>
                          {aud}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 4. Subtitle Language Selector */}
              <View style={styles.dlConfigSection}>
                <Text style={styles.dlSectionTitle}>4. Select Subtitle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['None', 'English', 'Hindi', 'Spanish', 'French', 'Arabic', 'Filipino', 'Portuguese', 'Indonesian', 'Russian'].map((sub) => {
                    const isSelected = downloadSubtitle === sub;
                    return (
                      <TouchableOpacity
                        key={`dl-sub-${sub}`}
                        style={[styles.dlChip, isSelected && styles.dlChipActive]}
                        onPress={() => setDownloadSubtitle(sub)}
                      >
                        <Text style={[styles.dlChipText, isSelected && styles.dlChipTextActive]}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Start Download Button */}
              <TouchableOpacity
                style={styles.dlStartButton}
                onPress={handleStartDownload}
                disabled={loadingDownloadOptions}
                activeOpacity={0.85}
              >
                {loadingDownloadOptions ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather
                      name="download"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.dlStartButtonText}>
                      {downloadDetail?.isSeries && selectedDownloadEps.length > 1
                        ? `Download ${selectedDownloadEps.length} Episodes (${downloadQuality})`
                        : `Start Download (${downloadQuality})`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* CATEGORIES & GENRES NAVIGATION MODAL                 */}
      {/* ==================================================== */}
      <Modal
        visible={isCategoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <View style={styles.categoryModalBackdrop}>
          <View style={[styles.categoryModalCard, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.categoryModalHeader}>
              <View>
                <Text style={styles.categoryModalTitle}>Categories & Genres</Text>
                <Text style={styles.categoryModalSubtitle}>Discover movies, series, and anime</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircleBtn}
                onPress={() => setIsCategoryModalOpen(false)}
                activeOpacity={0.8}
              >
                <Feather name="x" size={20} color="#f5f5f1" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryGridWrap}>
              {serverCategories.map((cat) => {
                const isSelected = homeCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={`cat-modal-${cat.id}`}
                    style={[styles.categoryCardItem, isSelected && styles.categoryCardItemActive]}
                    onPress={() => handleSelectCategory(cat.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.categoryCardIconBox, isSelected && styles.categoryCardIconBoxActive]}>
                      <Feather
                        name="film"
                        size={18}
                        color={isSelected ? "#FFFFFF" : "#e50914"}
                      />
                    </View>
                    <Text style={[styles.categoryCardLabel, isSelected && styles.categoryCardLabelActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* ASK NOTIFICATION PERMISSION PROMPT MODAL             */}
      {/* ==================================================== */}
      <Modal
        visible={!isWeb && showNotificationPrompt}
        transparent
        animationType="fade"
        onRequestClose={handleDismissNotificationPrompt}
      >
        <View style={styles.notifPromptBackdrop}>
          <View style={styles.notifPromptCard}>
            <View style={styles.notifPromptIconHalo}>
              <ExpoImage
                source={LOCAL_HEADER_ICON}
                style={{ width: 34, height: 38 }}
                contentFit="contain"
              />
            </View>

            <Text style={styles.notifPromptTitle}>Enable Notifications</Text>
            <Text style={styles.notifPromptSubtitle}>
              Stay updated on your downloads and healthy streaming reminders
            </Text>

            <View style={styles.notifPromptFeatureList}>
              <View style={styles.notifPromptFeatureRow}>
                <View style={styles.notifPromptFeatureIconWrap}>
                  <Feather name="download-cloud" size={18} color="#e50914" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifPromptFeatureTitle}>Offline Downloads Ready</Text>
                  <Text style={styles.notifPromptFeatureDesc}>
                    Get notified immediately when your movie or episode is ready to watch offline.
                  </Text>
                </View>
              </View>

              <View style={styles.notifPromptFeatureRow}>
                <View style={styles.notifPromptFeatureIconWrap}>
                  <Feather name="clock" size={18} color="#e50914" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifPromptFeatureTitle}>2-Hour Watch Break Reminders</Text>
                  <Text style={styles.notifPromptFeatureDesc}>
                    Gentle reminders during long sessions to stretch and rest your eyes.
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.notifPromptAllowBtn}
              onPress={handleAllowNotifications}
              activeOpacity={0.85}
            >
              <Feather name="bell" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.notifPromptAllowBtnText}>Allow Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.notifPromptDismissBtn}
              onPress={handleDismissNotificationPrompt}
              activeOpacity={0.7}
            >
              <Text style={styles.notifPromptDismissBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* ==================================================== */}
      {/* FLOATING APPLE-STYLE PILL BOTTOM NAVIGATION BAR       */}
      {/* ==================================================== */}
      {mainTab !== 'Shots' && (
        <View
          style={[
            styles.floatingNavWrapper,
            { bottom: Math.max(insets.bottom + 12, 18) },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[styles.floatingNavContainer, { width: floatingBarWidth }]}
            {...navPanResponder.panHandlers}
          >
            {/* Smooth Sliding Red Indicator Pill */}
            <Animated.View
              style={[
                styles.floatingNavIndicator,
                {
                  width: floatingTabWidth,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            />

            {/* Home Tab */}
            <TouchableOpacity
              style={styles.floatingNavTab}
              onPress={() => {
                if (mainTab !== 'Home') {
                  triggerHaptic('selection');
                  setMainTab('Home');
                }
              }}
              activeOpacity={0.8}
            >
              <Feather
                name="home"
                size={18}
                color={mainTab === 'Home' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)'}
              />
              <Text
                style={[
                  styles.floatingNavText,
                  mainTab === 'Home' && styles.floatingNavTextActive,
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>

            {/* Shots Tab (Center) */}
            <TouchableOpacity
              style={styles.floatingNavTab}
              onPress={() => {
                if (mainTab !== 'Shots') {
                  triggerHaptic('selection');
                  setMainTab('Shots');
                }
              }}
              activeOpacity={0.8}
            >
              <Feather
                name="film"
                size={18}
                color={mainTab === 'Shots' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)'}
              />
              <Text
                style={[
                  styles.floatingNavText,
                  mainTab === 'Shots' && styles.floatingNavTextActive,
                ]}
              >
                Shots
              </Text>
            </TouchableOpacity>

            {/* Me Tab */}
            <TouchableOpacity
              style={styles.floatingNavTab}
              onPress={() => {
                setMeDotDismissed(true);
                if (mainTab !== 'Me') {
                  triggerHaptic('selection');
                  setMainTab('Me');
                  setMeSubTab(null);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={{ position: 'relative' }}>
                <Feather
                  name="user"
                  size={18}
                  color={mainTab === 'Me' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)'}
                />
                {!isWeb && downloads.some((d) => d.status === 'downloading') ? (
                  <View style={styles.floatingNavDownloadBadge}>
                    <AnimatedDownloadSpinner size={9} color="#FFFFFF" />
                  </View>
                ) : !meDotDismissed && mainTab !== 'Me' && myList.length > 0 ? (
                  <View style={styles.floatingNavBadgeDot} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.floatingNavText,
                  mainTab === 'Me' && styles.floatingNavTextActive,
                ]}
              >
                Me
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ==================================================== */}
      {/* FLOATING TOAST NOTIFICATION                          */}
      {/* ==================================================== */}
      {toastMsg && (
        <View style={[styles.toastFloatingContainer, { top: insets.top + 16 }]}>
          <Feather name="info" size={16} color="#e50914" style={{ marginRight: 8 }} />
          <Text style={styles.toastFloatingText}>{toastMsg}</Text>
        </View>
      )}

      {/* ─── WEB ONLY: Install APK for Better Experience Floating Banner ─── */}
      {isWeb && showWebInstallBanner && !isDownloadPageOpen && !isPlayerOpen && !is404PageOpen && (
        <View style={styles.webInstallBanner} pointerEvents="box-none">
          <View style={styles.webInstallInner} pointerEvents="auto">
            <TouchableOpacity
              style={styles.webInstallContent}
              onPress={handleOpenDownload}
              activeOpacity={0.85}
            >
              <View style={styles.webInstallIconBox}>
                <Ionicons name="logo-android" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.webInstallTextCol}>
                <Text style={styles.webInstallTitle} numberOfLines={1}>
                  Install Movieflix APK for a better experience
                </Text>
                <Text style={styles.webInstallSubtitle} numberOfLines={1}>
                  Tap to download latest v1.1.6 · Faster stream · 0 ads
                </Text>
              </View>
              <View style={styles.webInstallBtn}>
                <Text style={styles.webInstallBtnText}>Install APK</Text>
                <Feather name="arrow-right" size={13} color="#FFFFFF" style={{ marginLeft: 3 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.webInstallCloseBtn}
              onPress={() => setShowWebInstallBanner(false)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={15} color="#888888" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ----------------------------------------------------
// CLEAN GLASS MOVIE CARD (PURE POSTER, NO TAGS OR BADGES)
// ----------------------------------------------------
const GlassMovieCard = React.memo(function GlassMovieCard({ movie, onPress, isSeries = false, isTop10 = false, style }) {
  const { width: winW } = useWindowDimensions();
  const isDesk = winW >= 1024;
  const isTab = winW >= 700 && winW < 1024;
  const responsiveWidth = isTop10 ? (isDesk ? 170 : isTab ? 140 : 125) : (isDesk ? 180 : isTab ? 150 : 130);

  if (!movie) return null;
  return (
    <TouchableOpacity
      style={[styles.movieCard, { width: responsiveWidth }, isTop10 && styles.movieCardTop10, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardImageContainer}>
        <SafeImage
          uri={movie.poster_url}
          style={styles.cardPosterImage}
          resizeMode="cover"
          contentPosition="center"
        />
        <View style={styles.cardGlassBorder} />
      </View>
    </TouchableOpacity>
  );
});

// ----------------------------------------------------
// SEPARATE MOVIEFLIX INTRO LOADING SCREEN
// Plays Netflix-style 6s intro cleanly without background movie playback
// ----------------------------------------------------
function MovieflixIntroLoadingScreen({
  movie,
  isSeries,
  currentSeason,
  currentEpisode,
  loadingStream,
  activeStreamUrl,
  streamError,
  onProceedToPlayer,
  onCancel,
  onRetry,
}) {
  const insets = useSafeAreaInsets();
  const [introEnded, setIntroEnded] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  const introSource = preloadedIntroUri ? { uri: preloadedIntroUri } : LOCAL_INTRO_ASSET;
  const introPlayer = useVideoPlayer(introSource, (p) => {
    p.loop = false;
    p.play();
  });

  const handleFinishIntro = useCallback(() => {
    setIntroEnded(true);
  }, []);

  useEffect(() => {
    enterFullscreenSystemBar();
  }, []);

  useEffect(() => {
    if (!introPlayer) return;
    try {
      introPlayer.currentTime = 0;
      introPlayer.play();
    } catch (e) {}

    const playEndSub = introPlayer.addListener('playToEnd', () => {
      handleFinishIntro();
    });

    const statusSub = introPlayer.addListener('statusChange', (status) => {
      if (status?.status === 'error') {
        handleFinishIntro();
      }
    });

    // Safety timeout: 6.5s (intro video duration is 6.0s)
    const timer = setTimeout(() => {
      handleFinishIntro();
    }, 6500);

    return () => {
      clearTimeout(timer);
      try { playEndSub?.remove?.(); } catch (e) {}
      try { statusSub?.remove?.(); } catch (e) {}
    };
  }, [introPlayer, handleFinishIntro]);

  // When intro ends, if stream is ready, smoothly transition to player!
  useEffect(() => {
    if (introEnded && Boolean(activeStreamUrl) && !loadingStream) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        try { introPlayer?.pause(); } catch (e) {}
        onProceedToPlayer();
      });
    }
  }, [introEnded, activeStreamUrl, loadingStream, fadeAnim, introPlayer, onProceedToPlayer]);

  return (
    <Animated.View style={[styles.introScreenContainer, StyleSheet.absoluteFillObject, { backgroundColor: '#000000', opacity: fadeAnim }]}>
      <StatusBar hidden translucent />

      {/* Intro Video layer if intro is still playing */}
      {!introEnded ? (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={introPlayer}
          nativeControls={false}
          allowsFullscreen={false}
          contentFit="contain"
        />
      ) : (
        /* Stream loading state if stream is still resolving after intro */
        <View style={styles.introStreamLoadingContainer}>
          {streamError ? (
            <View style={styles.introErrorBox}>
              <Feather name="alert-circle" size={48} color="#e50914" />
              <Text style={styles.introErrorTitle}>Unable to Stream</Text>
              <Text style={styles.introErrorSubtitle}>{streamError}</Text>
              <View style={styles.introErrorButtonsRow}>
                <TouchableOpacity style={styles.introRetryBtn} onPress={onRetry} activeOpacity={0.8}>
                  <Feather name="refresh-cw" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.introRetryBtnText}>Retry Connection</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.introCancelBtn} onPress={onCancel} activeOpacity={0.8}>
                  <Text style={styles.introCancelBtnText}>Exit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.introStreamLoadingBox}>
              <ActivityIndicator size="large" color="#e50914" />
              <Text style={styles.introMovieTitle} numberOfLines={1}>
                {movie?.name || 'Preparing Stream'}
              </Text>
              <Text style={styles.introStreamSubtitle}>
                {isSeries ? `Connecting Season ${currentSeason}, Episode ${currentEpisode}...` : 'Starting high definition playback...'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Top Header: Cancel / Close Button */}
      <View style={[styles.introTopBar, { top: Math.max(insets.top, 16), left: Math.max(insets.left, 20) }]}>
        <TouchableOpacity
          style={styles.introCloseBtn}
          onPress={onCancel}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Right: Skip Intro Button */}
      {!introEnded && (
        <View style={[styles.skipIntroContainer, { bottom: Math.max(insets.bottom, 24), right: Math.max(insets.right, 24) }]}>
          <TouchableOpacity
            style={styles.skipIntroBtn}
            onPress={handleFinishIntro}
            activeOpacity={0.8}
          >
            <Text style={styles.skipIntroText}>Skip Intro</Text>
            <Feather name="skip-forward" size={14} color="#f5f5f1" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

// ----------------------------------------------------
// CUSTOM FULLSCREEN VIDEO PLAYER (WITH REAL SUBTITLES & MULTI-AUDIO)
// ----------------------------------------------------
function ReelCustomPlayer({
  videoUrl,
  movie,
  imdbData,
  isSeries,
  currentSeason,
  currentEpisode,
  availableStreams,
  activeResolution,
  availableCaptions = [],
  availableAudioVariants = [],
  initialResumeTime = 0,
  onSwitchQuality,
  onSwitchAudioDub,
  onPlayNextEpisode,
  onProgressUpdate,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [currentSpeed, setCurrentSpeed] = useState('1.0×');
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);
  const [isAudioSubsModalOpen, setIsAudioSubsModalOpen] = useState(false);
  const [playerStatus, setPlayerStatus] = useState('loading');

  // Video Stretch / Zoom mode: 'contain' (Fit) | 'cover' (Zoom) | 'fill' (Stretch)
  const [contentFitMode, setContentFitMode] = useState('contain');

  // Subtitle / Audio State
  const [selectedSubtitle, setSelectedSubtitle] = useState('Off');
  const [selectedAudio, setSelectedAudio] = useState('Original Audio (Default)');
  const [streamAudioTracks, setStreamAudioTracks] = useState([]);
  const [streamSubTracks, setStreamSubTracks] = useState([]);
  const [subtitleCues, setSubtitleCues] = useState([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [loadingSubtitle, setLoadingSubtitle] = useState(false);
  const [activeTranslateLang, setActiveTranslateLang] = useState(null);

  const subtitleCuesRef = useRef([]);
  const activeTranslateLangRef = useRef(null);
  const hideTimerRef = useRef(null);
  const videoViewRef = useRef(null);

  // Brightness (0.05 to 1.0) & Volume (0.0 to 1.0) Gesture States
  const [brightness, setBrightness] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [showBrightnessHud, setShowBrightnessHud] = useState(false);
  const [showVolumeHud, setShowVolumeHud] = useState(false);
  const hudTimerRef = useRef(null);
  const brightnessRef = useRef(1.0);
  const volumeRef = useRef(1.0);

  // 2× Long Press Fast-Forward State
  const [is2xActive, setIs2xActive] = useState(false);
  const originalSpeedRef = useRef(1.0);

  // Double Tap 10s Feedback Animation
  const [doubleTapSide, setDoubleTapSide] = useState(null); // 'left' | 'right' | null
  const doubleTapFadeAnim = useRef(new Animated.Value(0)).current;
  const doubleTapTimerRef = useRef(null);

  // Picture in Picture State
  const [isInPiP, setIsInPiP] = useState(false);

  // Gesture Tracking Refs
  const showControlsRef = useRef(true);
  const currentSpeedRef = useRef('1.0×');
  const playerRef = useRef(null);
  const seekRelativeRef = useRef(null);
  const wakeControlsRef = useRef(null);
  const triggerDoubleTapFeedbackRef = useRef(null);
  const windowWidthRef = useRef(windowWidth);
  const windowHeightRef = useRef(windowHeight);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const lastTapXRef = useRef(0);
  const singleTapTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isLongPressActiveRef = useRef(false);
  const startDragValRef = useRef(0);
  const dragTypeRef = useRef(null); // 'brightness' | 'volume' | null

  // Keep dimension and timing refs current on every render
  windowWidthRef.current = windowWidth;
  windowHeightRef.current = windowHeight;
  durationRef.current = duration;
  currentTimeRef.current = currentTime;

  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  useEffect(() => {
    currentSpeedRef.current = currentSpeed;
  }, [currentSpeed]);

  useEffect(() => {
    brightnessRef.current = brightness;
  }, [brightness]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Query hardware screen brightness on mount and restore system brightness on unmount
  useEffect(() => {
    let isMounted = true;
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Brightness.getBrightnessAsync()
        .then((initial) => {
          if (isMounted && typeof initial === 'number' && !isNaN(initial) && initial > 0) {
            setBrightness(initial);
            brightnessRef.current = initial;
          }
        })
        .catch((e) => {
          console.log("Hardware brightness get note:", e);
        });
    }

    return () => {
      isMounted = false;
      if (Platform.OS === 'android') {
        Brightness.restoreSystemBrightnessAsync().catch((e) => {
          console.log("Hardware brightness restore note:", e);
        });
      }
    };
  }, []);

  const parseSpeed = (spdStr) => {
    const num = parseFloat(String(spdStr).replace('×', '').trim());
    return isNaN(num) || num <= 0 ? 1.0 : num;
  };

  const triggerHud = (type) => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    if (type === 'brightness') {
      setShowBrightnessHud(true);
      setShowVolumeHud(false);
    } else if (type === 'volume') {
      setShowVolumeHud(true);
      setShowBrightnessHud(false);
    }
    hudTimerRef.current = setTimeout(() => {
      setShowBrightnessHud(false);
      setShowVolumeHud(false);
    }, 1200);
  };

  const triggerDoubleTapFeedback = (side) => {
    setDoubleTapSide(side);
    doubleTapFadeAnim.setValue(1);
    if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
    Animated.sequence([
      Animated.timing(doubleTapFadeAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(doubleTapFadeAnim, {
        toValue: 0,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDoubleTapSide(null);
    });
  };

  // Bulletproof 2x speed release helper: ONLY active during hold, immediately reverts on release
  const end2xHold = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      setIs2xActive(false);
      const restoreSpeed = originalSpeedRef.current || 1.0;
      if (playerRef.current) {
        try {
          playerRef.current.playbackRate = restoreSpeed;
        } catch (_) {}
      }
    }
  };

  // PanResponder for Double Tap, Long Press 2x, Vertical Volume/Brightness Swipes, and Single Tap UI Toggle
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 8;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        end2xHold();
        isDraggingRef.current = false;
      },
      onPanResponderEnd: () => {
        end2xHold();
      },
      onPanResponderGrant: (evt) => {
        const { locationX } = evt.nativeEvent;
        const screenW = windowWidthRef.current || windowWidth || 800;

        isDraggingRef.current = false;
        isLongPressActiveRef.current = false;

        const isLeft = locationX < screenW / 2;
        dragTypeRef.current = isLeft ? 'brightness' : 'volume';
        startDragValRef.current = isLeft ? brightnessRef.current : volumeRef.current;

        // Long Press: 400ms hold -> 2× Speed (ONLY while held down)
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          if (!isDraggingRef.current) {
            isLongPressActiveRef.current = true;
            originalSpeedRef.current = parseSpeed(currentSpeedRef.current);
            if (playerRef.current) {
              try {
                playerRef.current.playbackRate = 2.0;
              } catch (_) {}
            }
            setIs2xActive(true);

            // Web: attach window listeners so releasing pointer/mouse anywhere in browser restores speed
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              const handleGlobalRelease = () => {
                end2xHold();
                window.removeEventListener('pointerup', handleGlobalRelease);
                window.removeEventListener('mouseup', handleGlobalRelease);
                window.removeEventListener('touchend', handleGlobalRelease);
                window.removeEventListener('pointercancel', handleGlobalRelease);
              };
              window.addEventListener('pointerup', handleGlobalRelease, { once: true });
              window.addEventListener('mouseup', handleGlobalRelease, { once: true });
              window.addEventListener('touchend', handleGlobalRelease, { once: true });
              window.addEventListener('pointercancel', handleGlobalRelease, { once: true });
            }
          }
        }, 400);
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 8) {
          isDraggingRef.current = true;
          end2xHold();

          const screenH = windowHeightRef.current || windowHeight || 400;
          const delta = -gestureState.dy / (screenH * 0.55);

          if (dragTypeRef.current === 'brightness') {
            const nextB = Math.max(0.05, Math.min(1.0, startDragValRef.current + delta));
            setBrightness(nextB);
            brightnessRef.current = nextB;
            if (Platform.OS === 'android' || Platform.OS === 'ios') {
              Brightness.setBrightnessAsync(nextB).catch(() => {});
            }
            triggerHud('brightness');
          } else if (dragTypeRef.current === 'volume') {
            const nextV = Math.max(0.0, Math.min(1.0, startDragValRef.current + delta));
            setVolume(nextV);
            volumeRef.current = nextV;
            if (playerRef.current) {
              try {
                playerRef.current.volume = nextV;
              } catch (_) {}
            }
            triggerHud('volume');
          }
        }
      },
      onPanResponderRelease: (evt) => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        // If user was in 2× speed hold mode, restore original playback speed immediately!
        const wasLongPress = isLongPressActiveRef.current;
        end2xHold();

        if (wasLongPress) {
          return;
        }

        // If user was dragging brightness or volume, finish drag without tapping
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          return;
        }

        // Tap handling: Single Tap vs Double Tap
        const x = evt.nativeEvent.locationX;
        const now = Date.now();
        const screenW = windowWidthRef.current || windowWidth || 800;

        if (now - lastTapTimeRef.current < 320 && Math.abs(x - lastTapXRef.current) < 90) {
          // DOUBLE TAP DETECTED: 10s move
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
          lastTapTimeRef.current = 0;

          if (x < screenW / 2) {
            try {
              if (seekRelativeRef.current) seekRelativeRef.current(-10);
              else seekRelative(-10);
            } catch (err) {
              console.warn('[Player] Double tap seek backward error:', err);
            }
            if (triggerDoubleTapFeedbackRef.current) {
              triggerDoubleTapFeedbackRef.current('left');
            } else {
              triggerDoubleTapFeedback('left');
            }
          } else {
            try {
              if (seekRelativeRef.current) seekRelativeRef.current(10);
              else seekRelative(10);
            } catch (err) {
              console.warn('[Player] Double tap seek forward error:', err);
            }
            if (triggerDoubleTapFeedbackRef.current) {
              triggerDoubleTapFeedbackRef.current('right');
            } else {
              triggerDoubleTapFeedback('right');
            }
          }
        } else {
          // SINGLE TAP: Toggle Player UI (show or close)
          lastTapTimeRef.current = now;
          lastTapXRef.current = x;

          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
          }
          singleTapTimerRef.current = setTimeout(() => {
            if (showControlsRef.current) {
              setShowControls(false);
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            } else {
              if (wakeControlsRef.current) wakeControlsRef.current();
              else wakeControls();
            }
          }, 320);
        }
      },
    })
  ).current;

  useEffect(() => {
    return () => {
      end2xHold();
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, []);

  useEffect(() => {
    activeTranslateLangRef.current = activeTranslateLang;
  }, [activeTranslateLang]);

  useEffect(() => {
    enterFullscreenSystemBar();
    return () => {
      exitFullscreenSystemBar();
    };
  }, []);

  const continuousWatchSecondsRef = useRef(0);

  // Schedule and track 2-hour break reminder while watching
  useEffect(() => {
    scheduleBreakReminder();

    const interval = setInterval(() => {
      if (isPlaying) {
        continuousWatchSecondsRef.current += 1;
        // Every 2 hours (7200 seconds), trigger break notification
        if (continuousWatchSecondsRef.current >= 7200) {
          notifyBreakTimeNow();
          continuousWatchSecondsRef.current = 0;
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      cancelBreakReminder();
    };
  }, [isPlaying]);

  // Auto-activate offline subtitle if available
  useEffect(() => {
    const localCap = availableCaptions.find(c => c.lan === 'local' || (typeof c.url === 'string' && c.url.startsWith('file://')));
    if (localCap && localCap.url) {
      setSelectedSubtitle(localCap.lanName || 'Downloaded Subtitle');
      FileSystem.readAsStringAsync(localCap.url)
        .then(srtText => {
          const parsed = parseSRT(srtText);
          subtitleCuesRef.current = parsed;
          setSubtitleCues(parsed);
        })
        .catch(console.warn);
    }
  }, [availableCaptions]);

  // Initialize expo-video player with anti-hotlink Referer headers
  const player = useVideoPlayer(buildVideoSource(videoUrl), (p) => {
    try {
      p.loop = false;
      p.timeUpdateEventInterval = 0.05; // 50ms interval (20 checks/second) ensures subtitles NEVER skip!
      if (initialResumeTime > 0) {
        p.currentTime = initialResumeTime;
      }
      p.play();
    } catch (e) {
      console.warn('[Player] useVideoPlayer setup note:', e);
    }
  });

  // Synchronously update playerRef with the active player instance on every render
  playerRef.current = player;

  // Handle stream url changes (e.g. Next Episode, Audio Dub, or Quality switch)
  const currentStreamUrlRef = useRef(videoUrl);
  useEffect(() => {
    if (player && videoUrl && videoUrl !== currentStreamUrlRef.current) {
      currentStreamUrlRef.current = videoUrl;
      const doReplace = async () => {
        try {
          const src = buildVideoSource(videoUrl);
          if (typeof player.replaceAsync === 'function') {
            await player.replaceAsync(src);
          } else if (typeof player.replace === 'function') {
            player.replace(src);
          }
          if (initialResumeTime > 0) {
            player.currentTime = initialResumeTime;
          }
          player.play();
        } catch (err) {
          console.warn('[Player] player.replaceAsync note:', err);
        }
      };
      doReplace();
    }
  }, [player, videoUrl, initialResumeTime]);

  useEffect(() => {
    playerRef.current = player;
    return () => {
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
  }, [player]);

  // Keep ref updated
  useEffect(() => {
    subtitleCuesRef.current = subtitleCues;
  }, [subtitleCues]);

  // Player state updates
  useEffect(() => {
    if (!player) return;

    const playSub = player.addListener('playingChange', (e) => {
      setIsPlaying(e.isPlaying);
    });

    const timeSub = player.addListener('timeUpdate', (e) => {
      setCurrentTime(e.currentTime);
      if (player.duration) {
        setDuration(player.duration);
        if (onProgressUpdate) {
          onProgressUpdate(e.currentTime, player.duration);
        }
      }

      // Real-time subtitle cue matching with 50ms pre-roll, 150ms hold, and instant translation
      if (subtitleCuesRef.current && subtitleCuesRef.current.length > 0) {
        const cur = e.currentTime;
        const matched = subtitleCuesRef.current.find(
          c => cur >= (c.start - 0.05) && cur <= (c.end + 0.15)
        );
        if (matched) {
          const tLang = activeTranslateLangRef.current;
          if (tLang && tLang !== 'en') {
            const cacheKey = `${tLang}:${matched.text}`;
            if (translationCache[cacheKey]) {
              setCurrentSubtitleText(translationCache[cacheKey]);
            } else {
              setCurrentSubtitleText(matched.text);
              translateText(matched.text, tLang).then(trans => {
                if (trans) setCurrentSubtitleText(trans);
              });
            }
          } else {
            setCurrentSubtitleText(matched.text);
          }
        } else {
          setCurrentSubtitleText('');
        }
      } else {
        setCurrentSubtitleText('');
      }
    });

    // Native audio and subtitle tracks from stream
    const audioSub = player.addListener?.('availableAudioTracksChange', (e) => {
      if (e.availableAudioTracks) {
        setStreamAudioTracks(e.availableAudioTracks);
      }
    });

    const subTrackSub = player.addListener?.('availableSubtitleTracksChange', (e) => {
      if (e.availableSubtitleTracks) {
        setStreamSubTracks(e.availableSubtitleTracks);
      }
    });

    const statusSub = player.addListener?.('statusChange', (e) => {
      if (e?.status) {
        setPlayerStatus(e.status);
      }
    });

    const playEndSub = player.addListener?.('playToEnd', () => {
      const isSeriesTitle = Boolean(isSeries || currentSeason > 0 || currentEpisode > 0 || movie?.isSeries);
      if (isSeriesTitle && onPlayNextEpisode) {
        onPlayNextEpisode();
      }
    });

    return () => {
      playSub?.remove?.();
      timeSub?.remove?.();
      audioSub?.remove?.();
      subTrackSub?.remove?.();
      statusSub?.remove?.();
      playEndSub?.remove?.();
    };
  }, [player]);

  // Handle source switch smoothly and seek to resume time if set
  useEffect(() => {
    setPlayerStatus('loading');
    const activePlayer = playerRef.current || player;
    if (videoUrl && activePlayer) {
      const src = buildVideoSource(videoUrl);
      const afterSwitch = () => {
        try {
          if (initialResumeTime > 0) {
            activePlayer.currentTime = initialResumeTime;
          }
          activePlayer.play();
        } catch (e) {
          console.warn('[Player] afterSwitch note:', e);
        }
      };
      try {
        if (typeof activePlayer.replaceAsync === 'function') {
          activePlayer.replaceAsync(src).then(afterSwitch).catch(console.warn);
        } else if (typeof activePlayer.replace === 'function') {
          activePlayer.replace(src);
          afterSwitch();
        }
      } catch (e) {
        console.warn('[Player] replace note:', e);
      }
    }
  }, [videoUrl, initialResumeTime]);

  const isBufferingOrLoading =
    playerStatus === 'loading' ||
    playerStatus === 'idle' ||
    (isPlaying && currentTime === 0 && duration === 0);

  // Auto-hide controls after 4 seconds
  const wakeControls = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  useEffect(() => {
    wakeControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Handle subtitle selection (direct SRT download or on-the-fly translation)
  const handleSelectSubtitle = async (langItem) => {
    if (!langItem || langItem === 'Off') {
      setSelectedSubtitle('Off');
      setActiveTranslateLang(null);
      subtitleCuesRef.current = [];
      setSubtitleCues([]);
      setCurrentSubtitleText('');
      if (player) player.subtitleTrack = null;
      setIsAudioSubsModalOpen(false);
      return;
    }

    const code = langItem.code || langItem.lan || 'en';
    const label = langItem.native
      ? `${langItem.name} (${langItem.native})`
      : getFriendlyLanguageName(langItem.lanName, langItem.lan);

    setSelectedSubtitle(label);
    setIsAudioSubsModalOpen(false);

    // 1. Direct match in availableCaptions
    const directCap = availableCaptions.find(c => {
      const cCode = (c.lan || '').toLowerCase();
      const cName = (c.lanName || '').toLowerCase();
      return cCode === code || (langItem.name && cName.includes(langItem.name.toLowerCase()));
    });

    if (directCap && directCap.url) {
      setActiveTranslateLang(null);
      setLoadingSubtitle(true);
      try {
        let srtText = '';
        if (typeof directCap.url === 'string' && directCap.url.startsWith('file://')) {
          srtText = await FileSystem.readAsStringAsync(directCap.url);
        } else {
          const fetchUrl = Platform.OS === 'web' && typeof directCap.url === 'string' && directCap.url.startsWith('http')
            ? `/api/proxy?url=${encodeURIComponent(directCap.url)}`
            : directCap.url;
          const res = await fetch(fetchUrl);
          srtText = await res.text();
        }
        const parsed = parseSRT(srtText);
        subtitleCuesRef.current = parsed;
        setSubtitleCues(parsed);
      } catch (err) {
        console.warn("Failed to load direct subtitle:", err);
      } finally {
        setLoadingSubtitle(false);
      }
      return;
    }

    // 2. Base caption with on-the-fly client-side translation
    const baseCap = availableCaptions.find(c => (c.lan || '').toLowerCase() === 'en') || availableCaptions[0];
    if (baseCap && baseCap.url) {
      setActiveTranslateLang(code);
      setLoadingSubtitle(true);
      try {
        const baseFetchUrl = Platform.OS === 'web' && typeof baseCap.url === 'string' && baseCap.url.startsWith('http')
          ? `/api/proxy?url=${encodeURIComponent(baseCap.url)}`
          : baseCap.url;
        const res = await fetch(baseFetchUrl);
        const srtText = await res.text();
        const parsed = parseSRT(srtText);
        subtitleCuesRef.current = parsed;
        setSubtitleCues(parsed);
        // Pre-translate first 5 cues
        parsed.slice(0, 5).forEach(c => translateText(c.text, code));
      } catch (err) {
        console.warn("Failed to load base subtitle for translation:", err);
      } finally {
        setLoadingSubtitle(false);
      }
    }
  };

  // Handle embedded subtitle track
  const handleSelectEmbeddedSubtitle = (track) => {
    setSelectedSubtitle(track.label || track.language || 'Embedded Sub');
    subtitleCuesRef.current = [];
    setSubtitleCues([]);
    setCurrentSubtitleText('');
    const activePlayer = playerRef.current || player;
    if (activePlayer) {
      try {
        activePlayer.subtitleTrack = track;
      } catch (e) {
        console.warn('[Player] set subtitleTrack note:', e);
      }
    }
    setIsAudioSubsModalOpen(false);
  };

  // Handle Dubbed Audio Variant Switch
  const handleSelectAudioVariant = (variant) => {
    if (!variant) return;
    setSelectedAudio(variant.label);
    setIsAudioSubsModalOpen(false);
    if (onSwitchAudioDub) {
      onSwitchAudioDub(variant, currentTime);
    }
  };

  // Handle stream audio track switch (multi-audio within same container)
  const handleSelectAudioTrack = (track) => {
    const activePlayer = playerRef.current || player;
    if (!track || track === 'default') {
      setSelectedAudio('Original Audio (Default)');
      if (activePlayer && streamAudioTracks.length > 0) {
        try {
          activePlayer.audioTrack = streamAudioTracks[0];
        } catch (e) {
          console.warn('[Player] set default audioTrack note:', e);
        }
      }
    } else {
      setSelectedAudio(track.label || track.language || 'Selected Audio');
      if (activePlayer) {
        try {
          activePlayer.audioTrack = track;
        } catch (e) {
          console.warn('[Player] set audioTrack note:', e);
        }
      }
    }
    setIsAudioSubsModalOpen(false);
  };

  // Cycle video fit mode: Fit (contain) -> Zoom (cover) -> Stretch (fill)
  const cycleContentFit = () => {
    wakeControls();

    // On Web: request browser fullscreen and lock to landscape orientation
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const docEl = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {});
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen().catch(() => {});
          }
        }
        if (window.screen?.orientation?.lock) {
          window.screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) {
        console.log("Web fullscreen/landscape request error:", e);
      }
    }

    if (contentFitMode === 'contain') {
      setContentFitMode('cover'); // Zoom to fill full browser landscape (no letterboxing)
    } else if (contentFitMode === 'cover') {
      setContentFitMode('fill'); // Stretch full landscape (no cropping)
    } else {
      setContentFitMode('contain'); // Original aspect ratio
    }
  };

  // Toggle Screen Orientation manually (Mobile) / Browser Fullscreen (Web)
  const toggleOrientation = async () => {
    wakeControls();
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        try {
          if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
              await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
              await elem.webkitRequestFullscreen();
            }
            if (window.screen?.orientation?.lock) {
              window.screen.orientation.lock('landscape').catch(() => {});
            }
          } else {
            if (document.exitFullscreen) {
              await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
              await document.webkitExitFullscreen();
            }
            if (window.screen?.orientation?.unlock) {
              window.screen.orientation.unlock();
            }
          }
        } catch (e) {
          console.log("Web fullscreen toggle error:", e);
        }
      }
      return;
    }
    try {
      const current = await ScreenOrientation.getOrientationAsync();
      const isCurrentlyLandscape =
        current === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

      if (isCurrentlyLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('visible').catch(() => {});
          NavigationBar.setBackgroundColorAsync('#000000').catch(() => {});
          NavigationBar.setButtonStyleAsync('light').catch(() => {});
        }
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        enterFullscreenSystemBar();
      }
    } catch (e) {
      console.log("Toggle orientation failed:", e);
    }
  };

  // Cycle playback speed
  const cycleSpeed = () => {
    wakeControls();
    const speeds = [
      { label: '1.0×', val: 1.0 },
      { label: '1.25×', val: 1.25 },
      { label: '1.5×', val: 1.5 },
      { label: '2.0×', val: 2.0 },
      { label: '0.75×', val: 0.75 },
    ];
    const currentIdx = speeds.findIndex(s => s.label === currentSpeed);
    const nextIdx = (currentIdx + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setCurrentSpeed(nextSpeed.label);
    const activePlayer = playerRef.current || player;
    if (activePlayer) {
      try {
        activePlayer.playbackRate = nextSpeed.val;
      } catch (e) {
        console.warn('[Player] Failed to set playbackRate:', e);
      }
    }
  };

  // Seek by delta seconds (with ultra-safe released SharedObject protection)
  const seekRelative = (delta) => {
    if (wakeControlsRef.current) wakeControlsRef.current();
    else wakeControls();

    const activePlayer = playerRef.current || player;
    if (!activePlayer) return;

    try {
      const cur = typeof activePlayer.currentTime === 'number' && !isNaN(activePlayer.currentTime)
        ? activePlayer.currentTime
        : (currentTimeRef.current || currentTime || 0);
      const dur = typeof activePlayer.duration === 'number' && !isNaN(activePlayer.duration)
        ? activePlayer.duration
        : (durationRef.current || duration || 0);
      const target = Math.max(0, dur > 0 ? Math.min(dur, cur + delta) : Math.max(0, cur + delta));

      // Attempt seekBy first if available, wrapped safely in its own try-catch
      if (typeof activePlayer.seekBy === 'function') {
        try {
          activePlayer.seekBy(delta);
          return;
        } catch (seekByErr) {
          console.warn('[Player] seekBy call threw, falling back to currentTime:', seekByErr);
        }
      }
      activePlayer.currentTime = target;
    } catch (err) {
      console.warn('[Player] seekRelative error caught and handled safely:', err);
    }
  };

  // Keep helper refs pointing to the latest functions
  seekRelativeRef.current = seekRelative;
  wakeControlsRef.current = wakeControls;
  triggerDoubleTapFeedbackRef.current = triggerDoubleTapFeedback;

  // Format time HH:MM:SS or MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const sStr = s < 10 ? `0${s}` : `${s}`;
    if (h > 0) {
      const mStr = m < 10 ? `0${m}` : `${m}`;
      return `${h}:${mStr}:${sStr}`;
    }
    return `${m}:${sStr}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={[styles.playerContainer, StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]}>
      {/* 
        UNDERLYING FULLSCREEN VIDEO VIEW
        nativeControls={false} completely eliminates duplicate player
        contentFit dynamically switches between 'contain' (Fit), 'cover' (Zoom), and 'fill' (Stretch)
      */}
      <VideoView
        ref={videoViewRef}
        style={[
          StyleSheet.absoluteFill,
          Platform.OS === 'web'
            ? { width: '100%', height: '100%', objectFit: contentFitMode }
            : { width: '100%', height: '100%' },
        ]}
        player={player}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={true}
        startsPictureInPictureAutomatically={true}
        contentFit={contentFitMode}
        onPictureInPictureStart={() => {
          setIsInPiP(true);
          setShowControls(false);
        }}
        onPictureInPictureStop={() => {
          setIsInPiP(false);
        }}
      />

      {/* Hardware brightness controls device screen backlight directly */}

      {/* REAL ON-SCREEN SUBTITLE OVERLAY */}
      {Boolean(currentSubtitleText && selectedSubtitle !== 'Off' && !isInPiP) && (
        <View
          style={[
            styles.subtitleOverlayContainer,
            { bottom: showControls ? 82 : 32, zIndex: 3 },
          ]}
          pointerEvents="none"
        >
          <View style={styles.subtitleTextBox}>
            <Text style={styles.subtitleTextContent}>{currentSubtitleText}</Text>
          </View>
        </View>
      )}

      {/* GESTURE DETECTOR: DOUBLE TAP (±10s), LONG PRESS (2×), VERTICAL SWIPES (VOL/BRIGHTNESS), SINGLE TAP (SHOW/HIDE) */}
      {!isInPiP && (
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 4 }]}
          {...panResponder.panHandlers}
        />
      )}

      {/* HUD: BRIGHTNESS LEVEL (LEFT DRAG) */}
      {!isInPiP && showBrightnessHud && (
        <View style={styles.hudCardLeft} pointerEvents="none">
          <Feather
            name={brightness > 0.25 ? "sun" : "moon"}
            size={22}
            color="#FFFFFF"
          />
          <View style={styles.hudTrack}>
            <View style={[styles.hudFill, { height: `${Math.round(brightness * 100)}%` }]} />
          </View>
          <Text style={styles.hudText}>{Math.round(brightness * 100)}%</Text>
        </View>
      )}

      {/* HUD: VOLUME LEVEL (RIGHT DRAG) */}
      {!isInPiP && showVolumeHud && (
        <View style={styles.hudCardRight} pointerEvents="none">
          <Feather
            name={volume <= 0.01 ? "volume-x" : volume < 0.5 ? "volume-1" : "volume-2"}
            size={22}
            color="#FFFFFF"
          />
          <View style={styles.hudTrack}>
            <View style={[styles.hudFill, { height: `${Math.round(volume * 100)}%` }]} />
          </View>
          <Text style={styles.hudText}>{Math.round(volume * 100)}%</Text>
        </View>
      )}

      {/* HUD: 2× LONG PRESS SPEED PILL BANNER */}
      {!isInPiP && is2xActive && (
        <View style={styles.speed2xBanner} pointerEvents="none">
          <Feather name="fast-forward" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.speed2xBannerText}>2× Speed</Text>
        </View>
      )}

      {/* HUD: DOUBLE TAP 10s FEEDBACK RIPPLE */}
      {!isInPiP && doubleTapSide === 'left' && (
        <Animated.View style={[styles.doubleTapRippleLeft, { opacity: doubleTapFadeAnim }]} pointerEvents="none">
          <Feather name="rewind" size={26} color="#FFFFFF" />
          <Text style={styles.doubleTapRippleText}>10s</Text>
        </Animated.View>
      )}
      {!isInPiP && doubleTapSide === 'right' && (
        <Animated.View style={[styles.doubleTapRippleRight, { opacity: doubleTapFadeAnim }]} pointerEvents="none">
          <Feather name="fast-forward" size={26} color="#FFFFFF" />
          <Text style={styles.doubleTapRippleText}>10s</Text>
        </Animated.View>
      )}

      {/* STREAM BUFFERING / FETCHING LOADER OVERLAY */}
      {!isInPiP && isBufferingOrLoading && (
        <View style={styles.playerLoaderCenteredOverlay} pointerEvents="none">
          <View style={styles.playerLoaderBox}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.playerLoaderText}>
              {playerStatus === 'loading' || (isPlaying && currentTime === 0)
                ? (isSeries ? `Buffering S${currentSeason}:E${currentEpisode}...` : 'Buffering Stream...')
                : 'Connecting stream...'}
            </Text>
          </View>
        </View>
      )}

      {/* OVERLAY CONTROLS (FULLSCREEN SAFE-AREA POSITIONING) */}
      {!isInPiP && showControls && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.playerControlsOverlay,
            { zIndex: 10 },
          ]}
          pointerEvents="box-none"
        >
          {/* TOP BAR */}
          <View
            style={[
              styles.playerTopBar,
              {
                paddingTop: Math.max(insets.top, 14),
                paddingHorizontal: Math.max(insets.left, insets.right, 16),
              },
            ]}
          >
            {/* Back Button */}
            <TouchableOpacity
              style={styles.playerRoundGlassBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Title Capsule (Single Text line so it NEVER wraps or overflows) */}
            <View style={styles.playerTitleCapsule}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.playerTitleMain}>
                {movie?.name}
                {isSeries ? ` · S${currentSeason}:E${currentEpisode}` : ''}
              </Text>
            </View>

            {/* Right Quick Controls */}
            <View style={styles.playerTopRightGroup}>
              {/* Picture in Picture Button */}
              <TouchableOpacity
                style={styles.playerGlassPillBtn}
                onPress={async () => {
                  try {
                    setShowControls(false);
                    if (videoViewRef.current?.startPictureInPicture) {
                      await videoViewRef.current.startPictureInPicture();
                    }
                  } catch (e) {
                    console.log("PiP start note:", e);
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="tv" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.playerGlassPillText}>PiP</Text>
              </TouchableOpacity>

              {/* Quality Pill */}
              <TouchableOpacity
                style={styles.playerGlassPillBtn}
                onPress={() => { wakeControls(); setIsQualityModalOpen(true); }}
              >
                <Text style={styles.playerGlassPillText}>{activeResolution.toUpperCase()}</Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.playerRoundGlassBtn}
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* CENTER CONTROLS (EXACT CENTER OVER THE VIDEO) */}
          <View style={styles.playerCenterRow}>
            {/* Seek Back -10s */}
            <TouchableOpacity
              style={styles.playerSeekRoundBtn}
              onPress={() => seekRelative(-10)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="replay-10" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Big Play / Pause Button */}
            <TouchableOpacity
              style={styles.playerPlayBigRoundBtn}
              onPress={() => {
                wakeControls();
                const activePlayer = playerRef.current || player;
                try {
                  if (isPlaying) activePlayer?.pause?.();
                  else activePlayer?.play?.();
                } catch (e) {
                  console.warn('[Player] Play/Pause center button error:', e);
                }
              }}
              activeOpacity={0.8}
            >
              {isBufferingOrLoading ? (
                <ActivityIndicator size="small" color="#e50914" />
              ) : (
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={36}
                  color="#FFFFFF"
                  style={!isPlaying ? { marginLeft: 4 } : {}}
                />
              )}
            </TouchableOpacity>

            {/* Seek Forward +10s */}
            <TouchableOpacity
              style={styles.playerSeekRoundBtn}
              onPress={() => seekRelative(10)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="forward-10" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Next Episode Center Button (when series) */}
            {Boolean(isSeries || currentSeason > 0 || currentEpisode > 0 || movie?.isSeries || movie?.subjectType === 2) && onPlayNextEpisode && (
              <TouchableOpacity
                style={[styles.playerSeekRoundBtn, { marginLeft: 12 }]}
                onPress={() => {
                  wakeControls();
                  onPlayNextEpisode();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="skip-forward" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* BOTTOM CONTROLS BAR (PINNED TO BOTTOM OF SCREEN) */}
          <View
            style={[
              styles.playerBottomBar,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                paddingHorizontal: Math.max(insets.left, insets.right, 20),
              },
            ]}
          >
            {/* Interactive Scrubber Rail */}
            <View
              style={styles.scrubberTouchableArea}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                wakeControls();
                const activePlayer = playerRef.current || player;
                const dur = durationRef.current || duration || 0;
                if (dur > 0 && activePlayer) {
                  try {
                    const locationX = e.nativeEvent.locationX;
                    const screenW = windowWidthRef.current || windowWidth || 800;
                    const ratio = Math.max(0, Math.min(1, locationX / (screenW - 40)));
                    activePlayer.currentTime = ratio * dur;
                  } catch (err) {
                    console.warn('[Player] Scrubber grant error:', err);
                  }
                }
              }}
              onResponderMove={(e) => {
                wakeControls();
                const activePlayer = playerRef.current || player;
                const dur = durationRef.current || duration || 0;
                if (dur > 0 && activePlayer) {
                  try {
                    const locationX = e.nativeEvent.locationX;
                    const screenW = windowWidthRef.current || windowWidth || 800;
                    const ratio = Math.max(0, Math.min(1, locationX / (screenW - 40)));
                    activePlayer.currentTime = ratio * dur;
                  } catch (err) {
                    console.warn('[Player] Scrubber move error:', err);
                  }
                }
              }}
            >
              <View style={styles.scrubberRail}>
                <View style={[styles.scrubberFill, { width: `${progressPercent}%` }]} />
                <View style={[styles.scrubberKnob, { left: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* Times & Options Row */}
            <View style={styles.playerBottomOptionsRow}>
              {/* Left: Mini Play/Pause and Timecode */}
              <View style={styles.playerTimeGroup}>
                <TouchableOpacity
                  onPress={() => {
                    wakeControls();
                    const activePlayer = playerRef.current || player;
                    try {
                      if (isPlaying) activePlayer?.pause?.();
                      else activePlayer?.play?.();
                    } catch (e) {
                      console.warn('[Player] Mini play/pause button error:', e);
                    }
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name={isPlaying ? "pause" : "play"} size={16} color="#FFFFFF" style={{ marginRight: 10 }} />
                </TouchableOpacity>
                <Text style={styles.playerTimecodeText}>
                  {formatTime(currentTime)} <Text style={{ color: '#737373' }}>/ {formatTime(duration)}</Text>
                </Text>
              </View>

              {/* Right: Actions Group */}
              <View style={styles.playerActionsGroup}>
                {/* 1. Zoom / Stretch Tool (Fit -> Zoom -> Stretch) */}
                <TouchableOpacity style={styles.playerGlassActionBtn} onPress={cycleContentFit}>
                  <MaterialIcons
                    name={contentFitMode === 'contain' ? 'aspect-ratio' : contentFitMode === 'cover' ? 'crop' : 'fit-screen'}
                    size={14}
                    color="#FFFFFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.playerGlassActionText}>
                    {contentFitMode === 'contain' ? 'Fit' : contentFitMode === 'cover' ? 'Zoom' : 'Stretch'}
                  </Text>
                </TouchableOpacity>

                {/* 2. Audio & Subtitles Sheet Button */}
                <TouchableOpacity
                  style={styles.playerGlassActionBtn}
                  onPress={() => { wakeControls(); setIsAudioSubsModalOpen(true); }}
                >
                  <MaterialIcons name="subtitles" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.playerGlassActionText}>Audio/Subs</Text>
                </TouchableOpacity>

                {/* 3. Playback Speed */}
                <TouchableOpacity style={styles.playerGlassActionBtn} onPress={cycleSpeed}>
                  <Text style={styles.playerGlassActionText}>{currentSpeed}</Text>
                </TouchableOpacity>

                {/* 4. Next Episode (for Series) */}
                {Boolean(isSeries || currentSeason > 0 || currentEpisode > 0 || movie?.isSeries || movie?.subjectType === 2) && onPlayNextEpisode && (
                  <TouchableOpacity
                    style={styles.playerGlassActionBtn}
                    onPress={() => { wakeControls(); onPlayNextEpisode(); }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="skip-forward" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.playerGlassActionText}>Next</Text>
                  </TouchableOpacity>
                )}

                {/* 5. Orientation / Rotate Button */}
                <TouchableOpacity style={styles.playerGlassActionBtn} onPress={toggleOrientation}>
                  <Feather name="maximize" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* VIDEO QUALITY MODAL */}
      <Modal visible={isQualityModalOpen} transparent animationType="fade" onRequestClose={() => setIsQualityModalOpen(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsQualityModalOpen(false)}
        >
          <View style={styles.glassModalSheet}>
            <Text style={styles.glassModalTitle}>Select Video Quality</Text>
            {availableStreams && availableStreams.length > 0 ? (
              availableStreams.map((s, idx) => {
                const isSelected = s.resolution === activeResolution;
                return (
                  <TouchableOpacity
                    key={`res-${s.resolution || idx}`}
                    style={[styles.modalOptionItem, isSelected && styles.modalOptionItemActive]}
                    onPress={() => {
                      onSwitchQuality(s);
                      setIsQualityModalOpen(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                      {s.resolution ? s.resolution.toUpperCase() : 'Stream Quality'}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#e50914" />}
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyNoticeText}>Standard 720p HD Stream Active</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* REAL AUDIO & SUBTITLES MODAL */}
      <Modal visible={isAudioSubsModalOpen} transparent animationType="fade" onRequestClose={() => setIsAudioSubsModalOpen(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsAudioSubsModalOpen(false)}
        >
          <View style={styles.glassModalSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={styles.glassModalTitle}>Audio & Subtitles</Text>
              <TouchableOpacity onPress={() => setIsAudioSubsModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x-circle" size={20} color="#a3a3a3" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} style={{ maxHeight: 380 }}>
              {/* Audio Language Selection */}
              <Text style={styles.modalSectionSubTitle}>AUDIO TRACK / DUB</Text>

              {/* Sibling Audio Dubs (e.g. Hindi, English, Original) */}
              {availableAudioVariants && availableAudioVariants.length > 0 ? (
                availableAudioVariants.map((v, idx) => {
                  const isSelected = selectedAudio === v.label || (selectedAudio === 'Original Audio (Default)' && v.label.includes('Original'));
                  return (
                    <TouchableOpacity
                      key={`dub-${v.slug || v.subject_id || idx}`}
                      style={[styles.modalOptionItem, isSelected && styles.modalOptionItemActive]}
                      onPress={() => handleSelectAudioVariant(v)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Feather name="volume-2" size={16} color={isSelected ? "#e50914" : "#a3a3a3"} style={{ marginRight: 8 }} />
                        <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]} numberOfLines={1}>
                          {v.label} {v.name && v.name !== v.label ? `(${v.name.slice(0, 24)})` : ''}
                        </Text>
                      </View>
                      {isSelected && <Feather name="check" size={16} color="#e50914" />}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <TouchableOpacity
                  style={[styles.modalOptionItem, styles.modalOptionItemActive]}
                  onPress={() => handleSelectAudioTrack('default')}
                >
                  <Text style={[styles.modalOptionText, styles.modalOptionTextActive]}>
                    Original Audio (Default)
                  </Text>
                  <Feather name="check" size={16} color="#e50914" />
                </TouchableOpacity>
              )}

              {/* Embedded Audio Tracks if present */}
              {streamAudioTracks.map((t, idx) => {
                const label = t.label || t.language || `Stream Audio ${idx + 1}`;
                const isSelected = selectedAudio === label;
                return (
                  <TouchableOpacity
                    key={`audio-stream-${t.id || idx}`}
                    style={[styles.modalOptionItem, isSelected && styles.modalOptionItemActive]}
                    onPress={() => handleSelectAudioTrack(t)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Feather name="music" size={15} color={isSelected ? "#e50914" : "#a3a3a3"} style={{ marginRight: 8 }} />
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                        {label} (Embedded)
                      </Text>
                    </View>
                    {isSelected && <Feather name="check" size={16} color="#e50914" />}
                  </TouchableOpacity>
                );
              })}

              {/* Subtitles Selection */}
              <Text style={[styles.modalSectionSubTitle, { marginTop: 18 }]}>
                SUBTITLES (ALL LANGUAGES AVAILABLE)
              </Text>

              {/* Off Option */}
              <TouchableOpacity
                style={[styles.modalOptionItem, selectedSubtitle === 'Off' && styles.modalOptionItemActive]}
                onPress={() => handleSelectSubtitle('Off')}
              >
                <Text style={[styles.modalOptionText, selectedSubtitle === 'Off' && styles.modalOptionTextActive]}>
                  Off
                </Text>
                {selectedSubtitle === 'Off' && <Feather name="check" size={16} color="#e50914" />}
              </TouchableOpacity>

              {/* ALL 20 Global Subtitle Languages */}
              {ALL_SUBTITLE_LANGUAGES.map((lang, idx) => {
                const label = `${lang.name} (${lang.native})`;
                const isSelected = selectedSubtitle === label || selectedSubtitle === lang.name;
                const hasDirectSrt = availableCaptions.some(c => (c.lan || '').toLowerCase() === lang.code || (c.lanName && c.lanName.toLowerCase().includes(lang.name.toLowerCase())));
                return (
                  <TouchableOpacity
                    key={`lang-${lang.code}-${idx}`}
                    style={[styles.modalOptionItem, isSelected && styles.modalOptionItemActive]}
                    onPress={() => handleSelectSubtitle(lang)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Feather name="message-square" size={15} color={isSelected ? "#e50914" : "#a3a3a3"} style={{ marginRight: 8 }} />
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                        {label}
                      </Text>
                      {hasDirectSrt && (
                        <View style={{ marginLeft: 8, backgroundColor: 'rgba(229, 9, 20, 0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ color: '#e50914', fontSize: 10, fontWeight: '700' }}>HQ</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && <Feather name="check" size={16} color="#e50914" />}
                  </TouchableOpacity>
                );
              })}

              {/* Embedded Subtitle Tracks */}
              {streamSubTracks.map((st, idx) => {
                const label = st.label || st.language || `Subtitle Track ${idx + 1}`;
                const isSelected = selectedSubtitle === label;
                return (
                  <TouchableOpacity
                    key={`sub-${st.id || idx}`}
                    style={[styles.modalOptionItem, isSelected && styles.modalOptionItemActive]}
                    onPress={() => handleSelectEmbeddedSubtitle(st)}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                      {label} (Embedded)
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#e50914" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ----------------------------------------------------
// CLEAN GLASS STYLESHEET (MATCHING REEL HTML)
// ----------------------------------------------------
const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  // SAFE IMAGE FALLBACK
  fallbackImageContainer: {
    backgroundColor: '#171717',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // TOP NAVIGATION
  topNavBar: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10,
  },
  navBarGlassContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    paddingVertical: 2,
  },
  brandLogoBtn: {
    padding: 2,
    marginRight: 10,
  },
  headerLogoImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  searchCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
    paddingHorizontal: 4,
    height: 36,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerNotificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#e50914',
  },
  headerCategoriesBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 9, 20, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // FILTER TABS
  tabsRow: {
    marginTop: 10,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
  },
  tabsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.22)',
  },
  tabPillActive: {
    backgroundColor: '#e50914',
    borderWidth: 1,
    borderColor: '#e50914',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 4,
  },
  tabPillText: {
    color: '#b3b3b3',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // MAIN SCROLLVIEW
  mainScrollView: {
    flex: 1,
  },

  // HERO SECTION (CLASSIC FULL-BLEED CINEMATIC BANNER)
  heroSection: {
    position: 'relative',
    width: '100%',
    height: 520,
    justifyContent: 'flex-end',
    paddingBottom: 22,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  heroPosterImage: {
    width: '100%',
    height: '100%',
  },
  heroTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 1,
  },
  smokePlume: {
    position: 'absolute',
    borderRadius: 999,
  },
  smokePlume1: {
    bottom: 25,
    left: 15,
    width: 90,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  smokePlume2: {
    bottom: 35,
    right: 20,
    width: 85,
    height: 28,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
  },
  heroBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
    zIndex: 1,
  },
  heroContent: {
    width: '100%',
    paddingHorizontal: 20,
    zIndex: 2,
    alignItems: 'center',
  },
  heroTitleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f5f5f1',
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  heroMatchScore: {
    color: '#e50914',
    fontWeight: '700',
    fontSize: 13,
  },
  metaGlassPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  metaGlassPillText: {
    color: '#f5f5f1',
    fontSize: 11,
    fontWeight: '600',
  },
  heroGenreText: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  heroSynopsis: {
    color: '#d6d6e0',
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
    textAlign: 'center',
    maxWidth: '92%',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  heroPlayButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  heroListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  heroListButtonText: {
    color: '#f5f5f1',
    fontWeight: '600',
    fontSize: 13,
  },
  heroInfoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  heroDot: {
    height: 4,
    borderRadius: 2,
  },
  heroDotActive: {
    width: 20,
    backgroundColor: '#e50914',
  },
  heroDotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },

  // SKELETON LOADING HOMEPAGE
  skeletonContainer: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  skeletonHeroBox: {
    height: 420,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 28,
    justifyContent: 'flex-end',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonHeroBottom: {
    gap: 12,
  },
  skeletonTitleBar: {
    width: '60%',
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  skeletonMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonPillSmall: {
    width: 50,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonPillMed: {
    width: 80,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  skeletonBtn: {
    width: 100,
    height: 38,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  skeletonBtnRound: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  skeletonRowWrapper: {
    marginBottom: 26,
    paddingHorizontal: 16,
  },
  skeletonRowTitle: {
    width: 120,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 14,
  },
  skeletonCard: {
    width: 120,
    height: 175,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },

  // CATALOG SECTIONS
  rowSection: {
    marginBottom: 24,
  },
  rowHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rowSectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f5f5f1',
    letterSpacing: -0.2,
  },
  sectionBadgeCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.28)',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f5f5f1',
    paddingHorizontal: 16,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  recommendationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingRight: 16,
  },
  seeAllBtnText: {
    color: '#e50914',
    fontSize: 12,
    fontWeight: '700',
    paddingRight: 16,
    marginBottom: 12,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 12,
  },
  seeMoreText: {
    color: '#e50914',
    fontSize: 12,
    fontWeight: '700',
  },
  continueWatchingCard: {
    width: 140,
  },
  continueWatchingThumbWrap: {
    width: 140,
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#202020',
    position: 'relative',
  },
  continueWatchingThumb: {
    width: '100%',
    height: '100%',
  },
  continueWatchingPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueWatchingProgressBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  continueWatchingProgressFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  continueWatchingTitle: {
    color: '#f5f5f1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  continueWatchingSubtitle: {
    color: '#8c8c8c',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  horizontalTrack: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // MOVIE CARD (CLEAN PURE POSTER, NO TEXT OVERLAY)
  movieCard: {
    width: 130,
    aspectRatio: 2 / 3,
    borderRadius: 14,
    overflow: 'hidden',
  },
  movieCardTop10: {
    width: 125,
  },
  cardImageContainer: {
    width: '100%',
    height: '100%',
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#171717',
  },
  cardPosterImage: {
    width: '100%',
    height: '100%',
  },
  cardGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  cardBadgeContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
  },
  badgeBase: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeTrending: {
    backgroundColor: '#e50914',
  },
  badgeNetflix: {
    backgroundColor: '#e50914',
  },
  badgeNew: {
    backgroundColor: '#00b4d8',
  },
  badgeAnime: {
    backgroundColor: '#8b5cf6',
  },
  badge2026: {
    backgroundColor: '#eab308',
  },
  badgeHd: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  badgeSeries: {
    backgroundColor: '#e50914',
  },
  badgeDefault: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  badgeFhd: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // TOP 10 TODAY STYLED WRAPPER
  top10CardWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginRight: 8,
  },
  top10RankNumber: {
    fontSize: 88,
    fontWeight: '900',
    color: '#1a1a1a',
    marginRight: -16,
    marginBottom: -10,
    zIndex: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.25)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },

  // GRID VIEW (SEARCH & CATEGORIES)
  gridSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  searchResultsContainer: {
    paddingTop: 12,
  },
  myListContainer: {
    paddingTop: 12,
  },
  emptyListPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyPlaceholderTitle: {
    color: '#f5f5f1',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyPlaceholderDesc: {
    color: '#a3a3a3',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  explorePillBtn: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  explorePillBtnText: {
    color: '#f5f5f1',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyNoticeText: {
    color: '#a3a3a3',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingFeedText: {
    color: '#a3a3a3',
    fontSize: 13,
    marginTop: 12,
  },

  // DETAIL MODAL STYLING
  detailContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  detailCloseButton: {
    position: 'absolute',
    right: 18,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeroBackdrop: {
    position: 'relative',
    height: 390,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  detailRealPosterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginTop: 26,
  },
  detailRealPosterCard: {
    width: 220,
    aspectRatio: 2 / 3, // REAL CINEMA POSTER RATIO
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#141414',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 10,
  },
  detailRealPosterImage: {
    width: '100%',
    height: '100%',
  },
  detailPosterGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  detailTitleSection: {
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  exploreGridSection: {
    marginTop: 10,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  exploreGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  loadMoreContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  loadMoreButtonText: {
    color: '#f5f5f1',
    fontSize: 14,
    fontWeight: '700',
  },
  detailTitle: {
    color: '#f5f5f1',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailMatchScore: {
    color: '#e50914',
    fontWeight: '700',
    fontSize: 13,
  },
  detailDurationText: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  detailActionsBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    marginVertical: 14,
  },
  detailPlayButton: {
    flex: 1.4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  detailPlayButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  detailDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  detailDownloadButtonText: {
    color: '#f5f5f1',
    fontWeight: '700',
    fontSize: 13,
  },
  detailListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  detailListButtonText: {
    color: '#f5f5f1',
    fontWeight: '700',
    fontSize: 13,
  },
  detailOverviewSection: {
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  detailOverviewText: {
    color: '#d6d6e0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailGenresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genrePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  genrePillText: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  detailDubsSection: {
    marginTop: 14,
    marginBottom: 6,
  },
  detailDubsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailDubsHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f5f5f1',
    letterSpacing: 0.3,
  },
  detailDubsCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  detailDubsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  detailDubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
  },
  detailDubPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imdbRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 197, 24, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.45)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imdbRatingLogo: {
    backgroundColor: '#f5c518',
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginRight: 5,
    letterSpacing: -0.2,
  },
  imdbRatingValue: {
    color: '#f5c518',
    fontSize: 12,
    fontWeight: '800',
  },
  imdbVotesText: {
    color: '#a3a3a3',
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '600',
  },
  detailCastSection: {
    marginTop: 22,
    marginBottom: 8,
  },
  detailCastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailCastHeading: {
    color: '#e5e5e5',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailCastCountBadge: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
  },
  detailCastScrollTrack: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingRight: 16,
  },
  detailCastCard: {
    width: 80,
    marginRight: 12,
    alignItems: 'center',
  },
  detailCastAvatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: 'rgba(229, 9, 20, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCastAvatar: {
    width: '100%',
    height: '100%',
  },
  detailCastAvatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCastInitials: {
    color: '#e50914',
    fontSize: 16,
    fontWeight: '800',
  },
  detailCastNameText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 14,
  },
  detailCastRoleText: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  detailDirectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  detailDirectorLabel: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  detailDirectorValue: {
    color: '#d4d4d4',
    fontSize: 12,
    fontWeight: '600',
  },
  playerImdbBadge: {
    backgroundColor: 'rgba(245, 197, 24, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  playerImdbBadgeText: {
    color: '#f5c518',
    fontSize: 11,
    fontWeight: '800',
  },

  // EPISODES SECTION
  episodesContainer: {
    paddingHorizontal: 18,
    marginBottom: 24,
  },
  seasonPillsScroll: {
    marginBottom: 12,
  },
  seasonPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
  },
  seasonSelectPill: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 8,
  },
  seasonSelectPillActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.25)',
    borderColor: '#e50914',
  },
  seasonSelectPillText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },
  seasonSelectPillTextActive: {
    color: '#f5f5f1',
  },
  episodesHeaderLabel: {
    color: '#f5f5f1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  episodesScrollTrack: {
    gap: 12,
  },
  episodeGlassCard: {
    width: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 6,
  },
  episodeImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 6,
  },
  episodeImage: {
    width: '100%',
    height: '100%',
  },
  episodePlayCenterIcon: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeCardTitle: {
    color: '#f5f5f1',
    fontSize: 12,
    fontWeight: '700',
  },
  episodeCardSub: {
    color: '#737373',
    fontSize: 10,
    marginTop: 2,
  },
  moreLikeThisSection: {
    marginBottom: 20,
  },

  // ----------------------------------------------------
  // VIDEO PLAYER STYLES (FULLSCREEN, RESPONSIVE)
  // ----------------------------------------------------
  playerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  playerControlsOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  playerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  playerRoundGlassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerTitleCapsule: {
    flex: 1,
    marginHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  playerTitleMain: {
    color: '#f5f5f1',
    fontSize: 13,
    fontWeight: '700',
  },
  playerTopRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerGlassPillBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  playerGlassPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // PLAYER CENTER CONTROLS
  playerCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  playerSeekRoundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerPlayBigRoundBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(229, 9, 20, 0.85)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },

  // REAL SUBTITLE OVERLAY
  subtitleOverlayContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  subtitleTextBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    maxWidth: '85%',
  },
  subtitleTextContent: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    lineHeight: 22,
  },

  // PLAYER BOTTOM CONTROLS
  playerBottomBar: {
    width: '100%',
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
  },
  scrubberTouchableArea: {
    width: '100%',
    height: 24,
    justifyContent: 'center',
  },
  scrubberRail: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    position: 'relative',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 2,
  },
  scrubberKnob: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginLeft: -7,
  },
  playerBottomOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    width: '100%',
  },
  playerTimeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  playerTimecodeText: {
    color: '#f5f5f1',
    fontSize: 12,
    fontWeight: '600',
  },
  playerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerGlassActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  playerGlassActionText: {
    color: '#f5f5f1',
    fontSize: 11,
    fontWeight: '700',
  },

  // PLAYER LOADING & ERROR
  playerLoadingCentered: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerStatusMessage: {
    color: '#f5f5f1',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  playerLoaderCenteredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
  },
  playerLoaderBox: {
    backgroundColor: 'rgba(20, 20, 20, 0.88)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  playerLoaderText: {
    color: '#f5f5f1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: 0.3,
  },
  playerLoadingTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  playerLoadingTitleText: {
    color: '#f5f5f1',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 14,
    flex: 1,
  },
  playerErrorContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  playerErrorText: {
    color: '#e50914',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  playerRetryBtn: {
    backgroundColor: '#e50914',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  playerRetryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  playerExitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  playerExitBtnText: {
    color: '#a3a3a3',
    fontSize: 13,
  },

  // BRIGHTNESS & VOLUME HUD CARDS
  hudCardLeft: {
    position: 'absolute',
    left: 36,
    top: '50%',
    transform: [{ translateY: -70 }],
    width: 48,
    height: 140,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 16, 20, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    zIndex: 15,
  },
  hudCardRight: {
    position: 'absolute',
    right: 36,
    top: '50%',
    transform: [{ translateY: -70 }],
    width: 48,
    height: 140,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 16, 20, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    zIndex: 15,
  },
  hudTrack: {
    width: 6,
    height: 64,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  hudFill: {
    width: '100%',
    backgroundColor: '#e50914',
    borderRadius: 3,
  },
  hudText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // 2× SPEED BANNER (LONG PRESS)
  speed2xBanner: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.94)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  speed2xBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // DOUBLE TAP 10S FEEDBACK
  doubleTapRippleLeft: {
    position: 'absolute',
    left: 48,
    top: '50%',
    transform: [{ translateY: -40 }],
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 22,
  },
  doubleTapRippleRight: {
    position: 'absolute',
    right: 48,
    top: '50%',
    transform: [{ translateY: -40 }],
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 22,
  },
  doubleTapRippleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  // MODAL BOTTOM SHEETS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  glassModalSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 20,
    maxHeight: '75%',
  },
  glassModalTitle: {
    color: '#f5f5f1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalSectionSubTitle: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalOptionItemActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalOptionText: {
    color: '#a3a3a3',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOptionTextActive: {
    color: '#e50914',
  },

  // FLOATING APPLE-STYLE PILL BOTTOM NAVIGATION BAR
  floatingNavWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  floatingNavContainer: {
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(18, 18, 22, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 22,
    elevation: 16,
    overflow: 'hidden',
  },
  floatingNavIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 24,
    backgroundColor: '#e50914',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  floatingNavTab: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 2,
  },
  floatingNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 0.2,
  },
  floatingNavTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  floatingNavBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#e50914',
  },
  floatingNavDownloadBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: 1,
  },

  // ME SCREEN STYLES (CLEAN & MINIMAL REDESIGN)
  meScreenContainer: {
    paddingHorizontal: 20,
  },
  meMinimalProfileContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 30,
  },
  meProfileHero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  meAvatarLarge: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  meAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  meAvatarOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2.5,
    borderColor: '#121212',
  },
  meProfileUsername: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 14,
    textAlign: 'center',
  },
  meProfileEmail: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
    textAlign: 'center',
  },
  meMinimalAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 12,
  },
  meMinimalAuthBtnText: {
    color: '#d4d4d4',
    fontSize: 12,
    fontWeight: '600',
  },
  meMinimalStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 18,
    marginTop: 24,
    marginBottom: 20,
  },
  meMinimalStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  meMinimalStatCount: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  meMinimalStatLabel: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  meMinimalStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  meMinimalLinksContainer: {
    width: '100%',
    marginBottom: 16,
  },
  meMinimalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  meMinimalLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meMinimalLinkText: {
    color: '#d4d4d4',
    fontSize: 14,
    fontWeight: '500',
  },
  meMinimalAppFooter: {
    alignItems: 'center',
    width: '100%',
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  meMinimalVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  meMinimalAppName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meMinimalVersionText: {
    color: '#8e8e93',
    fontStyle: 'italic',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  meMinimalStatusPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  meMinimalStatusText: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '600',
  },
  meMinimalUpdateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 6,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  meMinimalUpdateActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  meMinimalSecurityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  meMinimalSecurityText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  meHeaderGlassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 16,
  },
  meUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  meAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e50914',
    position: 'relative',
  },
  meOnlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e50914',
    borderWidth: 2,
    borderColor: '#141414',
  },
  meUserInfo: {
    marginLeft: 14,
    flex: 1,
  },
  meUserName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  meUserSubtext: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  meStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  meStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  meStatNumber: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  meStatLabel: {
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 2,
  },
  meStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  meSegmentBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  meSegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  meSegmentTabActive: {
    backgroundColor: '#e50914',
  },
  meSegmentTabText: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
  },
  meSegmentTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ME HUB NAVIGATION BUTTONS (PAGE DOWN)
  meNavSection: {
    marginBottom: 20,
  },
  meNavSectionHeader: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  meNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  meNavIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  meNavTextCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  meNavTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  meNavTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  meNavSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '400',
  },
  meNavBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  meNavBadgeText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '700',
  },

  // MINIMAL APP UPDATES SECTION
  minimalUpdateContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
    marginTop: 6,
    marginBottom: 28,
  },
  minimalUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minimalUpdateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  minimalUpdateIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  minimalUpdateTextBox: {
    marginLeft: 10,
    flex: 1,
  },
  minimalUpdateVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimalUpdateTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  minimalUpdateVersionBadge: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  minimalUpdateNewBadge: {
    backgroundColor: '#e50914',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  minimalUpdateNewBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  minimalUpdateSubtitle: {
    color: '#737373',
    fontSize: 11,
    marginTop: 1,
  },
  minimalCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  minimalCheckBtnText: {
    color: '#d4d4d4',
    fontSize: 11,
    fontWeight: '600',
  },
  minimalUpdateNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  minimalUpdateNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  minimalProgressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  minimalProgressBarFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  minimalProgressText: {
    color: '#a3a3a3',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'right',
  },
  minimalErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  minimalErrorText: {
    color: '#ef4444',
    fontSize: 11,
    flex: 1,
  },
  securityVerifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  securityVerifyText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  securityTamperBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    borderBottomWidth: 1,
    borderBottomColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 9999,
  },
  securityTamperTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  securityTamperDesc: {
    color: '#fecaca',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  securityTamperBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  securityTamperBtnText: {
    color: '#7f1d1d',
    fontSize: 12,
    fontWeight: '800',
  },

  // SUBPAGE HEADER STYLES
  meSubPageContainer: {
    marginBottom: 20,
  },
  meSubPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  meSubPageBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 10,
  },
  meSubPageBackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  meSubPageTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  meSubPageHeaderRight: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  meTabSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clearAllBtnText: {
    color: '#e50914',
    fontSize: 12,
    fontWeight: '700',
  },
  storageInfoText: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '600',
  },

  // WATCH HISTORY CARDS
  historyCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  historyThumbContainer: {
    width: 65,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#262626',
  },
  historyThumbImage: {
    width: '100%',
    height: '100%',
  },
  historyPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyThumbProgressBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  historyThumbProgressFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  historyInfoCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  historyTitleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyMetaPills: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  epPill: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  epPillText: {
    color: '#e50914',
    fontSize: 10,
    fontWeight: '800',
  },
  moviePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  moviePillText: {
    color: '#d4d4d4',
    fontSize: 10,
    fontWeight: '800',
  },
  historyPercentText: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '600',
  },
  historyTimeAgoText: {
    color: '#737373',
    fontSize: 10,
  },
  historyActionsCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 75,
    paddingVertical: 4,
  },
  historyResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  historyResumeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  historyDeleteBtn: {
    padding: 6,
  },

  // MY LIST IN ME
  myListCardWrapper: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 14,
  },
  myListQuickRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },

  // DOWNLOADS LIST
  downloadCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  downloadThumbWrapper: {
    width: 65,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#262626',
  },
  downloadThumb: {
    width: '100%',
    height: '100%',
  },
  downloadQualityBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  downloadQualityBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  downloadInfoCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  downloadTitleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  downloadTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  downloadSubTag: {
    color: '#a3a3a3',
    fontSize: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  downloadProgressBlock: {
    marginTop: 2,
  },
  downloadProgressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  downloadProgressBarFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  downloadProgressText: {
    color: '#a3a3a3',
    fontSize: 10,
    fontWeight: '600',
  },
  downloadReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadReadyText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '600',
  },
  downloadFailedText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
  downloadActionsCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 75,
    paddingVertical: 4,
  },
  playOfflineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  playOfflineBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cancelDownloadBtn: {
    padding: 6,
  },
  deleteDownloadBtn: {
    padding: 6,
  },
  emptyMePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
    paddingHorizontal: 24,
  },

  // DETAIL ACTION BAR DOWNLOAD BUTTON
  detailDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flex: 1,
    marginHorizontal: 5,
  },
  detailDownloadButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  epQuickDownloadBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },

  // DOWNLOAD MODAL SHEET
  downloadModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  downloadModalSheet: {
    backgroundColor: '#141416',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    maxHeight: '84%',
  },
  sheetHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 14,
  },
  sheetDragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#525252',
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: 6,
  },
  downloadHeaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 10,
    borderRadius: 12,
  },
  downloadHeaderPoster: {
    width: 45,
    height: 64,
    borderRadius: 8,
  },
  downloadHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  downloadHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  downloadHeaderSub: {
    color: '#a3a3a3',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 4,
  },
  safeTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  safeTagText: {
    color: '#e50914',
    fontSize: 9,
    fontWeight: '700',
  },
  dlConfigSection: {
    marginBottom: 16,
  },
  dlSectionTitle: {
    color: '#d4d4d4',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dlSeasonPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dlSeasonPillActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderColor: '#e50914',
  },
  dlSeasonPillText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },
  dlSeasonPillTextActive: {
    color: '#e50914',
    fontWeight: '700',
  },
  dlEpPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dlEpPillActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  dlEpPillText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },
  dlEpPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dlOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dlQualityCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dlQualityCardActive: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
  },
  dlQualityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dlQualityCardTitle: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '700',
  },
  dlQualityCardTitleActive: {
    color: '#FFFFFF',
  },
  dlQualityCardNote: {
    color: '#737373',
    fontSize: 10,
  },
  dlQualityCardNoteActive: {
    color: '#e50914',
    fontWeight: '600',
  },
  dlChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dlChipActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderColor: '#e50914',
  },
  dlChipText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },
  dlChipTextActive: {
    color: '#e50914',
    fontWeight: '700',
  },
  dlStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dlStartButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // ANIMATED DOWNLOAD COMPONENTS
  downloadPulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
  },
  downloadPulseBadgeText: {
    color: '#e50914',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  downloadActiveThumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadProgressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  downloadSizeCounter: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '600',
  },
  downloadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bottomNavDownloadBadge: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e50914',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
  },

  // DOWNLOAD MODAL MULTI-EPISODE SELECTION
  dlSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dlSelectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
  },
  dlSelectAllBtnText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '700',
  },
  dlSubheaderNote: {
    color: '#737373',
    fontSize: 10,
    fontWeight: '500',
  },
  dlEpPillMulti: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dlEpPillMultiActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },

  // DOWNLOAD MODAL REAL QUALITY CARDS
  dlLoadingSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dlLoadingText: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
  },
  dlQualityBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dlFormatTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  dlFormatTagText: {
    color: '#a3a3a3',
    fontSize: 8,
    fontWeight: '800',
  },
  dlSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  // FLOATING TOAST
  toastFloatingContainer: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 20, 22, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  toastFloatingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // CATEGORY HEADER IN FEED
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  categoryHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  categoryHeaderSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  categoryResetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  categoryResetText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },

  // OFFLINE NOTICE CARD
  offlineNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
  },
  offlineIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  offlineTextBox: {
    flex: 1,
  },
  offlineTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  offlineSubtitle: {
    color: '#a3a3a3',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  offlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  offlineSeeDownloadsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
  },
  offlineSeeDownloadsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  offlineRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  offlineRetryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  offlineFullContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  offlineIconBoxLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  offlineFullTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  offlineFullSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  offlineFullDownloadsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 280,
    marginBottom: 12,
  },
  offlineFullDownloadsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  offlineFullRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  offlineFullRetryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // NO RESULT CARD
  noResultCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  noResultIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noResultTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultDesc: {
    color: '#8e8e93',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 300,
  },
  noResultBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noResultClearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  noResultClearBtnText: {
    color: '#e5e5e5',
    fontSize: 13,
    fontWeight: '600',
  },
  noResultExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e50914',
  },
  noResultExploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // CATEGORY MODAL
  categoryModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  categoryModalCard: {
    backgroundColor: '#141416',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  categoryModalSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    justifyContent: 'space-between',
  },
  categoryCardItem: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  categoryCardItemActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderColor: '#e50914',
  },
  categoryCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryCardIconBoxActive: {
    backgroundColor: '#e50914',
  },
  categoryCardLabel: {
    color: '#d4d4d4',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryCardLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // NOTIFICATIONS MODAL
  notificationsModalCard: {
    backgroundColor: '#141416',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  notifIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContentWrap: {
    flex: 1,
  },
  notifTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTagText: {
    color: '#e50914',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  notifTimeText: {
    color: '#737373',
    fontSize: 10,
    fontWeight: '500',
  },
  notifTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifDesc: {
    color: '#a3a3a3',
    fontSize: 11,
    lineHeight: 16,
  },

  // NETFLIX-STYLE SKIP INTRO OVERLAY
  skipIntroContainer: {
    position: 'absolute',
    zIndex: 9999,
  },
  skipIntroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 22, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  skipIntroText: {
    color: '#f5f5f1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ASK NOTIFICATION PERMISSION PROMPT MODAL
  notifPromptBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  notifPromptCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#161618',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  notifPromptIconHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(229, 9, 20, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  notifPromptTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  notifPromptSubtitle: {
    color: '#8e8e93',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  notifPromptFeatureList: {
    width: '100%',
    marginBottom: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  notifPromptFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  notifPromptFeatureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  notifPromptFeatureTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifPromptFeatureDesc: {
    color: '#a3a3a3',
    fontSize: 11,
    lineHeight: 16,
  },
  notifPromptAllowBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  notifPromptAllowBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  notifPromptDismissBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  notifPromptDismissBtnText: {
    color: '#737373',
    fontSize: 13,
    fontWeight: '600',
  },

  // SEPARATE MOVIEFLIX INTRO LOADING SCREEN
  introScreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  introStreamLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  introStreamLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 420,
  },
  introMovieTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  introStreamSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  introTopBar: {
    position: 'absolute',
    zIndex: 999,
  },
  introCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  introErrorBox: {
    alignItems: 'center',
    maxWidth: 380,
  },
  introErrorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  introErrorSubtitle: {
    color: '#a3a3a3',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  introErrorButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  introRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  introRetryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  introCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  introCancelBtnText: {
    color: '#e5e5e5',
    fontSize: 14,
    fontWeight: '500',
  },

  // ─── IN-APP UPDATE UI STYLES ────────────────────────────────────────────────

  // Check for Updates card (inside Me tab)
  updateCheckCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  updateCheckHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateCheckIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateCheckTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  updateCheckSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
  },
  updateAvailableBadge: {
    backgroundColor: '#e50914',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 6,
  },
  updateAvailableBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  updateBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  updateBannerText: {
    color: '#f5f5f1',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  updateCheckBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  updateCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  updateInstallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  updateCheckBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // APK Download Progress Bar
  apkProgressContainer: {
    marginTop: 12,
    width: '100%',
  },
  apkProgressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  apkProgressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#e50914',
  },
  apkProgressText: {
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  apkProgressLabel: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },
  apkErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(229,9,20,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.2)',
    padding: 10,
  },
  apkErrorText: {
    color: '#e50914',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },

  // Auto Update Popup Modal
  updateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  updateModalCard: {
    backgroundColor: '#161618',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  updateModalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 18,
    zIndex: 10,
  },
  updateModalIconHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 10,
  },
  updateModalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 5,
  },
  updateModalVersionRow: {
    color: '#8e8e93',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  updateReleaseNotesBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    marginBottom: 16,
  },
  updateReleaseNotesTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  updateReleaseNotesText: {
    color: '#a3a3a3',
    fontSize: 13,
    lineHeight: 20,
  },
  updateModalErrorText: {
    color: '#e50914',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  updateModalBtnRow: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  updateModalInstallBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  updateModalInstallBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  updateModalSkipBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  updateModalSkipBtnText: {
    color: '#737373',
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── Auth Popup Sheet Styles ────────────────────────────────────────────
  authBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 999999,
  },
  authCard: {
    width: '100%',
    maxWidth: 370,
    backgroundColor: '#151515',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  authCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  authLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  authLogoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e50914',
    marginRight: 8,
  },
  authLogoText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  authSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  authSegmentTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  authSegmentTabActive: {
    backgroundColor: '#e50914',
  },
  authSegmentText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '700',
  },
  authSegmentTextActive: {
    color: '#fff',
  },
  authSubtitle: {
    color: '#777',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  authInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  authInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 0,
  },
  authErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229,9,20,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  authError: {
    color: '#e50914',
    fontSize: 12,
    flex: 1,
  },
  authSubmitBtn: {
    backgroundColor: '#e50914',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  authSubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  // ─── Me Tab Auth Button ─────────────────────────────────────────────────
  meAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  meAuthBtnLogout: {
    backgroundColor: '#2a2a2a',
  },
  meAuthBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // ─── Web Install APK Floating Banner ────────────────────────────────────
  webInstallBanner: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    bottom: Platform.OS === 'web' ? 76 : 64,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999999,
    paddingHorizontal: 12,
  },
  webInstallInner: {
    width: '100%',
    maxWidth: 540,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.55)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 25,
  },
  webInstallContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webInstallIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  webInstallTextCol: {
    flex: 1,
    marginRight: 8,
  },
  webInstallTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  webInstallSubtitle: {
    color: '#999999',
    fontSize: 11,
    marginTop: 1,
  },
  webInstallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  webInstallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  webInstallCloseBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  // ─── Instagram-Style 9:16 Shots Feed Styles ───────────────────────────
  shotsTopHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  shotsBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shotsBrandText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  shotsLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e50914',
    marginLeft: 6,
  },
  shotsHeaderBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  shotsQualityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  shotsQualityBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  shotsHeaderIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  shotsQualitySheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: '#262626',
  },
  shotsQualityOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  shotsQualityOptionText: {
    color: '#CCCCCC',
    fontSize: 15,
    fontWeight: '600',
  },
  shotsQualityOptionTextActive: {
    color: '#e50914',
    fontWeight: '800',
  },
  shotsHelpBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotsBufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  shotsHeartBurst: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -45,
    marginTop: -45,
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  shotsPlayPauseIndicator: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    marginLeft: -35,
    marginTop: -35,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  shots2xHUD: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    zIndex: 95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
  },
  shots2xHUDText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  shotsRightColumn: {
    position: 'absolute',
    right: 12,
    bottom: 24,
    alignItems: 'center',
    gap: 16,
    zIndex: 20,
  },
  shotsAvatarContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  shotsAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#e50914',
  },
  shotsAvatarBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotsActionBtn: {
    alignItems: 'center',
    gap: 3,
  },
  shotsActionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotsActionCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shotsVinylContainer: {
    marginTop: 4,
  },
  shotsVinylRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111111',
    borderWidth: 2.5,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  shotsVinylCenter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotsBottomOverlay: {
    position: 'absolute',
    left: 14,
    bottom: 24,
    right: 80,
    zIndex: 20,
  },
  shotsAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  shotsAuthorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shotsVerifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#e50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotsEpisodeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shotsEpisodeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  shotsTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shotsTagsText: {
    color: '#e50914',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  shotsAudioTickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shotsAudioTickerText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  shotsBufferingText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  shotsUnmuteBadge: {
    position: 'absolute',
    top: 56,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 90,
  },
  shotsUnmuteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  shotsEpisodeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginVertical: 6,
    alignSelf: 'flex-start',
  },
  shotsEpArrowBtn: {
    padding: 3,
  },
  shotsEpArrowDisabled: {
    opacity: 0.3,
  },
  shotsEpDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
    gap: 4,
  },
  shotsEpDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  shotsEpDotActive: {
    width: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e50914',
  },
  shotsEpBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.35)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 4,
  },
  shotsEpBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  shotsEpSwipeHint: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 6,
  },
  shotsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  shotsModalSheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    maxHeight: '65%',
    borderWidth: 1,
    borderColor: '#262626',
  },
  shotsModalDragIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  shotsModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  shotsModalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  shotsModalSubtitle: {
    color: '#999999',
    fontSize: 12,
    marginTop: 2,
  },
  shotsModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotsEpGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 24,
  },
  shotsEpGridBtn: {
    width: '18%',
    aspectRatio: 1.25,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  shotsEpGridBtnActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  shotsEpGridBtnText: {
    color: '#CCCCCC',
    fontSize: 13,
    fontWeight: '700',
  },
  shotsEpGridBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  shotsFooterLoader: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  shotsFooterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  shotsScrubberHitArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  shotsScrubberHitAreaActive: {
    height: 44,
  },
  shotsProgressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  shotsProgressTrackActive: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  shotsProgressFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  shotsProgressScrubberThumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#e50914',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 4,
  },
});
