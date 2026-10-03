// ─── Post-Export SEO & Social Share Metadata Injector ─────────────────────────
// Injects rich Open Graph cards, Twitter cards, 100+ keywords, and JSON-LD schema
// directly into dist/index.html so social media crawlers (WhatsApp, Telegram,
// Twitter, Facebook, Instagram, Googlebot) immediately render the app card when shared.

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');
const publicDir = path.join(__dirname, '..', 'public');
const assetsDir = path.join(__dirname, '..', 'assets');
const distAssetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(indexPath)) {
  console.error('[SEO Injector] dist/index.html not found! Skipping.');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');

const SEO_HEAD = `
    <!-- Primary SEO Meta Tags -->
    <title>MovieFlix - Watch & Download Free Movies, TV Series & Official APK (v1.1.4)</title>
    <meta name="title" content="MovieFlix - Watch & Download Free Movies, TV Series & Official APK (v1.1.4)" />
    <meta name="description" content="Stream and download thousands of HD movies, web series, Hindi dubbed blockbusters, and anime in 4K/1080p with zero ads. Download the official MovieFlix Android APK." />
    <meta name="author" content="MovieFlix" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="MovieFlix" />
    <link rel="canonical" href="https://movieflix-pi-six.vercel.app/" />

    <!-- 100+ High-Volume SEO Keywords -->
    <meta name="keywords" content="movieflix, movieflix app, movieflix apk, movieflix download, movieflix official, movieflix web, movieflix online, movieflix free, movieflix android, movieflix apk download, movieflix 1.1.4, movieflix streaming, free movies, watch movies online, free movie streaming, full hd movies, 1080p movies, 4k movies, watch movies free, stream movies online free, latest movies 2026, new release movies, hollywood movies in hindi, bollywood movies free, south indian movies hindi dubbed, action movies, romantic movies, comedy movies, horror movies online, thriller movies, sci fi movies, drama films, family movies, web series free, watch web series online, tv series download, popular tv shows, binge watch series, hindi web series, english tv shows, korean drama hindi dubbed, kdrama streaming, netflix series free, anime series, watch anime online, anime in hindi, japanese animation free, tv shows streaming hd, download movies apk, movie downloader android, free apk download, watch offline movies, download web series, download movies on mobile, free video streaming app, ad free movie app, no ads movie streaming, hindi dubbed movies, english movies with subtitles, tamil movies hindi dubbed, telugu movies in hindi, dual audio movies 720p 1080p, multi audio streaming, movieflix hindi, free hindi streaming, spanish dubbed movies, french dubbed movies, netflix alternative free, prime video alternative, disney plus alternative, cinema hd alternative, moviebox alternative, streamex alternative, hdo box alternative, free ott platform, no subscription streaming, instant streaming without login, safe movie apk, verified movie apk, streaming apk 2026, watch movie trailers, high bitrate video player, subscene subtitles, download movies fast, private video app, zero tracking movie app, movieflix community, free cinema app, watch blockbusters online, top rated imdb movies, popular movies today, new ott releases, movies on android phone, android smart tv movies, offline cinema player" />

    <!-- Open Graph / WhatsApp / Instagram / Telegram / Facebook Card Tags -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MovieFlix" />
    <meta property="og:url" content="https://movieflix-pi-six.vercel.app/" />
    <meta property="og:title" content="MovieFlix - Stream & Download Free Movies, TV Series & Official APK" />
    <meta property="og:description" content="Watch & download thousands of HD movies, trending TV series, Hindi dubbed films, and anime in 4K/1080p with zero ads. Download the official MovieFlix Android app." />

    <!-- Primary Wide OG Banner (1200x630) for Facebook, Twitter, Telegram, Discord -->
    <meta property="og:image" content="https://movieflix-pi-six.vercel.app/assets/og-banner.png" />
    <meta property="og:image:secure_url" content="https://movieflix-pi-six.vercel.app/assets/og-banner.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="MovieFlix - Free Movies & TV Series Official Platform" />

    <!-- Square App Icon (512x512) for WhatsApp Chat Bubble Thumbnail & Mobile Sharing -->
    <meta property="og:image" content="https://movieflix-pi-six.vercel.app/assets/icon-512.png" />
    <meta property="og:image:secure_url" content="https://movieflix-pi-six.vercel.app/assets/icon-512.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />

    <!-- Fallback image_src link for WhatsApp and older crawlers -->
    <link rel="image_src" href="https://movieflix-pi-six.vercel.app/assets/icon-512.png" />

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@movieflixlol" />
    <meta name="twitter:creator" content="@movieflixlol" />
    <meta name="twitter:url" content="https://movieflix-pi-six.vercel.app/" />
    <meta name="twitter:title" content="MovieFlix - Stream & Download Free Movies & Official APK" />
    <meta name="twitter:description" content="Stream & download movies, TV shows, and anime in full HD with multi-audio dubs and zero ads. Download official Android APK." />
    <meta name="twitter:image" content="https://movieflix-pi-six.vercel.app/assets/og-banner.png" />
    <meta name="twitter:image:alt" content="MovieFlix Banner" />

    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icon-512.png" />

    <!-- Structured Data (Schema.org JSON-LD) -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": "https://movieflix-pi-six.vercel.app/#website",
          "url": "https://movieflix-pi-six.vercel.app/",
          "name": "MovieFlix",
          "description": "Free Movies, TV Series, and Anime Streaming Platform with Official Android App Download",
          "publisher": {
            "@type": "Organization",
            "name": "MovieFlix",
            "url": "https://movieflix-pi-six.vercel.app/",
            "logo": {
              "@type": "ImageObject",
              "url": "https://movieflix-pi-six.vercel.app/assets/icon-512.png"
            }
          },
          "potentialAction": [
            {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://movieflix-pi-six.vercel.app/?q={search_term_string}"
              },
              "query-input": "required name=search_term_string"
            }
          ]
        },
        {
          "@type": "SoftwareApplication",
          "@id": "https://movieflix-pi-six.vercel.app/#application",
          "name": "MovieFlix for Android",
          "operatingSystem": "Android 7.0 and up",
          "applicationCategory": "EntertainmentApplication",
          "applicationSubCategory": "VideoStreamingApplication",
          "softwareVersion": "1.1.4",
          "fileSize": "98MB",
          "downloadUrl": "https://movieflix-pi-six.vercel.app/api/download",
          "installUrl": "https://movieflix-pi-six.vercel.app/download",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "description": "Stream & download thousands of movies, TV shows, and anime in 4K/1080p with multi-audio dubs and zero ads on Android."
        }
      ]
    }
    </script>
`;

// Replace title and insert SEO meta tags right after <head>
html = html.replace(/<title>.*?<\/title>/i, '');
html = html.replace('<head>', '<head>' + SEO_HEAD);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('[SEO Injector] Successfully injected SEO tags, OpenGraph cards, Twitter cards, and Schema into dist/index.html');

// 1. Ensure dist/assets directory exists
if (!fs.existsSync(distAssetsDir)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
}

// 2. Copy unhashed root assets into dist/assets/ and dist/
if (fs.existsSync(assetsDir)) {
  const assetFiles = fs.readdirSync(assetsDir);
  assetFiles.forEach((file) => {
    const srcPath = path.join(assetsDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, path.join(distAssetsDir, file));
      if (['icon.png', 'icon-512.png', 'og-banner.png', 'favicon.png', 'movieflix_brand_logo.png'].includes(file)) {
        fs.copyFileSync(srcPath, path.join(distDir, file));
      }
    }
  });
  console.log('[SEO Injector] Copied unhashed assets -> dist/assets/ and dist/');
}

// 3. Copy public files (sitemap, robots, 404, icons) into dist/
if (fs.existsSync(publicDir)) {
  const copyRecursive = (src, dest) => {
    if (fs.statSync(src).isDirectory()) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      fs.readdirSync(src).forEach((item) => {
        copyRecursive(path.join(src, item), path.join(dest, item));
      });
    } else {
      fs.copyFileSync(src, dest);
    }
  };
  copyRecursive(publicDir, distDir);
  console.log('[SEO Injector] Copied public/ directory -> dist/');
}
