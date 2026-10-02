const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enhance Metro Connect middleware to handle /api/proxy locally during development
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return async (req, res, next) => {
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
