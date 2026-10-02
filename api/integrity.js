import crypto from 'crypto';

// ─── Build Server Security & Official Fingerprint Configuration ──────────────
const OFFICIAL_PACKAGE_NAME = 'com.movieflix.app';
const OFFICIAL_ORIGIN_URL = 'https://movieflix-pi-six.vercel.app';
const OFFICIAL_BUILD_VERSION = '1.1.1';
const OFFICIAL_VERSION_CODE = 2;
const OFFICIAL_BUILD_FINGERPRINT = 'mf_sec_sha256_b48f9d0c2e1a7b3c6e5a9d8f0b1c2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e';
const INTEGRITY_SECRET = process.env.INTEGRITY_SECRET || 'mf_integrity_seal_key_2026_secure';

function createSeal(payload) {
  return crypto
    .createHmac('sha256', INTEGRITY_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Build-Fingerprint');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Public Build Security & Official Fingerprint Manifest
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      officialPackage: OFFICIAL_PACKAGE_NAME,
      officialOrigin: OFFICIAL_ORIGIN_URL,
      buildVersion: OFFICIAL_BUILD_VERSION,
      versionCode: OFFICIAL_VERSION_CODE,
      officialFingerprint: OFFICIAL_BUILD_FINGERPRINT,
      securityCheckUrl: `${OFFICIAL_ORIGIN_URL}/api/integrity`,
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
      const verificationPayload = {
        packageName: OFFICIAL_PACKAGE_NAME,
        buildFingerprint: OFFICIAL_BUILD_FINGERPRINT,
        version: version || OFFICIAL_BUILD_VERSION,
        versionCode: versionCode || OFFICIAL_VERSION_CODE,
        platform,
        verifiedAt: Date.now(),
      };

      const seal = createSeal(verificationPayload);

      return res.status(200).json({
        success: true,
        verified: true,
        authentic: true,
        status: 'OFFICIAL_BUILD_VERIFIED',
        downloadOrigin: OFFICIAL_ORIGIN_URL,
        fingerprint: OFFICIAL_BUILD_FINGERPRINT,
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
