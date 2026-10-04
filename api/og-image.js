const fs = require('fs');
const path = require('path');

let cachedBanner = null;

function loadBuffer() {
  if (cachedBanner) return;
  try {
    const pBanner = path.join(process.cwd(), 'assets', 'og-banner.png');
    if (fs.existsSync(pBanner)) {
      cachedBanner = fs.readFileSync(pBanner);
      return;
    }
  } catch (_) {}

  try {
    const pIcon = path.join(process.cwd(), 'assets', 'icon.png');
    if (fs.existsSync(pIcon)) {
      cachedBanner = fs.readFileSync(pIcon);
    }
  } catch (_) {}
}

async function handler(req, res) {
  loadBuffer();

  if (!cachedBanner) {
    return res.status(404).send('OG image not found');
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', cachedBanner.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  const origin = req.headers['origin'];
  if (origin && ['https://movieflix-pi-six.vercel.app', 'https://netfilm.world', 'http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'].includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.status(200).send(cachedBanner);
}

module.exports = handler;
module.exports.default = handler;
