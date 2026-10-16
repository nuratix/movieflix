// ─── Movieflix Ultra-Fast Production Static & API Server ─────────────────────
// High-performance Node.js HTTP server serving pre-exported Expo web dist/
// with Brotli/Gzip compression, immutable asset caching, SPA routing, and API endpoints.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import crypto from 'crypto';
import dns from 'dns';

// Force IPv4 first to avoid IPv6 timeouts
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (_) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8081', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve(__dirname, 'dist');
const API_DIR = path.resolve(__dirname, 'api');

// MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.apk': 'application/vnd.android.package-archive',
};

// Types eligible for gzip compression
const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.svg',
  '.xml',
  '.txt',
]);

// Helper to buffer body for POST/PUT/PATCH requests
async function parseBody(req) {
  if (req.body !== undefined) return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      // Cap at 10MB to prevent memory exhaustion
      if (data.length > 10 * 1024 * 1024) {
        req.destroy();
        resolve({});
      }
    });
    req.on('end', () => {
      if (!data) {
        req.body = {};
        return resolve({});
      }
      try {
        req.body = JSON.parse(data);
      } catch (_) {
        req.body = data;
      }
      resolve(req.body);
    });
    req.on('error', () => {
      req.body = {};
      resolve({});
    });
  });
}

// Map API routes to handler files
const API_ROUTES = {
  auth: './api/auth.js',
  content: './api/content.js',
  download: './api/download.js',
  proxy: './api/proxy.js',
  update: './api/update.js',
  imdb: './api/imdb.js',
  status: './api/status.js',
  ads: './api/ads.js',
  subscription: './api/subscription.js',
  payment: './api/subscription.js',
  telegram: './api/telegram.js',
  'verify-captcha': './api/verify-captcha.js',
  integrity: './api/integrity.js',
  sitemap: './api/sitemap.js',
  favicon: './api/favicon.js',
  icon: './api/icon.js',
  'og-image': './api/og-image.js',
};

// Cache imported API modules for instant execution
const moduleCache = new Map();

async function getApiHandler(modulePath) {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }
  try {
    const fullPath = path.resolve(__dirname, modulePath);
    const mod = await import(fullPath);
    const handler = mod.default || mod;
    moduleCache.set(modulePath, handler);
    return handler;
  } catch (err) {
    console.error(`[Server API Import Error: ${modulePath}]`, err);
    return null;
  }
}

// ─── Main HTTP Request Handler ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname || '/');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. API ROUTES (/api/*)
  // ───────────────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Polyfill serverless helper functions on res
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(data));
      return res;
    };
    res.send = (body) => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }
      res.end(body);
      return res;
    };
    res.redirect = (statusOrUrl, targetUrl) => {
      const status = typeof statusOrUrl === 'number' ? statusOrUrl : 302;
      const dest = typeof statusOrUrl === 'string' ? statusOrUrl : targetUrl;
      res.statusCode = status;
      res.setHeader('Location', dest);
      res.end();
      return res;
    };

    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      await parseBody(req);
    }

    const endpoint = pathname.replace(/^\/api\/?/, '').split('/')[0].split('?')[0];
    const modulePath = API_ROUTES[endpoint] || `./api/${endpoint}.js`;

    const handler = await getApiHandler(modulePath);
    if (handler && typeof handler === 'function') {
      try {
        return await handler(req, res);
      } catch (err) {
        console.error(`[API Handler Error: ${pathname}]`, err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
        }
        return;
      }
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. STATIC FILES & PRE-RENDERED PAGES (dist/)
  // ───────────────────────────────────────────────────────────────────────────
  // Prevent directory traversal attacks
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // Check if direct file exists
  let stat = null;
  try {
    if (fs.existsSync(filePath)) {
      stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          filePath = indexPath;
          stat = fs.statSync(filePath);
        } else {
          stat = null;
        }
      }
    }
  } catch (_) {
    stat = null;
  }

  // If not found, check clean route index (e.g. /pricing -> dist/pricing/index.html)
  if (!stat) {
    const routeIndexPath = path.join(DIST_DIR, safePath, 'index.html');
    if (fs.existsSync(routeIndexPath)) {
      filePath = routeIndexPath;
      stat = fs.statSync(filePath);
    }
  }

  // If still not found and no extension, check if {route}.html exists
  if (!stat && !path.extname(safePath)) {
    const htmlPath = path.join(DIST_DIR, `${safePath}.html`);
    if (fs.existsSync(htmlPath)) {
      filePath = htmlPath;
      stat = fs.statSync(filePath);
    }
  }

  // SPA Fallback: if route has no file extension and not found, serve dist/index.html
  if (!stat) {
    const spaIndex = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(spaIndex)) {
      filePath = spaIndex;
      stat = fs.statSync(filePath);
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<h1>404 Not Found</h1>');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  // ─── High-Performance Caching Headers ──────────────────────────────────
  if (pathname.startsWith('/_expo/') || pathname.startsWith('/assets/')) {
    // Immutable hashed assets (bundled JS, CSS, fonts, images) -> cache 1 year!
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg', '.apk'].includes(ext)) {
    // Media & images -> cache 7 days with stale-while-revalidate
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  } else {
    // HTML pages & sitemaps -> fresh with fast browser revalidation
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
  }

  // ─── HTTP ETag / 304 Not Modified Check ────────────────────────────────
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  res.setHeader('ETag', etag);

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === etag) {
    res.statusCode = 304;
    res.end();
    return;
  }

  // ─── Gzip Compression & Streaming ──────────────────────────────────────
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = COMPRESSIBLE_EXTS.has(ext) && acceptEncoding.includes('gzip');

  if (canGzip) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    const gzip = zlib.createGzip({ level: 6 });
    const rawStream = fs.createReadStream(filePath);
    rawStream.pipe(gzip).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    const rawStream = fs.createReadStream(filePath);
    rawStream.pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Movieflix Production Server] Ready on http://${HOST}:${PORT}`);
  console.log(`[Static Root] ${DIST_DIR} (Serving pre-built static files with caching & gzip)`);
  console.log(`[API Endpoints] /api/* routed dynamically`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
