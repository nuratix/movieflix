const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const url = require('url');

const config = getDefaultConfig(__dirname);

// Enable automatic cache invalidation on every run so stale code is never served
config.resetCache = true;

// Helper to buffer and parse body for connect middleware
async function parseBody(req) {
  if (req.body !== undefined) return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
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
  });
}

// Enhance Metro Connect middleware to handle /api/* endpoints natively
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return async (req, res, next) => {
      // Prevent browser from caching dev bundles or HMR updates
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname || '';

      if (pathname.startsWith('/api/')) {
        // Polyfill standard serverless methods on res
        if (!res.status) {
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
        }
        if (!res.json) {
          res.json = (data) => {
            if (!res.headersSent) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.end(JSON.stringify(data));
            return res;
          };
        }
        if (!res.redirect) {
          res.redirect = (statusOrUrl, targetUrl) => {
            const status = typeof statusOrUrl === 'number' ? statusOrUrl : 302;
            const dest = typeof statusOrUrl === 'string' ? statusOrUrl : targetUrl;
            res.statusCode = status;
            res.setHeader('Location', dest);
            res.end();
            return res;
          };
        }

        req.query = parsedUrl.query || {};
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          await parseBody(req);
        }

        let modulePath = null;
        if (pathname.startsWith('/api/auth')) modulePath = './api/auth.js';
        else if (pathname.startsWith('/api/content')) modulePath = './api/content.js';
        else if (pathname.startsWith('/api/download')) modulePath = './api/download.js';
        else if (pathname.startsWith('/api/proxy')) modulePath = './api/proxy.js';
        else if (pathname.startsWith('/api/update')) modulePath = './api/update.js';
        else if (pathname.startsWith('/api/imdb')) modulePath = './api/imdb.js';
        else if (pathname.startsWith('/api/status')) modulePath = './api/status.js';
        else if (pathname.startsWith('/api/ads')) modulePath = './api/ads.js';
        else if (pathname.startsWith('/api/subscription') || pathname.startsWith('/api/payment')) modulePath = './api/subscription.js';
        else if (pathname.startsWith('/api/telegram')) modulePath = './api/telegram.js';

        if (modulePath) {
          try {
            const mod = await import(modulePath);
            const handler = mod.default || mod;
            return await handler(req, res);
          } catch (err) {
            console.error(`[API Error in ${pathname}]`, err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal API Error' }));
            }
            return;
          }
        }
      }

      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
