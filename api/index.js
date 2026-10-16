// ─── MovieFlix Consolidated Serverless Function Gateway ──────────────────────
// Solves Vercel Hobby plan limit ("No more than 12 Serverless Functions").
// Bundles all API endpoints into a single, high-performance edge serverless function.

import adsHandler from './_handlers/ads.js';
import authHandler from './_handlers/auth.js';
import contentHandler from './_handlers/content.js';
import downloadHandler from './_handlers/download.js';
import faviconHandler from './_handlers/favicon.js';
import iconHandler from './_handlers/icon.js';
import imdbHandler from './_handlers/imdb.js';
import integrityHandler from './_handlers/integrity.js';
import ogImageHandler from './_handlers/og-image.js';
import proxyHandler from './_handlers/proxy.js';
import sitemapHandler from './_handlers/sitemap.js';
import statusHandler from './_handlers/status.js';
import subscriptionHandler from './_handlers/subscription.js';
import telegramHandler from './_handlers/telegram.js';
import updateHandler from './_handlers/update.js';
import verifyCaptchaHandler from './_handlers/verify-captcha.js';

const ROUTE_HANDLERS = {
  ads: adsHandler,
  auth: authHandler,
  content: contentHandler,
  home: contentHandler,
  movies: contentHandler,
  'tv-series': contentHandler,
  animation: contentHandler,
  shots: contentHandler,
  reels: contentHandler,
  search: contentHandler,
  detail: contentHandler,
  stream: contentHandler,
  download: downloadHandler,
  favicon: faviconHandler,
  icon: iconHandler,
  imdb: imdbHandler,
  integrity: integrityHandler,
  'og-image': ogImageHandler,
  proxy: proxyHandler,
  sitemap: sitemapHandler,
  status: statusHandler,
  subscription: subscriptionHandler,
  payment: subscriptionHandler,
  telegram: telegramHandler,
  update: updateHandler,
  'verify-captcha': verifyCaptchaHandler,
};

export default async function handler(req, res) {
  // 1. CANONICAL DOMAIN REDIRECT FOR VERCEL DEPLOYMENTS
  const reqHost = (req.headers['x-forwarded-host'] || req.headers['host'] || '').toLowerCase();
  if (reqHost.includes('movieflix-pi-six.vercel.app') || (reqHost.includes('vercel.app') && !reqHost.includes('wallpaperdomain'))) {
    return res.redirect ? res.redirect(302, `https://mws.wallpaperdomain.xyz${req.url || ''}`) : (() => {
      res.statusCode = 302;
      res.setHeader('Location', `https://mws.wallpaperdomain.xyz${req.url || ''}`);
      res.end();
    })();
  }

  // 2. PARSE ENDPOINT ROUTE
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname || '/');

  // Extract endpoint identifier from URL or query
  let endpoint = '';
  if (req.query?.path) {
    endpoint = String(req.query.path).split('/')[0].split('?')[0];
  } else if (pathname.startsWith('/api/')) {
    endpoint = pathname.replace(/^\/api\/?/, '').split('/')[0].split('?')[0];
  }

  // Map sub-routes for content
  if (['home', 'catalog', 'movies', 'tv-series', 'animation', 'shots', 'reels', 'search', 'detail', 'stream'].includes(endpoint)) {
    if (endpoint === 'home' || endpoint === 'catalog') {
      req.query = { ...req.query, endpoint: 'home' };
    } else if (endpoint === 'movies') {
      req.query = { ...req.query, endpoint: 'movies' };
    } else if (endpoint === 'tv-series') {
      req.query = { ...req.query, endpoint: 'tv-series' };
    } else if (endpoint === 'animation') {
      req.query = { ...req.query, endpoint: 'animation' };
    } else if (endpoint === 'shots' || endpoint === 'reels') {
      req.query = { ...req.query, endpoint: 'shots' };
    } else if (endpoint === 'search') {
      req.query = { ...req.query, endpoint: 'search' };
    } else if (endpoint === 'detail') {
      const parts = pathname.replace(/^\/api\/detail\/?/, '').split('/');
      req.query = { ...req.query, endpoint: 'detail', slug: parts[0] };
    } else if (endpoint === 'stream') {
      const parts = pathname.replace(/^\/api\/stream\/?/, '').split('/');
      if (parts[1] === 'captions') {
        req.query = { ...req.query, endpoint: 'captions', id: parts[0] };
      } else {
        req.query = { ...req.query, endpoint: 'stream', id: parts[0] };
      }
    }
    endpoint = 'content';
  }

  const routeHandler = ROUTE_HANDLERS[endpoint];
  if (!routeHandler) {
    if (res.status) {
      return res.status(404).json({ error: `API route not found: ${pathname}` });
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
  }

  try {
    const fn = routeHandler.default || routeHandler;
    return await fn(req, res);
  } catch (err) {
    console.error(`[API Gateway Error: ${endpoint}]`, err);
    if (!res.headersSent) {
      if (res.status) {
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
      }
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  }
}
