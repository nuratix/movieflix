// ─── Google reCAPTCHA Verification Endpoint ─────────────────────────────────
// Verifies user token against Google reCAPTCHA API (v2 Checkbox & v3 Assessment)
// Issues cryptographic session proof stored locally on the client.

import crypto from 'crypto';

const RECAPTCHA_SECRET = (process.env.RECAPTCHA_SECRET_KEY || '').trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

const ALLOWED_ORIGINS = new Set([
  'https://mws.wallpaperdomain.xyz',
  'https://mws.wallpaperdomain.com',
  'https://netfilm.world',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
]);

function setCors(req, res) {
  const origin = req.headers['origin'];
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date, Authorization'
  );
}

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') return realIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '127.0.0.1';
}

function signCaptchaSession(ip, validDays = 7) {
  const expiresAt = Date.now() + validDays * 24 * 60 * 60 * 1000;
  const payload = `${ip}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return {
    token: `${Buffer.from(payload).toString('base64url')}.${hmac}`,
    expiresAt,
  };
}

export function verifyCaptchaSessionToken(tokenStr, ip) {
  if (!tokenStr || typeof tokenStr !== 'string' || !tokenStr.includes('.')) return false;
  const [encodedPayload, hmac] = tokenStr.split('.');
  try {
    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const expectedHmac = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    if (hmac !== expectedHmac) return false;
    const [tokenIp, expiresStr] = payload.split(':');
    const expiresAt = parseInt(expiresStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
    return true;
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Health / Status check or session validation
  if (req.method === 'GET') {
    const sessionHeader = req.headers['x-captcha-session'] || req.query.session;
    const ip = getClientIp(req);
    const isValid = verifyCaptchaSessionToken(sessionHeader, ip);
    return res.status(200).json({
      status: 'ok',
      site_key: process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY || '6Lev_vEtAAAAACFboy87GQIJYCY2Ntx3Iv5WDwH2',
      verified: isValid,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const clientIp = getClientIp(req);
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  body = body || {};

  const token = body.token || body['g-recaptcha-response'] || body.recaptcha_token;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing reCAPTCHA token. Please complete the verification.',
    });
  }

  if (!RECAPTCHA_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'Server reCAPTCHA configuration missing.',
    });
  }

  try {
    const verifyParams = new URLSearchParams({
      secret: RECAPTCHA_SECRET,
      response: token.trim(),
      remoteip: clientIp,
    });

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: verifyParams.toString(),
    });

    if (!verifyRes.ok) {
      return res.status(502).json({
        success: false,
        error: 'Failed to communicate with Google reCAPTCHA verification server.',
      });
    }

    const data = await verifyRes.json();
    console.log('[Captcha API] Google siteverify response:', JSON.stringify(data));

    // Support reCAPTCHA v3: data.success is true, score between 0.0 and 1.0
    const isValidScore = data.score === undefined || data.score >= 0.1;

    if (data.success && isValidScore) {
      const session = signCaptchaSession(clientIp, 7); // 7-day verified session
      res.setHeader(
        'Set-Cookie',
        `mf_verified=${session.token}; Path=/; Max-Age=${7 * 86400}; SameSite=Lax; Secure`
      );
      return res.status(200).json({
        success: true,
        verified: true,
        score: data.score,
        action: data.action,
        hostname: data.hostname,
        message: 'Bot protection check passed successfully.',
        session: session.token,
        expiresAt: session.expiresAt,
      });
    }

    const errorCodes = data['error-codes'] || [];
    console.warn('[Captcha API] reCAPTCHA verification failed with codes:', errorCodes);

    return res.status(403).json({
      success: false,
      error: 'reCAPTCHA verification failed. Please complete the captcha again.',
    });
  } catch (err) {
    console.error('[Captcha API] Verification error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal verification error. Please refresh and try again.',
    });
  }
}
