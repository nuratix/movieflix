const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable automatic cache invalidation on every run so stale code is never served
config.resetCache = true;

// Enhance Metro Connect middleware to handle /api/proxy locally and enforce zero-cache headers
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return async (req, res, next) => {
      // Prevent browser from caching dev bundles or HMR updates
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');

      if (req.url && req.url.startsWith('/api/proxy')) {
        try {
          const proxyModule = await import('./api/proxy.js');
          const handler = proxyModule.default || proxyModule;
          return handler(req, res);
        } catch (err) {
          console.error('[Metro Proxy Error]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
          }
          res.end(`Internal proxy error: ${err.message}`);
          return;
        }
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
