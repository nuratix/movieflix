// ─── Movieflix Official Backend Update API ────────────────────────────────────
// Securely checks GitHub releases server-side using process.env.GITHUB_TOKEN.
// The mobile app queries this endpoint (https://movieflix-pi-six.vercel.app/api/update)
// so no GitHub credentials or access tokens are ever bundled or exposed in client code.

const GITHUB_OWNER = 'nuratix';
const GITHUB_REPO = 'movieflix';
const TARGET_VERSION = '1.1.6';

/**
 * Compare two semver strings (e.g., "1.1.6" vs "1.1.5", or "v1.1.6" vs "1.1.5")
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

* **Home Screen Widget Portrait Posters**: Bundled official high-definition portrait posters (Wednesday, Squid Game, Money Heist) with signature red ambient glow and zero cutoff.
* **Horizontal Season Scroll**: Season selection pill bar is now smoothly scrollable horizontally to easily browse all seasons.
* **"Me" Tab Notification Dot Fix**: Red indicator badge automatically and permanently dismisses when navigating to the Me tab.
* **In-App Updater Package Parsing Fix**: Hardened package integrity checks (>5MB) and direct CDN routing to ensure smooth updates without Android parsing errors.
* **EAS Updates Always-Check Channel**: Instant OTA sync configured for future seamless hotfixes.`;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Disable caching for update checks so clients always get live version info
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Only GET is supported.' });
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
          const validReleases = releases.filter((r) => !r.draft);
          if (validReleases.length > 0) {
            // Find release matching TARGET_VERSION or highest version
            const matchingRelease = validReleases.find(
              (r) => (r.tag_name || '').replace(/^v/i, '') === TARGET_VERSION
            );
            latestRelease = matchingRelease || validReleases[0];

            const assets = Array.isArray(latestRelease.assets) ? latestRelease.assets : [];
            foundApk = assets.find(
              (a) =>
                (a.name && a.name.toLowerCase().endsWith('.apk')) ||
                a.content_type === 'application/vnd.android.package-archive'
            );
          }
        }
      }
    } catch (fetchErr) {
      console.warn('GitHub releases API fetch failed:', fetchErr.message);
    }

    // Determine latest version: must be at least TARGET_VERSION ('1.1.6')
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

    // Determine if update is available for requesting client
    const hasUpdate = isNewerVersion(latestVersion, currentVersion);

    const directApkUrl =
      foundApk?.browser_download_url ||
      `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${latestVersion}/movieflix-v${latestVersion}.apk`;

    const apkAsset = {
      name: foundApk?.name || `movieflix-v${latestVersion}.apk`,
      size: foundApk?.size || 115878148,
      sizeFormatted: foundApk?.size ? formatBytes(foundApk.size) : '110.5 MB',
      downloadUrl: directApkUrl,
    };

    return res.status(200).json({
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion,
      latestTag,
      releaseTitle: latestRelease?.name || `Movieflix v${latestVersion}`,
      releaseNotes: latestRelease?.body || DEFAULT_RELEASE_NOTES,
      publishedAt: latestRelease?.published_at || new Date().toISOString(),
      releaseUrl:
        latestRelease?.html_url ||
        `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${latestVersion}`,
      downloadUrl: directApkUrl,
      apkAsset,
    });
  } catch (err) {
    console.error('Update check service error:', err.message);
    const hasUpdate = isNewerVersion(TARGET_VERSION, currentVersion);
    return res.status(200).json({
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion: TARGET_VERSION,
      latestTag: `v${TARGET_VERSION}`,
      releaseTitle: `Movieflix v${TARGET_VERSION}`,
      releaseNotes: DEFAULT_RELEASE_NOTES,
      downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${TARGET_VERSION}/movieflix-v${TARGET_VERSION}.apk`,
      apkAsset: {
        name: `movieflix-v${TARGET_VERSION}.apk`,
        size: 115878148,
        sizeFormatted: '110.5 MB',
        downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${TARGET_VERSION}/movieflix-v${TARGET_VERSION}.apk`,
      },
    });
  }
}
