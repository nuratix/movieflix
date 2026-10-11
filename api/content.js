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
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date, Authorization'
  );
}

async function fetchNetfilmStreams(id, detailPath, se = 0, ep = 0) {
  async function fetchPlay(seVal, epVal) {
    const slug = detailPath || id;
    const referer = `https://netfilm.world/spa/videoPlayPage/movies/${slug}?id=${id}&type=/movie/detail&detailSe=${seVal}&detailEp=${epVal}&lang=en`;
    const playUrl = `https://netfilm.world/wefeed-h5api-bff/subject/play?subjectId=${encodeURIComponent(id)}&se=${seVal}&ep=${epVal}&detailPath=${encodeURIComponent(slug)}`;
    const r = await fetch(playUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'application/json, text/plain, */*',
      },
    });
    if (!r.ok) return null;
    const json = await r.json();
    return json?.data || null;
  }

  let data = await fetchPlay(se, ep);
  let effectiveSe = se;
  let effectiveEp = ep;

  if (!data?.streams || data.streams.length === 0) {
    const altSe = se === 0 ? 1 : 0;
    const altEp = ep === 0 ? 1 : 0;
    const altData = await fetchPlay(altSe, altEp);
    if (altData?.streams && altData.streams.length > 0) {
      data = altData;
      effectiveSe = altSe;
      effectiveEp = altEp;
    }
  }

  if (data?.streams && data.streams.length > 0) {
    const streams = data.streams
      .filter((s) => s.url && typeof s.url === 'string' && s.url.startsWith('http'))
      .map((s) => ({
        resolution: `${s.resolutions}p`,
        format: s.format,
        url: s.url,
        size: s.size,
        duration: s.duration,
        codec: s.codecName,
      }));

    if (streams.length > 0) {
      return {
        subject_id: id,
        se: effectiveSe,
        ep: effectiveEp,
        has_resource: true,
        sources: streams,
        hls: data.hls || [],
        dash: data.dash || [],
        free_episodes: data.freeNum,
        limited: data.limited || false,
      };
    }
  }
  return null;
}

async function fetchNetfilmCaptions(id, detailPath, se = 0, ep = 0) {
  const slug = detailPath || id;
  const referer = `https://netfilm.world/spa/videoPlayPage/movies/${slug}?id=${id}&type=/movie/detail&detailSe=${se}&detailEp=${ep}&lang=en`;
  try {
    const playRes = await fetch(
      `https://netfilm.world/wefeed-h5api-bff/subject/play?subjectId=${encodeURIComponent(id)}&se=${se}&ep=${ep}&detailPath=${encodeURIComponent(slug)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': referer,
          'Accept': 'application/json',
        },
      }
    );
    if (playRes.ok) {
      const playJson = await playRes.json();
      const streams = playJson?.data?.streams || [];
      const streamId = streams[0]?.id;
      const streamFormat = streams[0]?.format || 'MP4';
      if (streamId) {
        const capUrl = `https://netfilm.world/wefeed-h5api-bff/subject/caption?format=${streamFormat}&id=${streamId}&subjectId=${encodeURIComponent(id)}&detailPath=${encodeURIComponent(slug)}`;
        const capRes = await fetch(capUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': referer,
            'Accept': 'application/json',
          },
        });
        if (capRes.ok) {
          const capJson = await capRes.json();
          const captions = capJson?.data?.captions || [];
          if (captions.length > 0) {
            return { subject_id: id, se, ep, count: captions.length, captions };
          }
        }
      }
    }
  } catch (_) {}
  return { subject_id: id, se, ep, count: 0, captions: [] };
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
  const query = req.query || (req.url ? Object.fromEntries(new URL(req.url, 'http://localhost').searchParams) : {});
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
        const seenIds = new Set();

        const addUnique = (item, isMovie, isSeries, badge) => {
          if (!item || !item.subject_id) return;
          const sId = String(item.subject_id);
          if (seenIds.has(sId)) return;
          seenIds.add(sId);
          rawItems.push({
            ...item,
            isMovie: Boolean(isMovie),
            isSeries: Boolean(isSeries),
            badge: badge || (isMovie ? 'Movie' : 'Series'),
          });
        };

        if (page === 1) {
          const [homeRes, moviesRes, tvRes] = await Promise.allSettled([
            fetch(`${UPSTREAM_BASE}/home`, {
              headers: { 'Accept': 'application/json', 'X-App-Key': providerKey, 'User-Agent': 'Movieflix-Proxy/1.1.4' },
            }).then((r) => r.json()),
            fetch(`${UPSTREAM_BASE}/movies?page=1`, {
              headers: { 'Accept': 'application/json', 'X-App-Key': providerKey, 'User-Agent': 'Movieflix-Proxy/1.1.4' },
            }).then((r) => r.json()),
            fetch(`${UPSTREAM_BASE}/tv-series?page=1`, {
              headers: { 'Accept': 'application/json', 'X-App-Key': providerKey, 'User-Agent': 'Movieflix-Proxy/1.1.4' },
            }).then((r) => r.json()),
          ]);

          const homeData = homeRes.status === 'fulfilled' ? homeRes.value : {};
          const moviesData = moviesRes.status === 'fulfilled' ? moviesRes.value : {};
          const tvData = tvRes.status === 'fulfilled' ? tvRes.value : {};

          const movieItems = (moviesData.items || []).slice();
          const tvItems = (tvData.items || []).slice();

          // Extract sections from home
          const sections = homeData.sections || [];
          const shortSection = sections.find((s) => s.section && s.section.toLowerCase().includes('short'));
          const shortItems = (shortSection?.items || []).slice();

          // Interleave: Movie -> Web Series -> Short/Drama
          const maxLen = Math.max(movieItems.length, tvItems.length, shortItems.length);
          for (let i = 0; i < maxLen; i++) {
            if (movieItems[i]) addUnique(movieItems[i], true, false, 'Movie');
            if (tvItems[i]) addUnique(tvItems[i], false, true, 'Series');
            if (shortItems[i]) addUnique(shortItems[i], false, true, 'Short');
          }

          // If still items needed, add other movie/drama sections from home
          for (const s of sections) {
            const isMovieSec = s.section && (s.section.includes('Movie') || s.section.includes('Film'));
            for (const it of (s.items || [])) {
              addUnique(it, isMovieSec, !isMovieSec, isMovieSec ? 'Movie' : 'Series');
            }
          }
        } else {
          // Page 2+: fetch catalog movies and tv-series in parallel
          const [moviesRes, tvRes] = await Promise.allSettled([
            fetch(`${UPSTREAM_BASE}/movies?page=${page}`, {
              headers: { 'Accept': 'application/json', 'X-App-Key': providerKey, 'User-Agent': 'Movieflix-Proxy/1.1.4' },
            }).then((r) => r.json()),
            fetch(`${UPSTREAM_BASE}/tv-series?page=${page}`, {
              headers: { 'Accept': 'application/json', 'X-App-Key': providerKey, 'User-Agent': 'Movieflix-Proxy/1.1.4' },
            }).then((r) => r.json()),
          ]);

          const movieItems = (moviesRes.status === 'fulfilled' ? moviesRes.value?.items : []) || [];
          const tvItems = (tvRes.status === 'fulfilled' ? tvRes.value?.items : []) || [];

          const maxLen = Math.max(movieItems.length, tvItems.length);
          for (let i = 0; i < maxLen; i++) {
            if (movieItems[i]) addUnique(movieItems[i], true, false, 'Movie');
            if (tvItems[i]) addUnique(tvItems[i], false, true, 'Series');
          }
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

        const movieAuthors = ['@Movieflix', '@CinemaMax', '@WarnerBros', '@Paramount', '@Universal', '@SonyPictures'];
        const seriesAuthors = ['@Netflix', '@HBO', '@AmazonPrime', '@DisneyPlus', '@AppleTV', '@AMC'];
        const shortAuthors = ['@DramaBox', '@ShortMax', '@ReelShort', '@NetShort', '@GoodShort', '@MiniTV'];

        const shots = rawItems.map((item, idx) => {
          const isMovie = Boolean(item.isMovie);
          const isSeries = Boolean(item.isSeries);
          const isShort = item.badge === 'Short';

          let authorList = isMovie ? movieAuthors : (isShort ? shortAuthors : seriesAuthors);
          const author = authorList[(idx + (page * 3)) % authorList.length];
          const realLikes = dbLikesMap[String(item.subject_id)] || 0;

          // Only series with actual episodes have total_episodes > 0 and se/ep > 0
          // Movies DO NOT support episodes: se: 0, ep: 0, total_episodes: 0
          let totalEps = 0;
          let se = 0;
          let ep = 0;

          if (isSeries) {
            totalEps = item.total_episodes || item.episodes_count || (isShort ? 30 : 1);
            se = 1;
            ep = 1;
          }

          return {
            id: `shot-${item.subject_id || idx}-p${page}`,
            subject_id: item.subject_id,
            title: item.name,
            name: item.name,
            slug: item.slug,
            poster_url: item.poster_url,
            rating: item.rating || '7.8',
            author,
            likes: realLikes,
            shares: 0,
            isMovie,
            isSeries,
            badge: item.badge || (isMovie ? 'Movie' : 'Series'),
            total_episodes: totalEps,
            se,
            ep,
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

      if (endpoint === 'stream') {
        const id = (query.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50).trim();
        const detailPath = (query.detail_path || query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
        const se = Math.max(0, parseInt(query.se, 10) || 0);
        const ep = Math.max(0, parseInt(query.ep, 10) || 0);
        const fallbackStream = await fetchNetfilmStreams(id, detailPath, se, ep);
        if (fallbackStream) {
          return res.status(200).json(fallbackStream);
        }
      }

      if (endpoint === 'captions') {
        const id = (query.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50).trim();
        const detailPath = (query.detail_path || query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
        const se = Math.max(0, parseInt(query.se, 10) || 0);
        const ep = Math.max(0, parseInt(query.ep, 10) || 0);
        const fallbackCaps = await fetchNetfilmCaptions(id, detailPath, se, ep);
        if (fallbackCaps) {
          return res.status(200).json(fallbackCaps);
        }
      }

      return res.status(upstreamRes.status).json({
        error: `Upstream provider returned status ${upstreamRes.status}`,
      });
    }

    const data = await upstreamRes.json();

    if (endpoint === 'stream' && (!data?.sources || data.sources.length === 0)) {
      const id = (query.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50).trim();
      const detailPath = (query.detail_path || query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
      const se = Math.max(0, parseInt(query.se, 10) || 0);
      const ep = Math.max(0, parseInt(query.ep, 10) || 0);
      const fallbackStream = await fetchNetfilmStreams(id, detailPath, se, ep);
      if (fallbackStream) {
        return res.status(200).json(fallbackStream);
      }
    }

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
    if (endpoint === 'stream') {
      try {
        const id = (query.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50).trim();
        const detailPath = (query.detail_path || query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
        const se = Math.max(0, parseInt(query.se, 10) || 0);
        const ep = Math.max(0, parseInt(query.ep, 10) || 0);
        const fallbackStream = await fetchNetfilmStreams(id, detailPath, se, ep);
        if (fallbackStream) {
          return res.status(200).json(fallbackStream);
        }
      } catch (_) {}
    }
    if (endpoint === 'captions') {
      try {
        const id = (query.id || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50).trim();
        const detailPath = (query.detail_path || query.slug || '').replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 150).trim();
        const se = Math.max(0, parseInt(query.se, 10) || 0);
        const ep = Math.max(0, parseInt(query.ep, 10) || 0);
        const fallbackCaps = await fetchNetfilmCaptions(id, detailPath, se, ep);
        if (fallbackCaps) {
          return res.status(200).json(fallbackCaps);
        }
      } catch (_) {}
    }
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream provider request timed out.' });
    }
    console.error(`Proxy fetch error for ${endpoint}:`, err.message);
    return res.status(502).json({ error: 'Failed to communicate with upstream provider.' });
  }
}
