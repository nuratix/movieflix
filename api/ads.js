// ─── MovieFlix Ad Serving & Tracking Proxy ──────────────────────────────────
// Connects securely to the MovieAds platform (https://ads.wallpaperdomain.xyz)
// Uses process.env.ADS_API_URL and process.env.ADS_SECRET_KEY on the server
// Never exposes the private ad secret key to the client browser!

const ADS_API_URL = (process.env.ADS_API_URL || 'https://ads.wallpaperdomain.xyz').replace(/\/+$/, '');
const ADS_SECRET_KEY = (process.env.ADS_SECRET_KEY || '').trim();

const ALLOWED_ORIGINS = new Set([
  'https://mws.wallpaperdomain.xyz',
  'https://mws.wallpaperdomain.com',
  'https://netfilm.world',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
]);

export default async function handler(req, res) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Ad-Secret-Key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawUrl = req.url || '';
  const parsed = new URL(rawUrl, 'http://localhost');
  const pathname = parsed.pathname;

  try {
    // 1. Impression tracking: POST /api/ads/impression/:id or query action=impression
    if (pathname.includes('/impression/') || (req.query && req.query.action === 'impression')) {
      const match = pathname.match(/\/impression\/([^/?#]+)/);
      const adId = match ? match[1] : req.query.id;
      if (!adId) {
        return res.status(400).json({ error: 'Missing ad id for impression' });
      }
      const remoteRes = await fetch(`${ADS_API_URL}/api/v1/impression/${encodeURIComponent(adId)}`, {
        method: 'POST',
        headers: {
          'X-Ad-Secret-Key': ADS_SECRET_KEY,
        },
      });
      const data = await remoteRes.json().catch(() => ({ success: true }));
      return res.status(remoteRes.status || 200).json(data);
    }

    // 2. Click tracking: GET /api/ads/click/:id or query action=click
    if (pathname.includes('/click/') || (req.query && req.query.action === 'click')) {
      const match = pathname.match(/\/click\/([^/?#]+)/);
      const adId = match ? match[1] : req.query.id;
      if (!adId) {
        return res.status(400).json({ error: 'Missing ad id for click' });
      }
      return res.redirect(302, `${ADS_API_URL}/api/v1/click/${encodeURIComponent(adId)}`);
    }

    // 3. Fetch active ads: list or random
    const isList = pathname.includes('/list') || (req.query && req.query.action === 'list') || parsed.searchParams.get('action') === 'list';
    const searchParams = new URLSearchParams(parsed.search);
    searchParams.delete('action');
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const remoteUrl = isList
      ? `${ADS_API_URL}/api/v1/ads${qs}`
      : `${ADS_API_URL}/api/v1/ads/random${qs}`;

    const remoteRes = await fetch(remoteUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'X-Ad-Secret-Key': ADS_SECRET_KEY,
        'Accept': 'application/json',
      },
    });

    if (!remoteRes.ok) {
      if (remoteRes.status === 404) {
        return res.status(200).json({ status: 'empty', message: 'No active ads currently available.' });
      }
      return res.status(remoteRes.status || 502).json({ error: 'Failed to fetch ad from upstream server.' });
    }

    const data = await remoteRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Movieflix Ads Proxy Error]', err);
    return res.status(500).json({ error: 'Internal Ads Proxy Error' });
  }
}
