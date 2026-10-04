// ─── Server-Side Content API Proxy for Movieflix ────────────────────────────
// Securely proxies requests to the upstream movie catalog and stream provider.
// Upstream provider API credentials exist ONLY in server environment variables
// (MOVIE_PROVIDER_API_KEY) and are NEVER exposed to the client or mobile APK.

const UPSTREAM_BASE = (
  process.env.MOVIE_PROVIDER_URL ||
  process.env.UPSTREAM_API_BASE ||
  'https://moviebo.vercel.app'
).replace(/\/+$/, '');

// In-memory rate limiting map: ip -> { count, resetTime }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 150;

// In-memory response cache for high-traffic static catalog endpoints
const cacheMap = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
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

// Periodically clean stale cache entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cacheMap.entries()) {
    if (now > value.expiresAt) {
      cacheMap.delete(key);
    }
  }
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

export default async function handler(req, res) {
  // 1. Enforce CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Only GET is supported.' });
  }

  // 2. Rate limiting check
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again shortly.' });
  }

  // 3. Verify server-side secret
  const providerKey =
    process.env.MOVIE_PROVIDER_API_KEY ||
    process.env.UPSTREAM_API_KEY;

  if (!providerKey) {
    console.error('SERVER CONFIG ERROR: MOVIE_PROVIDER_API_KEY is not configured in environment variables.');
    return res.status(500).json({
      error: 'Server configuration error: upstream provider credential is not configured.',
    });
  }

  // 4. Parse endpoint and query parameters
  const query = req.query || {};
  let endpoint = (query.endpoint || '').toLowerCase().trim();

  // If endpoint is not provided via query, deduce from request URL path
  if (!endpoint && req.url) {
    const urlPath = req.url.split('?')[0];
    if (urlPath.includes('/api/home') || urlPath.includes('/api/catalog')) endpoint = 'home';
    else if (urlPath.includes('/api/movies')) endpoint = 'movies';
    else if (urlPath.includes('/api/tv-series')) endpoint = 'tv-series';
    else if (urlPath.includes('/api/animation')) endpoint = 'animation';
    else if (urlPath.includes('/api/search')) endpoint = 'search';
    else if (urlPath.includes('/api/detail')) endpoint = 'detail';
    else if (urlPath.includes('/captions')) endpoint = 'captions';
    else if (urlPath.includes('/api/stream')) endpoint = 'stream';
  }

  // 5. Construct upstream URL with input validation
  let targetUrl = '';
  let cacheKey = null;

  switch (endpoint) {
    case 'home':
    case 'catalog': {
      targetUrl = `${UPSTREAM_BASE}/home`;
      cacheKey = 'catalog:home';
      break;
    }
    case 'movies': {
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      targetUrl = `${UPSTREAM_BASE}/movies?page=${page}`;
      cacheKey = `catalog:movies:p${page}`;
      break;
    }
    case 'tv-series': {
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      targetUrl = `${UPSTREAM_BASE}/tv-series?page=${page}`;
      cacheKey = `catalog:tv:p${page}`;
      break;
    }
    case 'animation': {
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      targetUrl = `${UPSTREAM_BASE}/animation?page=${page}`;
      cacheKey = `catalog:animation:p${page}`;
      break;
    }
    case 'search': {
      const q = (query.q || '').slice(0, 100).trim();
      if (!q) {
        return res.status(400).json({ error: 'Missing or empty search query "q".' });
      }
      targetUrl = `${UPSTREAM_BASE}/search?q=${encodeURIComponent(q)}`;
      cacheKey = `search:${q.toLowerCase()}`;
      break;
    }
    case 'detail': {
      const slug = (query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
      if (!slug) {
        return res.status(400).json({ error: 'Missing or invalid "slug" parameter.' });
      }
      targetUrl = `${UPSTREAM_BASE}/detail/${encodeURIComponent(slug)}`;
      cacheKey = `detail:${slug}`;
      break;
    }
    case 'dubs': {
      const slug = (query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
      if (!slug) {
        return res.status(400).json({ error: 'Missing or invalid "slug" parameter.' });
      }
      targetUrl = `${UPSTREAM_BASE}/dubs/${encodeURIComponent(slug)}`;
      cacheKey = `dubs:${slug}`;
      break;
    }
    case 'metadata': {
      const slug = (query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
      if (!slug) {
        return res.status(400).json({ error: 'Missing or invalid "slug" parameter.' });
      }
      targetUrl = `${UPSTREAM_BASE}/metadata/${encodeURIComponent(slug)}`;
      cacheKey = `metadata:${slug}`;
      break;
    }
    case 'stream': {
      const id = (query.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50).trim();
      if (!id) {
        return res.status(400).json({ error: 'Missing or invalid "id" parameter.' });
      }
      const detailPath = (query.detail_path || query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
      const se = Math.max(0, parseInt(query.se, 10) || 0);
      const ep = Math.max(0, parseInt(query.ep, 10) || 0);
      targetUrl = `${UPSTREAM_BASE}/api/stream/${encodeURIComponent(id)}?detail_path=${encodeURIComponent(detailPath)}&se=${se}&ep=${ep}`;
      break;
    }
    case 'captions': {
      const id = (query.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50).trim();
      if (!id) {
        return res.status(400).json({ error: 'Missing or invalid "id" parameter.' });
      }
      const detailPath = (query.detail_path || query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
      const se = Math.max(0, parseInt(query.se, 10) || 0);
      const ep = Math.max(0, parseInt(query.ep, 10) || 0);
      const title = (query.title || '').slice(0, 150).trim();
      targetUrl = `${UPSTREAM_BASE}/api/stream/${encodeURIComponent(id)}/captions?detail_path=${encodeURIComponent(detailPath)}&se=${se}&ep=${ep}&title=${encodeURIComponent(title)}`;
      break;
    }
    default: {
      return res.status(400).json({
        error: 'Invalid or unsupported endpoint. Supported endpoints: home, movies, tv-series, animation, search, detail, dubs, metadata, stream, captions.',
      });
    }
  }

  // 6. Check in-memory cache
  if (cacheKey) {
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached.data);
    }
  }

  // 7. Perform upstream request with server-side authentication
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-App-Key': providerKey,
        'User-Agent': 'Movieflix-Proxy/1.1.4',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => '');
      console.warn(`Upstream error [${upstreamRes.status}] for ${endpoint}:`, errText.slice(0, 100));
      return res.status(upstreamRes.status).json({
        error: `Upstream provider returned status ${upstreamRes.status}`,
      });
    }

    const data = await upstreamRes.json();

    // Cache successful static catalog results
    if (cacheKey && data) {
      cacheMap.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream provider request timed out.' });
    }
    console.error(`Proxy fetch error for ${endpoint}:`, err.message);
    return res.status(502).json({ error: 'Failed to communicate with upstream provider.' });
  }
}
