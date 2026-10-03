// ─── Movieflix Official APK Download Serverless Proxy ──────────────────────────
// Securely resolves and redirects to the latest release APK from GitHub Releases
// using process.env.GITHUB_TOKEN without exposing credentials to client devices.

const GITHUB_OWNER = 'nuratix';
const GITHUB_REPO = 'movieflix';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Only GET is supported.' });
  }

  const authHeader = GITHUB_TOKEN
    ? GITHUB_TOKEN.startsWith('Bearer ') || GITHUB_TOKEN.startsWith('token ')
      ? GITHUB_TOKEN
      : `token ${GITHUB_TOKEN}`
    : null;

  try {
    const listRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      {
        headers: {
          'User-Agent': 'Movieflix-Download-Proxy/1.1.4',
          'Accept': 'application/vnd.github.v3+json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      }
    );

    if (!listRes.ok) {
      console.warn(`GitHub releases fetch error status: ${listRes.status}`);
      return res.redirect(302, `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
    }

    const releases = await listRes.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      return res.status(404).json({ error: 'No releases found.' });
    }

    // Find the latest non-draft release
    const latestRelease = releases.find((r) => !r.draft) || releases[0];
    const assets = Array.isArray(latestRelease.assets) ? latestRelease.assets : [];

    // Find the release APK asset
    const apkAsset = assets.find(
      (a) =>
        (a.name && a.name.toLowerCase().endsWith('.apk')) ||
        a.content_type === 'application/vnd.android.package-archive'
    );

    if (!apkAsset) {
      // If release is published without APK yet, redirect to releases page
      return res.redirect(
        302,
        latestRelease.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`
      );
    }

    // If client requested release metadata JSON:
    if (req.query && req.query.info === 'true') {
      return res.status(200).json({
        success: true,
        version: (latestRelease.tag_name || '1.1.4').replace(/^v/i, ''),
        tag: latestRelease.tag_name || 'v1.1.4',
        releaseName: latestRelease.name || `Movieflix ${latestRelease.tag_name}`,
        apkName: apkAsset.name,
        sizeBytes: apkAsset.size,
        publishedAt: latestRelease.published_at,
        downloadUrl: '/api/download',
      });
    }

    // Direct APK download: obtain signed CDN URL from GitHub API
    const assetDownloadRes = await fetch(apkAsset.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Movieflix-Download-Proxy/1.1.4',
        'Accept': 'application/octet-stream',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      redirect: 'manual', // intercept 302 to forward signed S3 URL directly
    });

    const s3Location = assetDownloadRes.headers.get('location');
    if (s3Location) {
      // Send 302 Found redirect to the high-speed CDN / S3 signed binary
      res.setHeader('Cache-Control', 'public, max-age=300'); // Cache redirect for 5 min
      return res.redirect(302, s3Location);
    }

    // Fallback: If GitHub direct stream or browser_download_url
    if (apkAsset.browser_download_url) {
      return res.redirect(302, apkAsset.browser_download_url);
    }

    return res.redirect(302, latestRelease.html_url);
  } catch (err) {
    console.error('Download proxy error:', err.message);
    return res.redirect(302, `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
  }
}
