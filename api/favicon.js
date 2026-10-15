const fs = require('fs');
const path = require('path');

let cachedPng = null;
let cachedIco = null;

function loadBuffers() {
  try {
    if (!cachedPng) {
      const paths = [
        path.join(process.cwd(), 'public', 'favicon.png'),
        path.join(process.cwd(), 'assets', 'favicon.png'),
        path.join(process.cwd(), 'assets', 'icon-512.png'),
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          cachedPng = fs.readFileSync(p);
          break;
        }
      }
    }
  } catch (_) {}

  try {
    if (!cachedIco) {
      const paths = [
        path.join(process.cwd(), 'public', 'favicon.ico'),
        path.join(process.cwd(), 'assets', 'favicon.ico'),
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          cachedIco = fs.readFileSync(p);
          break;
        }
      }
    }
  } catch (_) {}
}

async function handler(req, res) {
  loadBuffers();

  const isIco = (req.query && req.query.format === 'ico') || (req.url && req.url.endsWith('.ico'));
  const buffer = isIco ? (cachedIco || cachedPng) : (cachedPng || cachedIco);

  if (!buffer) {
    return res.status(404).send('Favicon not found');
  }

  res.setHeader('Content-Type', isIco ? 'image/x-icon' : 'image/png');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  const origin = req.headers['origin'];
  if (origin && ['https://mws.wallpaperdomain.xyz', 'https://netfilm.world', 'http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'].includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.status(200).send(buffer);
}

module.exports = handler;
module.exports.default = handler;
