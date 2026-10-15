import { Platform } from 'react-native';

// ─── MovieFlix Ad SDK Service ───────────────────────────────────────────────
// Universal Ad service for Web, Android APK, and iOS.
// Securely communicates with the MovieAds platform using configured env variables.

const DIRECT_ADS_API = (process.env.EXPO_PUBLIC_ADS_API_URL || '').trim().replace(/\/+$/, '');
const DIRECT_ADS_KEY = (process.env.EXPO_PUBLIC_ADS_SECRET_KEY || '').trim();
const API_BASE =
  Platform.OS === 'web'
    ? ''
    : (process.env.EXPO_PUBLIC_API_BASE || 'https://mws.wallpaperdomain.xyz').trim().replace(/\/+$/, '');

/**
 * Clean URL formatter for display (e.g. "https://www.google.com/search?q=123" -> "google.com")
 */
export function getCleanDomain(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const raw = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    const parsed = new URL(raw);
    const domain = parsed.hostname.replace(/^www\./i, '');
    const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') : '';
    // If path is short (<= 16 chars), show domain/path, otherwise just domain
    if (pathname && pathname.length <= 16) {
      return `${domain}${pathname}`;
    }
    return domain;
  } catch (_) {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0] || url;
  }
}

let lastServedAdId = null;
try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    lastServedAdId = window.sessionStorage.getItem('movieflix_last_ad_id') || null;
  }
} catch (_) {}

/**
 * Fetch a random active ad for player or shorts display
 * @param {Object} options - { format: '16:9' | '9:16', placement: 'player' | 'shorts', mediaType: 'video' | 'image', exclude_id?: string }
 */
export async function fetchRandomAd(options = {}) {
  const { format = '16:9', placement = 'player', mediaType = '', exclude_id = null } = options;
  try {
    const params = new URLSearchParams();
    if (format) params.set('aspect_ratio', format);
    if (placement) params.set('placement', placement);
    if (mediaType) params.set('media_type', mediaType);
    const exclude = exclude_id || lastServedAdId;
    if (exclude) params.set('exclude_id', exclude);
    params.set('_t', `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    const qs = `?${params.toString()}`;

    // On web or when proxy is available, use server /api/ads proxy to protect secret key
    const useProxy = Platform.OS === 'web' || !DIRECT_ADS_API;
    const url = useProxy
      ? `${API_BASE}/api/ads${qs}`
      : `${DIRECT_ADS_API}/api/v1/ads/random${qs}`;

    const headers = { Accept: 'application/json' };
    if (!useProxy && DIRECT_ADS_KEY) {
      headers['X-Ad-Secret-Key'] = DIRECT_ADS_KEY;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && data.status === 'success' && data.ad && (data.ad.video_url || data.ad.poster_url)) {
      lastServedAdId = data.ad.id;
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('movieflix_last_ad_id', data.ad.id);
        }
      } catch (_) {}
      return data.ad;
    }
    return null;
  } catch (err) {
    console.warn('[AdService] Standby notification:', err?.message);
    return null;
  }
}

/**
 * Fetch active vertical 9:16 ads for Movieflix Shorts feed
 */
export async function fetchShortsAds() {
  try {
    const useProxy = Platform.OS === 'web' || !DIRECT_ADS_API;
    const cacheBuster = `_t=${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const url = useProxy
      ? `${API_BASE}/api/ads?action=list&aspect_ratio=9:16&placement=shorts&${cacheBuster}`
      : `${DIRECT_ADS_API}/api/v1/ads?aspect_ratio=9:16&placement=shorts&${cacheBuster}`;

    const headers = { Accept: 'application/json' };
    if (!useProxy && DIRECT_ADS_KEY) {
      headers['X-Ad-Secret-Key'] = DIRECT_ADS_KEY;
    }

    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const ads = Array.isArray(data.ads) ? data.ads.slice() : [];
    // Shuffle ads so order is randomized
    for (let i = ads.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = ads[i];
      ads[i] = ads[j];
      ads[j] = temp;
    }
    return ads;
  } catch {
    return [];
  }
}

/**
 * Record an impression when an ad is presented in the player
 */
export async function recordImpression(ad) {
  if (!ad || !ad.id) return;
  try {
    const impressionUrl =
      ad.impression_url ||
      (Platform.OS === 'web' || !DIRECT_ADS_API
        ? `${API_BASE}/api/ads/impression/${ad.id}`
        : `${DIRECT_ADS_API}/api/v1/impression/${ad.id}`);

    fetch(impressionUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(DIRECT_ADS_KEY ? { 'X-Ad-Secret-Key': DIRECT_ADS_KEY } : {}),
      },
    }).catch(() => {});
  } catch (_) {}
}

/**
 * Record a click when the user clicks on the ad banner or CTA
 */
export function recordClick(ad) {
  if (!ad || !ad.id) return;
  try {
    const clickUrl =
      ad.click_url ||
      (Platform.OS === 'web' || !DIRECT_ADS_API
        ? `${API_BASE}/api/ads/click/${ad.id}`
        : `${DIRECT_ADS_API}/api/v1/click/${ad.id}`);

    // Ping click endpoint to increment stats
    fetch(clickUrl, {
      method: 'GET',
      headers: {
        ...(DIRECT_ADS_KEY ? { 'X-Ad-Secret-Key': DIRECT_ADS_KEY } : {}),
      },
    }).catch(() => {});
  } catch (_) {}
}
