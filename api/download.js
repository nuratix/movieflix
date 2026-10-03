// ─── Movieflix Official APK Download Serverless Proxy with Neon DB Tracking ─────
// Enforces signed-in users only for downloading the official Android APK.
// Tracks real download counts in Neon Database.
// Zero GitHub credentials or personal access tokens exposed to client devices.

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const GITHUB_OWNER = 'nuratix';
const GITHUB_REPO = 'movieflix';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : '';
const JWT_SECRET = process.env.JWT_SECRET || 'movieflix_neon_secret_2026_super_secure';

// ─── Neon DB Connection Helper ───────────────────────────────────────────────
function getDb() {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!dbUrl) return null;
  return neon(dbUrl);
}

// Auto-create database tables on deployment / startup
let tablesInitialized = false;
async function ensureTables(sql) {
  if (tablesInitialized || !sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS mf_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS mf_downloads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES mf_users(id) ON DELETE SET NULL,
        user_email VARCHAR(255) NOT NULL,
        version VARCHAR(50) DEFAULT '1.1.6',
        ip_address VARCHAR(100),
        user_agent TEXT,
        downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_mf_downloads_email ON mf_downloads(user_email);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_mf_downloads_time ON mf_downloads(downloaded_at);
    `;
    tablesInitialized = true;
  } catch (err) {
    console.error('[Download API] ensureTables error:', err);
  }
}

// ─── JWT Authentication Verification ─────────────────────────────────────────
function verifyJwt(token) {
  if (!token) return null;
  const cleaned = token.replace(/^Bearer\s+/i, '').trim();
  const parts = cleaned.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) return null;

  try {
    let base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired token
    }
    return payload;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Connect to DB and ensure schema is present
  const sql = getDb();
  if (sql) {
    await ensureTables(sql);
  }

  // 1. PUBLIC METADATA ENDPOINT: /api/download?info=true
  if (req.method === 'GET' && req.query && req.query.info === 'true') {
    let realDownloads = 0;
    if (sql) {
      try {
        const rows = await sql`SELECT COUNT(*)::int AS count FROM mf_downloads`;
        realDownloads = rows[0]?.count || 0;
      } catch (err) {
        console.warn('[Download API] Real count query failed:', err.message);
      }
    }

    // Try fetching latest release info from GitHub
    let releaseVersion = '1.1.6';
    let releaseTag = 'v1.1.6';
    let sizeBytes = 102760448; // ~98 MB
    let publishedAt = new Date().toISOString();

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
            'User-Agent': 'Movieflix-Download-Proxy/1.1.5',
            'Accept': 'application/vnd.github.v3+json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
        }
      );
      if (listRes.ok) {
        const releases = await listRes.json();
        const latest = Array.isArray(releases) && (releases.find(r => !r.draft) || releases[0]);
        if (latest) {
          releaseTag = latest.tag_name || 'v1.1.5';
          releaseVersion = releaseTag.replace(/^v/i, '');
          publishedAt = latest.published_at || publishedAt;
          const assets = Array.isArray(latest.assets) ? latest.assets : [];
          const apk = assets.find(a => a.name && a.name.toLowerCase().endsWith('.apk'));
          if (apk && apk.size) {
            sizeBytes = apk.size;
          }
        }
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      version: releaseVersion,
      tag: releaseTag,
      developer: 'movieflix',
      ageRating: '18+',
      sizeBytes,
      sizeFormatted: sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '98 MB',
      realDownloads,
      publishedAt,
      downloadUrl: '/api/download',
    });
  }

  // 2. AUTHENTICATION CHECK: Only signed-in users can download from web browser
  const isAppUpdater =
    req.query?.source === 'app_update' ||
    req.headers['x-app-updater'] === 'true' ||
    (typeof req.headers['user-agent'] === 'string' &&
      req.headers['user-agent'].includes('Movieflix-App'));

  let user = null;
  if (!isAppUpdater) {
    const authHeader = req.headers['authorization'] || '';
    const tokenQuery = req.query?.token || req.body?.token || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || tokenQuery;

    user = verifyJwt(token);
    if (!user || !user.email) {
      // If not authenticated:
      const wantsJson = (req.headers['accept'] || '').includes('application/json') || req.query?.format === 'json';
      if (wantsJson || req.method === 'POST') {
        return res.status(401).json({
          error: 'Authentication required. Please sign in to download MovieFlix APK.',
          code: 'SIGNIN_REQUIRED',
        });
      }
      // Browser direct navigation redirect to /download with auth required query
      return res.redirect(302, '/download?auth=required');
    }
  }

  // 3. RECORD DOWNLOAD IN NEON DATABASE
  if (sql) {
    try {
      const ip =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        '';
      const ua = req.headers['user-agent'] || '';
      const email = user?.email || (isAppUpdater ? 'in_app_updater@movieflix.internal' : 'anonymous');
      await sql`
        INSERT INTO mf_downloads (user_id, user_email, version, ip_address, user_agent)
        VALUES (${user?.id || null}, ${email}, '1.1.6', ${ip.slice(0, 100)}, ${ua.slice(0, 500)})
      `;
    } catch (dbErr) {
      console.error('[Download API] Record download error:', dbErr.message);
    }
  }

  // 4. RESOLVE LATEST RELEASE APK REDIRECT
  const ghAuthHeader = GITHUB_TOKEN
    ? GITHUB_TOKEN.startsWith('Bearer ') || GITHUB_TOKEN.startsWith('token ')
      ? GITHUB_TOKEN
      : `token ${GITHUB_TOKEN}`
    : null;

  try {
    const listRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      {
        headers: {
          'User-Agent': 'Movieflix-Download-Proxy/1.1.5',
          'Accept': 'application/vnd.github.v3+json',
          ...(ghAuthHeader ? { Authorization: ghAuthHeader } : {}),
        },
      }
    );

    if (!listRes.ok) {
      return res.redirect(302, `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
    }

    const releases = await listRes.json();
    const latestRelease = Array.isArray(releases) && (releases.find(r => !r.draft) || releases[0]);
    if (!latestRelease) {
      return res.status(404).json({ error: 'No releases found.' });
    }

    const assets = Array.isArray(latestRelease.assets) ? latestRelease.assets : [];
    const apkAsset = assets.find(
      a => (a.name && a.name.toLowerCase().endsWith('.apk')) || a.content_type === 'application/vnd.android.package-archive'
    );

    if (!apkAsset) {
      return res.redirect(302, latestRelease.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`);
    }

    // Direct APK download: obtain signed CDN URL from GitHub API
    const assetDownloadRes = await fetch(apkAsset.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Movieflix-Download-Proxy/1.1.5',
        'Accept': 'application/octet-stream',
        ...(ghAuthHeader ? { Authorization: ghAuthHeader } : {}),
      },
      redirect: 'manual',
    });

    const s3Location = assetDownloadRes.headers.get('location');
    if (s3Location) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.redirect(302, s3Location);
    }

    if (apkAsset.browser_download_url) {
      return res.redirect(302, apkAsset.browser_download_url);
    }

    return res.redirect(302, latestRelease.html_url);
  } catch (err) {
    console.error('[Download API] Proxy redirect error:', err.message);
    return res.redirect(302, `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
  }
}
