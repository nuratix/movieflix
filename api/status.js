// ─── MovieFlix System Status & Emergency Gate Endpoint ───────────────────────
// Checks Vercel environment variables:
// - MANTANANCE / MAINTENANCE: when "true", signals that site is under maintenance
// - DONATE: when "true", signals that server is crashed and requests donations
// If neither is true or env is unset, returns regular operational status.

const ALLOWED_ORIGINS = new Set([
  'https://mws.wallpaperdomain.xyz',
  'https://mws.wallpaperdomain.com',
  'https://netfilm.world',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
]);

export default async function handler(req, res) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawMaintenance = (
    process.env.MANTANANCE ||
    process.env.MAINTENANCE ||
    ''
  ).trim().toLowerCase();

  const isMaintenance =
    rawMaintenance === 'true' ||
    rawMaintenance === '1' ||
    rawMaintenance === 'yes';

  const rawDonate = (
    process.env.DONATE ||
    ''
  ).trim().toLowerCase();

  const isDonate =
    rawDonate === 'true' ||
    rawDonate === '1' ||
    rawDonate === 'yes';

  return res.status(200).json({
    success: true,
    maintenance: isMaintenance,
    donate: false,
    timestamp: new Date().toISOString(),
  });
}
