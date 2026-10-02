// Vercel Serverless Function & Edge Streaming Reverse Proxy for Video & Subtitle Streams
// Bypasses browser Forbidden Header (Referer/Origin) and CORS restrictions

export const config = {
  runtime: 'edge',
};

export default async function handler(req, res) {
  // If invoked in Node.js environment (Connect / Express / Metro dev server)
  if (res && typeof res.writeHead === 'function') {
    return handleNode(req, res);
  }
  // Otherwise Vercel Edge Runtime (Web Standard Request & Response)
  return handleEdge(req);
}

// ----------------------------------------------------
// Edge Runtime Handler (Vercel Production)
// ----------------------------------------------------
async function handleEdge(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing "url" parameter', {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set('Referer', 'https://netfilm.world/');
    upstreamHeaders.set('Origin', 'https://netfilm.world');
    upstreamHeaders.set(
      'User-Agent',
      req.headers.get('user-agent') ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
    );

    const range = req.headers.get('range');
    if (range) {
      upstreamHeaders.set('Range', range);
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    const responseHeaders = new Headers();
    const passthrough = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
      'cache-control',
    ];

    for (const [key, val] of upstreamRes.headers.entries()) {
      if (passthrough.includes(key.toLowerCase())) {
        responseHeaders.set(key, val);
      }
    }

    // Force inline disposition so browser streams video instead of downloading
    responseHeaders.set('Content-Disposition', 'inline');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(`Streaming proxy error: ${err.message}`, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}

// ----------------------------------------------------
// Node.js / Connect Handler (Metro Dev Server / Local)
// ----------------------------------------------------
async function handleNode(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const targetUrl = parsedUrl.searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.end('Missing "url" parameter');
    return;
  }

  try {
    const upstreamHeaders = {
      'Referer': 'https://netfilm.world/',
      'Origin': 'https://netfilm.world',
      'User-Agent':
        req.headers['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    };

    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    const passthrough = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
      'cache-control',
    ];

    for (const [key, val] of upstreamRes.headers.entries()) {
      if (passthrough.includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    }

    res.setHeader('Content-Disposition', 'inline');
    res.statusCode = upstreamRes.status;

    if (upstreamRes.body) {
      const { Readable } = await import('stream');
      Readable.fromWeb(upstreamRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 502;
    }
    res.end(`Streaming proxy error: ${err.message}`);
  }
}
