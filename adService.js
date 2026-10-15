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

/**
 * Fetch a random active ad for player or shorts display
 * @param {Object} options - { format: '16:9' | '9:16', placement: 'player' | 'shorts', mediaType: 'video' | 'image' }
 */
export async function fetchRandomAd(options = {}) {
  const { format = '16:9', placement = 'player', mediaType = '' } = options;
  try {
    const params = new URLSearchParams();
    if (format) params.set('aspect_ratio', format);
    if (placement) params.set('placement', placement);
    if (mediaType) params.set('media_type', mediaType);
    const qs = params.toString() ? `?${params.toString()}` : '';

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
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && data.status === 'success' && data.ad && (data.ad.video_url || data.ad.poster_url)) {
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
    const url = useProxy
      ? `${API_BASE}/api/ads?action=list&aspect_ratio=9:16&placement=shorts`
      : `${DIRECT_ADS_API}/api/v1/ads?aspect_ratio=9:16&placement=shorts`;

    const headers = { Accept: 'application/json' };
    if (!useProxy && DIRECT_ADS_KEY) {
      headers['X-Ad-Secret-Key'] = DIRECT_ADS_KEY;
    }

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.ads) ? data.ads : [];
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
