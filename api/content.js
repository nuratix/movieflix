import { neon } from '@neondatabase/serverless';

// ─── Server-Side Content API Proxy for Movieflix ────────────────────────────
// Securely proxies requests to the upstream movie catalog and stream provider.
// Upstream provider API credentials exist ONLY in server environment variables
// (MOVIE_PROVIDER_API_KEY) and are NEVER exposed to the client or mobile APK.

function getDb() {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED;
  if (!dbUrl) return null;
  return neon(dbUrl);
}

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

const ALLOWED_ORIGINS = new Set([
  'https://movieflix-pi-six.vercel.app',
  'https://netfilm.world',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
]);

function setCors(req, res) {
  const origin = req.headers['origin'];
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://movieflix-pi-six.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date, Authorization'
  );
}

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
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
  setCors(req, res);

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
    else if (urlPath.includes('/api/shots') || urlPath.includes('/api/reels')) endpoint = 'shots';
    else if (urlPath.includes('/api/music/search')) endpoint = 'music-search';
    else if (urlPath.includes('/api/music')) endpoint = 'music';
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
    case 'music': {
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      targetUrl = `${UPSTREAM_BASE}/music?page=${page}`;
      cacheKey = `catalog:music:p${page}`;
      break;
    }
    case 'music-search': {
      const q = (query.q || '').slice(0, 100).trim();
      if (!q) {
        return res.status(400).json({ error: 'Missing or empty search query "q".' });
      }
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      targetUrl = `${UPSTREAM_BASE}/music/search?q=${encodeURIComponent(q)}&page=${page}`;
      cacheKey = `music:search:${q.toLowerCase()}:p${page}`;
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
    case 'shots':
    case 'reels': {
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      cacheKey = `catalog:shots:feed:p${page}`;
      const cached = cacheMap.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached.data);
      }
      try {
        let rawItems = [];
        if (page === 1) {
          const homeRes = await fetch(`${UPSTREAM_BASE}/home`, {
            headers: {
              'Accept': 'application/json',
              'X-App-Key': providerKey,
              'User-Agent': 'Movieflix-Proxy/1.1.4',
            },
          });
          const homeData = await homeRes.json();
          const sections = homeData.sections || [];
          const shortSection = sections.find((s) => s.section && s.section.toLowerCase().includes('short'));
          rawItems = shortSection?.items ? [...shortSection.items] : [];

          // Also merge popular short-format and romantic dramas from other sections
          const dramaSections = sections.filter((s) => s.section && (s.section.includes('Drama') || s.section.includes('Romance') || s.section.includes('Teen')));
          for (const ds of dramaSections) {
            for (const item of (ds.items || [])) {
              if (item.subject_id && !rawItems.some((r) => r.subject_id === item.subject_id)) {
                rawItems.push(item);
              }
            }
          }
        } else {
          // Page 2+: fetch from /tv-series?page=${page} for endless short drama / series content
          const tvRes = await fetch(`${UPSTREAM_BASE}/tv-series?page=${page}`, {
            headers: {
              'Accept': 'application/json',
              'X-App-Key': providerKey,
              'User-Agent': 'Movieflix-Proxy/1.1.4',
            },
          });
          const tvData = await tvRes.json();
          rawItems = tvData?.items ? [...tvData.items] : [];
        }

        // Retrieve real likes from database for these shot IDs
        let dbLikesMap = {};
        const sql = getDb();
        if (sql && rawItems.length > 0) {
          try {
            const shotIds = rawItems.map((it) => String(it.subject_id || '')).filter(Boolean);
            if (shotIds.length > 0) {
              const rows = await sql`
                SELECT shot_id, COUNT(*)::int AS count
                FROM (
                  SELECT shot_id FROM mf_shots_likes WHERE shot_id = ANY(${shotIds})
                  UNION ALL
                  SELECT shot_id FROM mf_shots_guest_likes WHERE shot_id = ANY(${shotIds})
                ) combined
                GROUP BY shot_id
              `;
              for (const r of rows) {
                dbLikesMap[r.shot_id] = r.count;
              }
            }
          } catch (dbErr) {
            console.warn('Real likes lookup in content API error:', dbErr?.message);
          }
        }

        const authors = ['@DramaBox', '@ShortMax', '@ReelShort', '@NetShort', '@GoodShort', '@MiniTV', '@BillionaireTV'];
        const shots = rawItems.map((item, idx) => {
          const author = authors[(idx + (page * 3)) % authors.length];
          const totalEps = item.total_episodes || item.episodes_count || (12 + ((idx * 7) % 28));
          const realLikes = dbLikesMap[String(item.subject_id)] || 0;

          return {
            id: `shot-${item.subject_id || idx}-p${page}`,
            subject_id: item.subject_id,
            title: item.name,
            slug: item.slug,
            poster_url: item.poster_url,
            rating: item.rating || '7.8',
            author,
            likes: realLikes,
            shares: 0,
            total_episodes: totalEps,
            se: 1,
            ep: 1,
          };
        });

        const responseData = { status: 'success', page, count: shots.length, items: shots, has_more: true };
        cacheMap.set(cacheKey, { data: responseData, expiresAt: Date.now() + 15 * 1000 });
        return res.status(200).json(responseData);
      } catch (err) {
        console.error('Failed to fetch shots:', err);
        return res.status(500).json({ error: 'Failed to fetch short videos feed.' });
      }
    }
    default: {
      return res.status(400).json({
        error: 'Invalid or unsupported endpoint. Supported endpoints: home, movies, tv-series, animation, music, music-search, search, detail, dubs, metadata, stream, captions, shots, reels.',
      });
    }
  }

  // 6. Check in-memory cache
  if (cacheKey) {
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      res.setHeader('X-Cache', 'HIT');
      if (['home', 'catalog', 'movies', 'tv-series', 'animation'].includes(endpoint)) {
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      }
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
    if (['home', 'catalog', 'movies', 'tv-series', 'animation'].includes(endpoint)) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    }
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
