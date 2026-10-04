// ─── Movieflix Server-Side OMDB / IMDb Proxy ───────────────────────────
// Keeps all third-party OMDB API keys strictly server-side.
// Provides edge CDN caching (24h) and rate-limiting to prevent quota abuse.

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  record.count += 1;
  return true;
}

const ALLOWED_ORIGINS = [
  'https://movieflix-pi-six.vercel.app',
  'https://netfilm.world',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
];

function setCors(req, res) {
  const origin = req.headers['origin'];
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://movieflix-pi-six.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too Many Requests. Please slow down.' });
  }

  const title = (req.query?.t || req.query?.title || '').trim();
  const year = (req.query?.y || req.query?.year || '').trim();

  if (!title) {
    return res.status(400).json({ error: 'Query parameter "t" (title) is required' });
  }

  // Server-side OMDB keys (configured via Vercel env variable OMDB_API_KEY or OMDB_API_KEYS)
  const envKeys = process.env.OMDB_API_KEYS || process.env.OMDB_API_KEY || 'trilogy,2b21cd75,852233f0';
  const apiKeys = envKeys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  let omdbData = null;

  for (const apiKey of apiKeys) {
    try {
      let targetUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
      if (year && /^\d{4}$/.test(year)) {
        targetUrl += `&y=${year}`;
      }

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Movieflix-IMDb-Proxy/1.0',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.Response === 'True') {
          omdbData = data;
          break;
        }
      }
    } catch (_) {
      // Continue to next key if available
    }
  }

  if (!omdbData) {
    return res.status(404).json({ Response: 'False', Error: 'Movie or series not found' });
  }

  // Cache response for 24h on CDN, 1h in browser to conserve API quota
  res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600, stale-while-revalidate=43200');
  return res.status(200).json(omdbData);
}
