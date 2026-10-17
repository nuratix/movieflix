// ─── Universal CORS & Domain Allowlist Helper for Movieflix ────────────────
// Validates origins across Movieflix, WallpaperDomain, and Amazon domains.

export function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    // 1. Localhost and development ports
    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }

    // 2. Movieflix domains (e.g. movieflix.lol, www.movieflix.lol, dev.movieflix.lol)
    if (host === 'movieflix.lol' || host.endsWith('.movieflix.lol')) {
      return true;
    }

    // 3. WallpaperDomain ecosystem (e.g. mws.wallpaperdomain.xyz, ads.wallpaperdomain.xyz, app.wallpaperdomain.xyz)
    if (
      host === 'wallpaperdomain.xyz' ||
      host.endsWith('.wallpaperdomain.xyz') ||
      host === 'wallpaperdomain.com' ||
      host.endsWith('.wallpaperdomain.com')
    ) {
      return true;
    }

    // 4. Amazon & AWS streaming/media domains
    if (
      host === 'amazon.com' ||
      host.endsWith('.amazon.com') ||
      host === 'amazonaws.com' ||
      host.endsWith('.amazonaws.com') ||
      host === 'media-amazon.com' ||
      host.endsWith('.media-amazon.com') ||
      host === 'images-amazon.com' ||
      host.endsWith('.images-amazon.com') ||
      host === 'ssl-images-amazon.com' ||
      host.endsWith('.ssl-images-amazon.com') ||
      host === 'amazon-adsystem.com' ||
      host.endsWith('.amazon-adsystem.com') ||
      host === 'assoc-amazon.com' ||
      host.endsWith('.assoc-amazon.com') ||
      host === 'amzn.to' ||
      host.endsWith('.amzn.to') ||
      /^(.*\.)?amazon\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)
    ) {
      return true;
    }

    // 5. Upstream catalog provider & CDN
    if (host === 'netfilm.world' || host.endsWith('.netfilm.world')) {
      return true;
    }

    // 6. Vercel preview environments
    if (host.endsWith('.vercel.app')) {
      return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Returns allowed CORS origin string for Access-Control-Allow-Origin response header
 */
export function getCorsOrigin(origin) {
  if (isAllowedOrigin(origin)) {
    return origin;
  }
  return 'https://mws.wallpaperdomain.xyz';
}
