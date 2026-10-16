// ─── Movieflix Official Backend Update API ────────────────────────────────────
// Securely checks GitHub releases server-side using process.env.GITHUB_TOKEN.
// The mobile app queries this endpoint (https://mws.wallpaperdomain.xyz/api/update)
// so no GitHub credentials or access tokens are ever bundled or exposed in client code.

const GITHUB_OWNER = process.env.GITHUB_OWNER || Buffer.from('bnVyYXRpeA==', 'base64').toString('ascii');
const GITHUB_REPO = process.env.GITHUB_REPO || 'movieflix';
const TARGET_VERSION = '1.1.9';

/**
 * Compare two semver strings (e.g., "1.1.7" vs "1.1.6", or "v1.1.7" vs "1.1.6")
 * Returns true if remoteVersion > currentVersion
 */
function isNewerVersion(remoteVer, currentVer = TARGET_VERSION) {
  if (!remoteVer) return false;
  const clean = (v) =>
    (v || '')
      .replace(/^v/i, '')
      .split(/[-+]/)[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const r = clean(remoteVer);
  const c = clean(currentVer);

  const len = Math.max(r.length, c.length);
  for (let i = 0; i < len; i++) {
    const rPart = r[i] || 0;
    const cPart = c[i] || 0;
    if (rPart > cPart) return true;
    if (rPart < cPart) return false;
  }
  return false;
}

/**
 * Format bytes into human readable format (e.g., "94.6 MB")
 */
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const DEFAULT_RELEASE_NOTES = `### 🎬 Movieflix v${TARGET_VERSION} Official Release APK

* **Search Pagination & Load More**: Full search pagination support with +More pill in search bar and grid Load More button.
* **Shorts Catalog Previews & Watch This**: Direct middle-portion 1-2 min preview clips for movies and web series with instant "Watch This" play page redirect.
* **Player Episode Selector Sheet**: Modern bottom sheet displaying all episode numbers and season tabs, with instant loading indicator on episode switch.
* **Single Silent Download Notification**: Clean progress bar notification without repetitive sound spam or multiple notification alerts.
* **Ultra-Smooth Video Seeker & Player**: Zero lag scrubber bar with debounced seeking.`;

// Rate limiting for update checks to prevent GitHub API rate limits
const updateRateLimitMap = new Map();
const UPDATE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_UPDATE_CHECKS_PER_WINDOW = 60;

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkUpdateRateLimit(ip) {
  const now = Date.now();
  const record = updateRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    updateRateLimitMap.set(ip, { count: 1, resetTime: now + UPDATE_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_UPDATE_CHECKS_PER_WINDOW) {
    return false;
  }
  record.count += 1;
  return true;
}

const ALLOWED_ORIGINS = new Set([
  'https://mws.wallpaperdomain.com',
  'https://mws.wallpaperdomain.xyz',
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
    res.setHeader('Access-Control-Allow-Origin', 'https://mws.wallpaperdomain.xyz');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  // Disable caching for update checks so clients always get live version info
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Only GET is supported.' });
  }

  const clientIp = getClientIp(req);
  if (!checkUpdateRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many update check requests. Please slow down.' });
  }

  const currentVersion = (req.query?.current || TARGET_VERSION).replace(/^v/i, '');
  const token = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : '';

  try {
    const headers = {
      'User-Agent': `Movieflix-Update-Service/${TARGET_VERSION}`,
      Accept: 'application/vnd.github.v3+json',
    };

    if (token) {
      headers.Authorization =
        token.startsWith('Bearer ') || token.startsWith('token ')
          ? token
          : `token ${token}`;
    }

    let latestRelease = null;
    let foundApk = null;

    try {
      const githubRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
        { headers }
      );

      if (githubRes.ok) {
        const releases = await githubRes.json();
        if (Array.isArray(releases) && releases.length > 0) {
          // Strictly filter for non-draft releases that ALREADY HAVE a completed .apk build asset uploaded
          const completedReleases = releases
            .filter((r) => !r.draft)
            .map((r) => {
              const assets = Array.isArray(r.assets) ? r.assets : [];
              const apk = assets.find(
                (a) =>
                  (a.name && a.name.toLowerCase().endsWith('.apk')) ||
                  a.content_type === 'application/vnd.android.package-archive'
              );
              return { release: r, apk };
            })
            .filter((item) => Boolean(item.apk && item.apk.browser_download_url));

          if (completedReleases.length > 0) {
            // Find newest completed release by semantic version
            let highest = completedReleases[0];
            for (let i = 1; i < completedReleases.length; i++) {
              const currVer = (completedReleases[i].release.tag_name || '').replace(/^v/i, '');
              const highVer = (highest.release.tag_name || '').replace(/^v/i, '');
              if (isNewerVersion(currVer, highVer)) {
                highest = completedReleases[i];
              }
            }
            latestRelease = highest.release;
            foundApk = highest.apk;
          }
        }
      }
    } catch (fetchErr) {
      console.warn('GitHub releases API fetch failed:', fetchErr.message);
    }

    // Determine latest version from verified completed release
    let latestVersion = TARGET_VERSION;
    let latestTag = `v${TARGET_VERSION}`;

    if (latestRelease) {
      const remoteTag = latestRelease.tag_name || latestRelease.name || '';
      const cleanTag = remoteTag.replace(/^v/i, '');
      if (isNewerVersion(cleanTag, TARGET_VERSION)) {
        latestVersion = cleanTag;
        latestTag = remoteTag;
      }
    }

    // STRICT REQUIREMENT:
    // Do NOT show update before APK build is completed with new version and APK URL is available!
    // hasUpdate is true IF AND ONLY IF:
    // 1. latestVersion > currentVersion
    // 2. AND an actual valid APK asset was found with an active browser_download_url!
    const isNewer = isNewerVersion(latestVersion, currentVersion);
    const hasValidApk = Boolean(foundApk);
    const hasUpdate = Boolean(isNewer && hasValidApk);

    const websiteDownloadUrl = 'https://mws.wallpaperdomain.xyz/api/download';

    const apkAsset = hasValidApk
      ? {
          name: foundApk.name || `movieflix-v${latestVersion}.apk`,
          size: foundApk.size || 0,
          sizeFormatted: foundApk.size ? formatBytes(foundApk.size) : 'Unknown size',
          downloadUrl: websiteDownloadUrl,
        }
      : null;

    return res.status(200).json({
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion,
      latestTag,
      releaseTitle: latestRelease?.name || `Movieflix v${latestVersion}`,
      releaseNotes: latestRelease?.body || DEFAULT_RELEASE_NOTES,
      publishedAt: latestRelease?.published_at || new Date().toISOString(),
      releaseUrl: 'https://mws.wallpaperdomain.xyz/download',
      downloadUrl: websiteDownloadUrl,
      apkAsset,
    });
  } catch (err) {
    console.error('Update check service error:', err.message);
    // Never show an update if the update check failed or if no APK is verified
    return res.status(200).json({
      success: true,
      hasUpdate: false,
      currentVersion,
      latestVersion: TARGET_VERSION,
      latestTag: `v${TARGET_VERSION}`,
      releaseTitle: `Movieflix v${TARGET_VERSION}`,
      releaseNotes: DEFAULT_RELEASE_NOTES,
      downloadUrl: 'https://mws.wallpaperdomain.xyz/download',
      apkAsset: null,
    });
  }
}
