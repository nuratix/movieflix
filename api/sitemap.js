// Dynamic XML Sitemap for Movieflix
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mws.wallpaperdomain.xyz/</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/download</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/movies</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/series</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/animation</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/privacy</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/movie/lust-stories-q7N2fLtaTA2</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/movie/rrr-eBB3mO4mYV6</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/movie/animal-c8zmSROvma7</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mws.wallpaperdomain.xyz/tv/neagley-kgfRKfjK46</loc>
    <lastmod>2026-10-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

  return res.status(200).send(sitemapXml);
}
