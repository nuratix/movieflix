// ─── Movieflix Serverless Media Streaming Proxy ───────────────────────────
// Hardened against SSRF, unauthorized network access, and open proxy abuse.
// Enforces strict domain allowlists and validates all redirect destinations.

// Approved media and metadata domains
const ALLOWED_DOMAIN_PATTERNS = [
  /(^|\.)aoneroom\.com$/i,
  /(^|\.)hakunaymatata\.com$/i,
  /(^|\.)netfilm\.world$/i,
  /(^|\.)moviebo\.vercel\.app$/i,
  /(^|\.)movieflix-pi-six\.vercel\.app$/i,
  /(^|\.)media-imdb\.com$/i,
  /(^|\.)imdb\.com$/i,
  /(^|\.)tvmaze\.com$/i,
  /(^|\.)themoviedb\.org$/i,
  /(^|\.)tmdb\.org$/i,
  /(^|\.)cloudfront\.net$/i,
  /(^|\.)googleusercontent\.com$/i,
  /(^|\.)gstatic\.com$/i,
  /(^|\.)media-amazon\.com$/i,
  /(^|\.)github\.com$/i,
  /(^|\.)githubusercontent\.com$/i,
  /^api\.mymemory\.translated\.net$/i,
];

export function isSafeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch (_) {
    return false;
  }

  // Only HTTP and HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) return false;

  // Block localhost, local, metadata and private domains
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === 'metadata.google.internal'
  ) {
    return false;
  }

  // Block decimal / octal / hex encoded IPs
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
    return false;
  }

  // Block IPv4 private/reserved/link-local ranges
  const ipv4Parts = hostname.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^\d+$/.test(p))) {
    const [a, b, c, d] = ipv4Parts.map(Number);
    if (a < 0 || a > 255 || b < 0 || b > 255 || c < 0 || c > 255 || d < 0 || d > 255) return false;
    if (a === 127) return false; // Loopback (127.0.0.0/8)
    if (a === 10) return false; // Private Class A (10.0.0.0/8)
    if (a === 172 && b >= 16 && b <= 31) return false; // Private Class B (172.16.0.0/12)
    if (a === 192 && b === 168) return false; // Private Class C (192.168.0.0/16)
    if (a === 169 && b === 254) return false; // Link-local / Cloud metadata (169.254.0.0/16)
    if (a === 0) return false; // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return false; // Carrier-grade NAT (100.64.0.0/10)
    return false; // Direct IP access disallowed; must use approved hostnames
  }

  // Block IPv6 loopback / unique local / link-local / unspecified
  if (
    hostname.includes(':') ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fe80')
  ) {
    return false;
  }

  // Enforce approved hostnames allowlist
  return ALLOWED_DOMAIN_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Fetch upstream with manual redirect following, validating each redirect hop against isSafeUrl
 */
async function fetchWithSafeRedirects(initialUrl, fetchOptions, maxRedirects = 3) {
  let currentUrl = initialUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    if (!isSafeUrl(currentUrl)) {
      throw new Error(`SSRF blocked: Destination host "${currentUrl}" is not allowed.`);
    }

    const res = await fetch(currentUrl, {
      ...fetchOptions,
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) {
        return res;
      }
      redirectsCount++;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return res;
  }

  throw new Error('Too many redirects');
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req, res) {
  // If invoked in Node.js environment (Connect / Express / Metro dev server)
  if (res && typeof res.writeHead === 'function') {
    return handleNode(req, res);
  }
  // Otherwise Vercel Edge Runtime (Web Standard Request & Response)
  return handleEdge(req);
}

const ALLOWED_ORIGINS = new Set([
  'https://mws.wallpaperdomain.xyz',
  'https://mws.wallpaperdomain.com',
  'https://netfilm.world',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
]);

function getCorsOrigin(origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return origin;
  }
  return 'https://mws.wallpaperdomain.xyz';
}

export function extractTargetUrl(reqUrl) {
  if (!reqUrl) return null;
  const idx = reqUrl.indexOf('url=');
  if (idx === -1) return null;
  const raw = reqUrl.slice(idx + 4);
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded;
    }
  } catch (_) {}
  return raw;
}

// ----------------------------------------------------
// Edge Runtime Handler (Vercel Production)
// ----------------------------------------------------
async function handleEdge(req) {
  const reqOrigin = req.headers.get('origin');
  const corsOrigin = getCorsOrigin(reqOrigin);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const targetUrl = extractTargetUrl(req.url);

  if (!targetUrl || !isSafeUrl(targetUrl)) {
    return new Response('Access denied: target URL is not in the approved media allowlist.', {
      status: 403,
      headers: { 'Access-Control-Allow-Origin': corsOrigin },
    });
  }

  try {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set('Referer', 'https://netfilm.world/');
    upstreamHeaders.set('Origin', 'https://netfilm.world');
    upstreamHeaders.set(
      'User-Agent',
      req.headers.get('user-agent') ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
    );

    const range = req.headers.get('range');
    if (range) {
      upstreamHeaders.set('Range', range);
    }

    const upstreamRes = await fetchWithSafeRedirects(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
    });

    const responseHeaders = new Headers();
    const passthrough = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
      'cache-control',
    ];

    for (const [key, val] of upstreamRes.headers.entries()) {
      if (passthrough.includes(key.toLowerCase())) {
        responseHeaders.set(key, val);
      }
    }

    responseHeaders.set('Content-Disposition', 'inline');
    responseHeaders.set('Access-Control-Allow-Origin', corsOrigin);
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    const body =
      req.method === 'HEAD' || upstreamRes.status === 204 || upstreamRes.status === 304
        ? null
        : upstreamRes.body;

    return new Response(body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(`Streaming proxy error: ${err.message}`, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': corsOrigin },
    });
  }
}

// ----------------------------------------------------
// Node.js / Connect Handler (Metro Dev Server / Local)
// ----------------------------------------------------
async function handleNode(req, res) {
  const reqOrigin = req.headers['origin'];
  const corsOrigin = getCorsOrigin(reqOrigin);

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const targetUrl = extractTargetUrl(req.url);

  if (!targetUrl || !isSafeUrl(targetUrl)) {
    res.statusCode = 403;
    res.end('Access denied: target URL is not in the approved media allowlist.');
    return;
  }

  try {
    const upstreamHeaders = {
      'Referer': 'https://netfilm.world/',
      'Origin': 'https://netfilm.world',
      'User-Agent':
        req.headers['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    };

    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range;
    }

    const upstreamRes = await fetchWithSafeRedirects(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
    });

    const passthrough = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
      'cache-control',
    ];

    for (const [key, val] of upstreamRes.headers.entries()) {
      if (passthrough.includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    }

    res.setHeader('Content-Disposition', 'inline');
    res.statusCode = upstreamRes.status;

    if (upstreamRes.body) {
      const { Readable } = await import('stream');
      Readable.fromWeb(upstreamRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 502;
    }
    res.end(`Streaming proxy error: ${err.message}`);
  }
}
