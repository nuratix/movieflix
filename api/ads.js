// ─── MovieFlix Ad Serving & Tracking Proxy ──────────────────────────────────
// Connects securely to the MovieAds platform (https://ads.wallpaperdomain.xyz)
// Uses process.env.ADS_API_URL and process.env.ADS_SECRET_KEY on the server
// Never exposes the private ad secret key to the client browser!

const ADS_API_URL = (process.env.ADS_API_URL || 'https://ads.wallpaperdomain.xyz').replace(/\/+$/, '');
const ADS_SECRET_KEY = (process.env.ADS_SECRET_KEY || 'mf_ad_sec_89a31bc09e').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Ad-Secret-Key');

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

    // 3. Fetch active random ad: GET /api/ads or GET /api/ads/random
    const remoteUrl = `${ADS_API_URL}/api/v1/ads/random`;
    const remoteRes = await fetch(remoteUrl, {
      method: 'GET',
      headers: {
        'X-Ad-Secret-Key': ADS_SECRET_KEY,
        'Accept': 'application/json',
      },
    });

    if (!remoteRes.ok) {
      if (remoteRes.status === 404) {
        return res.status(200).json({ status: 'empty', message: 'No active ads currently available.' });
      }
      const errText = await remoteRes.text().catch(() => '');
      return res.status(remoteRes.status).json({ error: 'Failed to fetch ad from upstream', detail: errText });
    }

    const data = await remoteRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Movieflix Ads Proxy Error]', err);
    return res.status(500).json({ error: 'Internal Ads Proxy Error', message: err.message });
  }
}
