// ─── Post-Export SEO & Social Share Metadata Injector ─────────────────────────
// Generates dedicated SEO pages with rich OpenGraph cards, Twitter cards,
// high-volume keywords, and Schema.org JSON-LD graphs for every individual route:
// - / (Home)
// - /download (and /apk)
// - /privacy
// - /terms
// - /dmca

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

const rawTemplateHtml = fs.readFileSync(indexPath, 'utf8')
  .replace(/<style id="(?:cf-challenge-styles|mf-verify-styles)">[\s\S]*?<\/style>/gi, '')
  .replace(/<!-- Instant Login\/Verification Bypass Check -->[\s\S]*?<\/script>\s*(?=<noscript|<div id="root")/gi, '');

const BASE_URL = 'https://mws.wallpaperdomain.xyz';
const OG_BANNER = `${BASE_URL}/assets/og-banner.png`;
const ICON_512 = `${BASE_URL}/assets/icon-512.png`;
const FAVICON = `${BASE_URL}/favicon.png`;

// Shared common header tags
const getCommonMeta = () => `
    <meta name="author" content="MovieFlix" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="MovieFlix" />
    <link rel="icon" type="image/png" href="${FAVICON}" />
    <link rel="icon" type="image/png" sizes="192x192" href="${FAVICON}" />
    <link rel="icon" type="image/png" sizes="32x32" href="${FAVICON}" />
    <link rel="shortcut icon" type="image/png" href="${FAVICON}" />
    <link rel="apple-touch-icon" sizes="180x180" href="${ICON_512}" />
    <meta property="og:site_name" content="MovieFlix" />
    <meta property="og:image" content="${OG_BANNER}" />
    <meta property="og:image:secure_url" content="${OG_BANNER}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image" content="${ICON_512}" />
    <meta property="og:image:secure_url" content="${ICON_512}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <link rel="image_src" href="${ICON_512}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@movieflixlol" />
    <meta name="twitter:creator" content="@movieflixlol" />
    <meta name="twitter:image" content="${OG_BANNER}" />
    <!-- Google reCAPTCHA v2 Bot Protection -->
    <meta name="recaptcha-site-key" content="6LcgT-stAAAAAJqL8-Jytz125rPxUsFv3aZt69zn" />
    <script src="https://www.google.com/recaptcha/api.js?onload=onMfRecaptchaLoaded&render=explicit" async defer></script>
    <!-- Vercel Web Analytics -->
    <script defer src="/_vercel/insights/script.js"></script>
`;

const getBotProtectionStyles = () => `
    <style id="mf-verify-styles">
      /* Full Page Bot Protection Verification */
      #mf-verify-wrap, #cf-challenge-wrap {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background-color: #0b0d13;
        color: #d1d5db;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        opacity: 1;
        transition: opacity 0.35s ease-out;
      }
      .mf-verify-card {
        max-width: 500px;
        width: 100%;
        background: #141721;
        border: 1px solid #232838;
        border-radius: 14px;
        padding: 36px 32px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85);
        box-sizing: border-box;
      }
      .mf-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 22px;
      }
      .mf-logo {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        object-fit: contain;
      }
      .mf-site-name {
        font-size: 21px;
        font-weight: 700;
        letter-spacing: -0.3px;
        color: #ffffff;
      }
      .mf-title {
        font-size: 22px;
        font-weight: 600;
        color: #ffffff;
        margin: 0 0 10px 0;
        line-height: 1.35;
      }
      .mf-desc {
        font-size: 14px;
        color: #9ca3af;
        margin: 0 0 22px 0;
        line-height: 1.55;
      }
      .mf-recaptcha-box {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 78px;
        margin: 16px 0 20px 0;
      }
      @media (max-width: 380px) {
        .mf-recaptcha-box {
          transform: scale(0.9);
          transform-origin: center center;
        }
      }
      .mf-status-row {
        margin-top: -8px;
        margin-bottom: 16px;
        font-size: 13px;
        text-align: center;
        display: none;
      }
      .mf-status-row.active {
        display: block;
        color: #8b949e;
      }
      .mf-status-row.success {
        display: block;
        color: #3fb950;
        font-weight: 500;
      }
      .mf-status-row.error {
        display: block;
        color: #f85149;
      }
      .mf-info {
        font-size: 12px;
        color: #6b7280;
        line-height: 1.6;
        border-top: 1px solid #1e2333;
        padding-top: 18px;
        margin-bottom: 18px;
      }
      .mf-bottom {
        border-top: 1px solid #1e2333;
        padding-top: 14px;
        font-size: 11px;
        color: #4b5563;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
    </style>
`;

const getBotProtectionBodyHtml = () => `
    <!-- Instant Login/Verification Bypass Check -->
    <script>
      (function() {
        try {
          var isLogged = false;
          var rawSess = localStorage.getItem('@mf_session');
          if (rawSess) {
            var s = JSON.parse(rawSess);
            if (s && (s.accessToken || s.user)) isLogged = true;
          }
          var capToken = localStorage.getItem('movieflix_captcha_verified') || localStorage.getItem('movieflix_cf_verified');
          var capTime = parseInt(localStorage.getItem('movieflix_captcha_verified_at') || localStorage.getItem('movieflix_cf_verified_at') || '0', 10);
          var isVerified = Boolean(capToken && capTime && (Date.now() - capTime < 7 * 24 * 60 * 60 * 1000));
          if (isLogged || isVerified) {
            document.write('<style>#mf-verify-wrap, #cf-challenge-wrap { display: none !important; }</style>');
          }
        } catch (_) {}
      })();
    </script>

    <!-- Full-Screen Bot Protection Barrier -->
    <div id="mf-verify-wrap">
      <div class="mf-verify-card">
        <div class="mf-brand">
          <img src="/favicon.png" alt="MovieFlix" class="mf-logo" onerror="this.style.display='none'" />
          <div class="mf-site-name">movieflix.lol</div>
        </div>
        <h1 class="mf-title">Security Verification</h1>
        <p class="mf-desc">Please complete the security check below to access movieflix.lol.</p>

        <div class="mf-recaptcha-box">
          <div id="movieflix-recaptcha-target"></div>
        </div>
        <div id="mf-status-msg" class="mf-status-row"></div>

        <div class="mf-info">
          Why am I seeing this page? Automated verification protects movieflix.lol high-speed streaming servers and API routes against malicious bots and automated scrapers.
        </div>

        <div class="mf-bottom">
          <span>Security verification for <strong>movieflix.lol</strong></span>
          <span>Powered by <strong>Google reCAPTCHA</strong></span>
        </div>
      </div>
    </div>

    <script>
      (function() {
        var SITE_KEY = '6LcgT-stAAAAAJqL8-Jytz125rPxUsFv3aZt69zn';
        var VERIFY_URL = '/api/verify-captcha';
        var hasVerified = false;
        var widgetRendered = false;

        function checkBypass() {
          try {
            var rawSess = localStorage.getItem('@mf_session');
            if (rawSess) {
              var s = JSON.parse(rawSess);
              if (s && (s.accessToken || s.user)) return true;
            }
            var capToken = localStorage.getItem('movieflix_captcha_verified') || localStorage.getItem('movieflix_cf_verified');
            var capTime = parseInt(localStorage.getItem('movieflix_captcha_verified_at') || localStorage.getItem('movieflix_cf_verified_at') || '0', 10);
            if (capToken && capTime && (Date.now() - capTime < 7 * 24 * 60 * 60 * 1000)) return true;
          } catch (_) {}
          return false;
        }

        if (checkBypass()) {
          var wrap = document.getElementById('mf-verify-wrap') || document.getElementById('cf-challenge-wrap');
          if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
          return;
        }

        function unlockSite(token) {
          if (hasVerified) return;
          hasVerified = true;

          try {
            localStorage.setItem('movieflix_captcha_verified', token || 'verified_v2');
            localStorage.setItem('movieflix_cf_verified', token || 'verified_v2');
            localStorage.setItem('movieflix_captcha_verified_at', Date.now().toString());
            localStorage.setItem('movieflix_cf_verified_at', Date.now().toString());
          } catch (_) {}

          var status = document.getElementById('mf-status-msg');
          if (status) {
            status.className = 'mf-status-row success';
            status.textContent = 'Verification successful. Welcome to movieflix.lol!';
          }

          var wrap = document.getElementById('mf-verify-wrap') || document.getElementById('cf-challenge-wrap');
          if (wrap) {
            wrap.style.opacity = '0';
            wrap.style.pointerEvents = 'none';
            setTimeout(function() {
              if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
            }, 380);
          }
        }

        window.onMfCaptchaVerified = function(token) {
          var status = document.getElementById('mf-status-msg');
          if (status) {
            status.className = 'mf-status-row active';
            status.textContent = 'Verifying security token...';
          }

          fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
          })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data && data.success) {
              unlockSite(data.session || token);
            } else {
              if (status) {
                status.className = 'mf-status-row error';
                status.textContent = (data && data.error) ? data.error : 'Verification failed. Please try again.';
              }
              if (window.grecaptcha && window.mfRecaptchaId !== undefined) {
                window.grecaptcha.reset(window.mfRecaptchaId);
              }
            }
          })
          .catch(function() {
            // Network fallback: still unlock to avoid user lockout
            unlockSite(token);
          });
        };

        window.onMfRecaptchaLoaded = function() {
          if (checkBypass()) {
            unlockSite();
            return;
          }
          if (widgetRendered) return;
          var target = document.getElementById('movieflix-recaptcha-target');
          if (target && window.grecaptcha && window.grecaptcha.render) {
            widgetRendered = true;
            try {
              window.mfRecaptchaId = window.grecaptcha.render('movieflix-recaptcha-target', {
                'sitekey': SITE_KEY,
                'theme': 'dark',
                'callback': window.onMfCaptchaVerified,
                'error-callback': function() {
                  var s = document.getElementById('mf-status-msg');
                  if (s) {
                    s.className = 'mf-status-row error';
                    s.textContent = 'Captcha connection error. Please refresh.';
                  }
                }
              });
            } catch (err) {
              console.warn('[reCAPTCHA render]', err);
            }
          }
        };

        function initChallenge() {
          if (checkBypass()) {
            unlockSite();
            return;
          }
          if (window.grecaptcha && window.grecaptcha.render) {
            window.onMfRecaptchaLoaded();
          }
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initChallenge);
        } else {
          initChallenge();
        }
      })();
    </script>
`;

// Page-specific definitions
const PAGES = {
  home: {
    outPath: path.join(distDir, 'index.html'),
    title: 'MovieFlix - Watch & Download Free Movies, TV Series & Official APK (v1.1.8)',
    description: 'Stream and download thousands of HD movies, web series, Hindi dubbed blockbusters, and anime in 4K/1080p with zero ads. Download the official MovieFlix Android APK.',
    canonical: `${BASE_URL}/`,
    ogType: 'website',
    keywords: 'movieflix, movieflix app, movieflix apk, movieflix download, movieflix official, free movies, watch movies online, full hd movies, 1080p movies, 4k movies, stream movies online free, latest movies 2026, hollywood movies in hindi, bollywood movies free, web series free, kdrama streaming, anime series, watch anime online, download movies apk, ad free movie app, no subscription streaming',
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${BASE_URL}/#website`,
          "url": `${BASE_URL}/`,
          "name": "MovieFlix",
          "description": "Free Movies, TV Series, and Anime Streaming Platform with Official Android App Download",
          "publisher": {
            "@type": "Organization",
            "name": "MovieFlix",
            "url": `${BASE_URL}/`,
            "logo": {
              "@type": "ImageObject",
              "url": FAVICON
            }
          },
          "potentialAction": [
            {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${BASE_URL}/?q={search_term_string}`
              },
              "query-input": "required name=search_term_string"
            }
          ]
        },
        {
          "@type": "SoftwareApplication",
          "@id": `${BASE_URL}/#application`,
          "name": "MovieFlix for Android",
          "operatingSystem": "Android 7.0 and up",
          "applicationCategory": "EntertainmentApplication",
          "applicationSubCategory": "VideoStreamingApplication",
          "softwareVersion": "1.1.8",
          "fileSize": "98MB",
          "downloadUrl": `${BASE_URL}/api/download`,
          "installUrl": `${BASE_URL}/download`,
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "description": "Stream & download thousands of movies, TV shows, and anime in 4K/1080p with multi-audio dubs and zero ads on Android."
        }
      ]
    }
  },

  download: {
    outPath: path.join(distDir, 'download', 'index.html'),
    altPath: path.join(distDir, 'apk', 'index.html'),
    title: 'Download MovieFlix APK v1.1.8 (Official) - Free Android Movies & TV App',
    description: 'Download official MovieFlix Android APK (v1.1.8). Stream and download unlimited 4K/1080p movies, TV series, anime, and shorts with multi-audio dubs and zero ads. 100% Safe & Verified.',
    canonical: `${BASE_URL}/download`,
    ogType: 'website',
    keywords: 'movieflix apk, download movieflix, movieflix android apk, movieflix official apk, movieflix apk download latest version, movieflix 1.1.8 apk, free movie downloader apk, stream movies android apk, safe movie app apk, no ads movie apk',
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          "@id": `${BASE_URL}/download#application`,
          "name": "MovieFlix Android APK",
          "operatingSystem": "Android 7.0+",
          "applicationCategory": "EntertainmentApplication",
          "applicationSubCategory": "VideoStreamingApplication",
          "softwareVersion": "1.1.8",
          "fileSize": "98MB",
          "downloadUrl": `${BASE_URL}/api/download`,
          "installUrl": `${BASE_URL}/download`,
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.9",
            "ratingCount": "12840",
            "bestRating": "5",
            "worstRating": "1"
          },
          "description": "Official MovieFlix Android APK v1.1.8. Enjoy high-speed downloads, unlimited 4K streaming, multi-language subtitles, and zero ads on Android."
        },
        {
          "@type": "HowTo",
          "@id": `${BASE_URL}/download#install-guide`,
          "name": "How to Download and Install MovieFlix APK on Android",
          "step": [
            {
              "@type": "HowToStep",
              "name": "Download the APK",
              "text": "Tap the Download APK button to download the official verified MovieFlix APK file."
            },
            {
              "@type": "HowToStep",
              "name": "Allow Unknown Sources",
              "text": "If prompted by Android, enable 'Allow from this source' for your browser or file manager."
            },
            {
              "@type": "HowToStep",
              "name": "Install and Stream",
              "text": "Open the downloaded APK, tap Install, and launch MovieFlix to stream unlimited movies and series."
            }
          ]
        }
      ]
    }
  },

  privacy: {
    outPath: path.join(distDir, 'privacy', 'index.html'),
    title: 'Privacy Policy - MovieFlix Official Streaming Platform',
    description: 'Read the MovieFlix Privacy Policy. Learn about our strict zero-tracking principles, encrypted local storage, no-log guarantee, and user data protections.',
    canonical: `${BASE_URL}/privacy`,
    ogType: 'article',
    keywords: 'movieflix privacy policy, movieflix security, zero tracking streaming, private movie app, encrypted offline downloads, user data privacy',
    schema: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "@id": `${BASE_URL}/privacy#page`,
      "url": `${BASE_URL}/privacy`,
      "name": "MovieFlix Privacy Policy",
      "description": "MovieFlix privacy protections, data practices, and zero-tracking commitment.",
      "publisher": {
        "@type": "Organization",
        "name": "MovieFlix",
        "url": `${BASE_URL}/`
      }
    }
  },

  terms: {
    outPath: path.join(distDir, 'terms', 'index.html'),
    title: 'Terms of Service - MovieFlix Official Platform',
    description: 'Terms of Service and Conditions of Use for the MovieFlix website, mobile services, and Android application.',
    canonical: `${BASE_URL}/terms`,
    ogType: 'article',
    keywords: 'movieflix terms of service, movieflix user agreement, movieflix conditions of use',
    schema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${BASE_URL}/terms#page`,
      "url": `${BASE_URL}/terms`,
      "name": "MovieFlix Terms of Service",
      "description": "Terms of Service and legal guidelines for MovieFlix users.",
      "publisher": {
        "@type": "Organization",
        "name": "MovieFlix",
        "url": `${BASE_URL}/`
      }
    }
  },

  dmca: {
    outPath: path.join(distDir, 'dmca', 'index.html'),
    title: 'DMCA & Copyright Compliance - MovieFlix',
    description: 'Digital Millennium Copyright Act (DMCA) compliance notice, copyright policy, and designated agent contact information for MovieFlix.',
    canonical: `${BASE_URL}/dmca`,
    ogType: 'article',
    keywords: 'movieflix dmca, movieflix copyright policy, copyright infringement notice, takedown request movieflix',
    schema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${BASE_URL}/dmca#page`,
      "url": `${BASE_URL}/dmca`,
      "name": "MovieFlix DMCA Notice",
      "description": "DMCA policy and copyright compliance information for MovieFlix.",
      "publisher": {
        "@type": "Organization",
        "name": "MovieFlix",
        "url": `${BASE_URL}/`
      }
    }
  },

  maintenance: {
    outPath: path.join(distDir, 'maintenance', 'index.html'),
    title: 'Site Under Maintenance — MovieFlix',
    description: 'MovieFlix is currently under scheduled maintenance. Please check back shortly.',
    canonical: `${BASE_URL}/maintenance`,
    ogType: 'website',
    keywords: 'movieflix maintenance, movieflix server status',
    schema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "MovieFlix Under Maintenance",
      "description": "MovieFlix is undergoing scheduled system maintenance."
    }
  },

  donate: {
    outPath: path.join(distDir, 'donate', 'index.html'),
    title: 'Support MovieFlix Server Recovery — Cryptocurrency & Bitcoin Donation',
    description: 'Our server has crashed. Please donate to help keep MovieFlix alive for everyone.',
    canonical: `${BASE_URL}/donate`,
    ogType: 'website',
    keywords: 'donate movieflix, cryptocurrency donation, bitcoin donation, nowpayments',
    schema: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "MovieFlix Server Donation",
      "description": "Help support MovieFlix infrastructure."
    }
  },

  pricing: {
    outPath: path.join(distDir, 'pricing', 'index.html'),
    title: 'Movieflix Pro — Upgrade to 4K Ultra HD & Zero Ads',
    description: 'Upgrade your Movieflix account to Pro. Stream movies and series in crisp 4K Ultra HD with zero ads and all VIP episodes.',
    canonical: `${BASE_URL}/pricing`,
    ogType: 'website',
    keywords: 'movieflix pro, movieflix premium, 4k movies, ad-free streaming, telegram stars subscription',
    schema: {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Movieflix Pro Subscription",
      "description": "Unlock 4K streaming quality and 100% ad-free playback on Movieflix.",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "1.00",
        "highPrice": "5.00"
      }
    }
  }
};

// Generate HTML with injected metadata for a specific page definition
function generatePageHtml(template, page) {
  let content = template;
  // Remove any preexisting title
  content = content.replace(/<title>.*?<\/title>/i, '');

  const headSnippet = `
    <!-- Page Specific Primary SEO -->
    <title>${page.title}</title>
    <meta name="title" content="${page.title}" />
    <meta name="description" content="${page.description}" />
    <link rel="canonical" href="${page.canonical}" />
    <meta name="keywords" content="${page.keywords}" />

    <!-- Open Graph Tags -->
    <meta property="og:type" content="${page.ogType}" />
    <meta property="og:url" content="${page.canonical}" />
    <meta property="og:title" content="${page.title}" />
    <meta property="og:description" content="${page.description}" />

    <!-- Twitter Card Tags -->
    <meta name="twitter:url" content="${page.canonical}" />
    <meta name="twitter:title" content="${page.title}" />
    <meta name="twitter:description" content="${page.description}" />

    ${getCommonMeta()}
    ${content.includes('id="mf-verify-styles"') || content.includes('id="cf-challenge-styles"') ? '' : getBotProtectionStyles()}

    <!-- Structured Data (Schema.org JSON-LD Graph) -->
    <script type="application/ld+json">
    ${JSON.stringify(page.schema, null, 2)}
    </script>
`;

  content = content.replace('<head>', '<head>' + headSnippet);
  if (!content.includes('id="mf-verify-wrap"') && !content.includes('id="cf-challenge-wrap"')) {
    content = content.replace('<body>', '<body>' + getBotProtectionBodyHtml());
  }
  return content;
}

// Generate all pages
for (const [key, page] of Object.entries(PAGES)) {
  const dir = path.dirname(page.outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const generatedHtml = generatePageHtml(rawTemplateHtml, page);
  fs.writeFileSync(page.outPath, generatedHtml, 'utf8');
  console.log(`[SEO Injector] Generated SEO page for /${key === 'home' ? '' : key} -> ${path.relative(distDir, page.outPath)}`);

  // If there's an alias path (e.g. /apk for /download)
  if (page.altPath) {
    const altDir = path.dirname(page.altPath);
    if (!fs.existsSync(altDir)) fs.mkdirSync(altDir, { recursive: true });
    fs.writeFileSync(page.altPath, generatedHtml, 'utf8');
    console.log(`[SEO Injector] Generated SEO page alias -> ${path.relative(distDir, page.altPath)}`);
  }
}

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
      if (['icon.png', 'icon-512.png', 'og-banner.png', 'favicon.png', 'favicon.ico', 'movieflix_brand_logo.png'].includes(file)) {
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
