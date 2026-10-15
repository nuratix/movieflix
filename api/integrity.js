import crypto from 'crypto';

// ─── Build Server Security Configuration ──────────────────────────────────────
const OFFICIAL_PACKAGE_NAME = 'com.movieflix.app';
const OFFICIAL_ORIGIN_URL = 'https://mws.wallpaperdomain.xyz';
const OFFICIAL_BUILD_VERSION = '1.1.8';
const OFFICIAL_VERSION_CODE = 9;
const OFFICIAL_BUILD_FINGERPRINT = 'mf_sec_sha256_b48f9d0c2e1a7b3c6e5a9d8f0b1c2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e';

function getIntegritySecret() {
  const secret = process.env.INTEGRITY_SECRET;
  if (!secret) {
    return null;
  }
  return secret;
}

function createSeal(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Sliding window rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  record.count += 1;
  return true;
}

const ALLOWED_ORIGINS = new Set([
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Build-Fingerprint');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  // GET: Public Build Security Metadata (Does NOT expose server fingerprint secret)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      officialPackage: OFFICIAL_PACKAGE_NAME,
      officialOrigin: OFFICIAL_ORIGIN_URL,
      buildVersion: OFFICIAL_BUILD_VERSION,
      versionCode: OFFICIAL_VERSION_CODE,
      timestamp: Date.now(),
    });
  }

  // POST: Live Server Security & Anti-Tamper / Anti-Injection Verification
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const {
        packageName,
        buildFingerprint,
        version,
        versionCode,
        tamperSignals = {},
        platform = 'android',
      } = body;

      // 1. Verify Package Identity
      if (packageName && packageName !== OFFICIAL_PACKAGE_NAME) {
        return res.status(403).json({
          success: false,
          verified: false,
          authentic: false,
          status: 'TAMPERED_PACKAGE_NAME',
          error: 'UNAUTHORIZED_PACKAGE_NAME',
          message: 'The package identifier has been altered or repackaged.',
          officialOrigin: OFFICIAL_ORIGIN_URL,
        });
      }

      // 2. Verify Build Fingerprint against Official Build Server Release Seal
      if (!buildFingerprint || buildFingerprint !== OFFICIAL_BUILD_FINGERPRINT) {
        return res.status(403).json({
          success: false,
          verified: false,
          authentic: false,
          status: 'INVALID_BUILD_FINGERPRINT',
          error: 'FINGERPRINT_MISMATCH',
          message: 'The APK binary fingerprint does not match the official build server release.',
          officialOrigin: OFFICIAL_ORIGIN_URL,
        });
      }

      // 3. Check for Runtime Injections or Hook Frameworks (Frida, Xposed, Substrate)
      if (
        tamperSignals.fridaDetected ||
        tamperSignals.xposedDetected ||
        tamperSignals.debuggerAttached ||
        tamperSignals.injectedLibrariesDetected
      ) {
        return res.status(403).json({
          success: false,
          verified: false,
          authentic: false,
          status: 'CODE_INJECTION_DETECTED',
          error: 'MALICIOUS_INJECTION_DETECTED',
          message: 'An unauthorized hook or code injection engine was detected in the app process.',
          officialOrigin: OFFICIAL_ORIGIN_URL,
        });
      }

      // 4. Issue Cryptographic Verification Seal
      const secret = getIntegritySecret();
      if (!secret) {
        return res.status(503).json({
          success: false,
          error: 'INTEGRITY_SERVICE_UNAVAILABLE',
          message: 'Integrity service is currently unavailable. Please verify configuration.',
        });
      }

      const verificationPayload = {
        packageName: OFFICIAL_PACKAGE_NAME,
        buildFingerprint: OFFICIAL_BUILD_FINGERPRINT,
        version: version || OFFICIAL_BUILD_VERSION,
        versionCode: versionCode || OFFICIAL_VERSION_CODE,
        platform,
        verifiedAt: Date.now(),
      };

      const seal = createSeal(verificationPayload, secret);

      return res.status(200).json({
        success: true,
        verified: true,
        authentic: true,
        status: 'OFFICIAL_BUILD_VERIFIED',
        downloadOrigin: OFFICIAL_ORIGIN_URL,
        seal,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Integrity check error:', err);
      return res.status(500).json({
        success: false,
        error: 'SERVER_INTEGRITY_CHECK_ERROR',
        message: err.message,
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
