const fs = require('fs');
const path = require('path');

// Cached image buffers
let cached512 = null;
let cached1024 = null;

function loadBuffers() {
  try {
    if (!cached512) {
      const p512 = path.join(process.cwd(), 'assets', 'icon-512.png');
      if (fs.existsSync(p512)) cached512 = fs.readFileSync(p512);
    }
  } catch (_) {}

  try {
    if (!cached1024) {
      const p1024 = path.join(process.cwd(), 'assets', 'icon.png');
      if (fs.existsSync(p1024)) cached1024 = fs.readFileSync(p1024);
    }
  } catch (_) {}
}

async function handler(req, res) {
  loadBuffers();

  const is512 = req.query && req.query.size === '512';
  const buffer = is512
    ? (cached512 || cached1024)
    : (cached1024 || cached512);

  if (!buffer) {
    return res.status(404).send('Icon not found');
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return res.status(200).send(buffer);
}

module.exports = handler;
module.exports.default = handler;
