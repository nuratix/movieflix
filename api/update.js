// ─── Movieflix Official Backend Update API ────────────────────────────────────
// Securely checks GitHub releases server-side using process.env.GITHUB_TOKEN.
// The mobile app queries this endpoint (https://movieflix-pi-six.vercel.app/api/update)
// so no GitHub credentials or access tokens are ever bundled or exposed in client code.

const GITHUB_OWNER = 'nuratix';
const GITHUB_REPO = 'movieflix';
const FALLBACK_VERSION = '1.1.4';

/**
 * Compare two semver strings (e.g., "1.1.4" vs "1.1.3", or "v1.1.4" vs "1.1.4")
 * Returns true if remoteVersion > currentVersion
 */
function isNewerVersion(remoteVer, currentVer = FALLBACK_VERSION) {
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

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Only GET is supported.' });
  }

  const currentVersion = (req.query?.current || FALLBACK_VERSION).replace(/^v/i, '');
  const token = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : '';

  try {
    const headers = {
      'User-Agent': 'Movieflix-Update-Service/1.1.4',
      Accept: 'application/vnd.github.v3+json',
    };

    if (token) {
      headers.Authorization =
        token.startsWith('Bearer ') || token.startsWith('token ')
          ? token
          : `token ${token}`;
    }

    const githubRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      { headers }
    );

    if (!githubRes.ok) {
      console.warn(`GitHub releases API returned status: ${githubRes.status}`);
      return res.status(200).json({
        success: false,
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        error: `GitHub API status ${githubRes.status}`,
      });
    }

    const releases = await githubRes.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      return res.status(200).json({
        success: true,
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        releasesCount: 0,
      });
    }

    // Filter out draft releases and take the latest published release
    const validReleases = releases.filter((r) => !r.draft);
    if (validReleases.length === 0) {
      return res.status(200).json({
        success: true,
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
      });
    }

    const latestRelease = validReleases[0];
    const remoteTag = latestRelease.tag_name || latestRelease.name || '';
    const cleanTag = remoteTag.replace(/^v/i, '');
    const hasUpdate = isNewerVersion(remoteTag, currentVersion);

    // Find the APK asset
    let apkAsset = null;
    const assets = Array.isArray(latestRelease.assets) ? latestRelease.assets : [];
    const foundApk = assets.find(
      (a) =>
        (a.name && a.name.toLowerCase().endsWith('.apk')) ||
        a.content_type === 'application/vnd.android.package-archive'
    );

    if (foundApk) {
      apkAsset = {
        name: foundApk.name,
        size: foundApk.size,
        sizeFormatted: formatBytes(foundApk.size),
        downloadUrl: 'https://movieflix-pi-six.vercel.app/api/download',
      };
    }

    // Cache responses at edge for 60 seconds (stale up to 2 minutes)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    return res.status(200).json({
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion: cleanTag,
      latestTag: remoteTag,
      releaseTitle: latestRelease.name || `Version ${remoteTag}`,
      releaseNotes: latestRelease.body || 'Performance improvements and bug fixes.',
      publishedAt: latestRelease.published_at,
      releaseUrl: latestRelease.html_url,
      downloadUrl: 'https://movieflix-pi-six.vercel.app/api/download',
      apkAsset,
    });
  } catch (err) {
    console.error('Update check service error:', err.message);
    return res.status(200).json({
      success: false,
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      error: err.message,
    });
  }
}
