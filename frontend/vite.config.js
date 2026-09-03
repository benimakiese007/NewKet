import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { createHash } from 'crypto';

function getHtmlPages(dir, baseDir = '') {
  let results = {};
  try {
    const list = readdirSync(dir);
    list.forEach(file => {
      const fullPath = resolve(dir, file);
      const stat = statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = { ...results, ...getHtmlPages(fullPath, `${baseDir}${file}_`) };
      } else if (file.endsWith('.html')) {
        const name = file.replace('.html', '');
        const key = baseDir ? `${baseDir}${name}` : name;
        results[key] = fullPath;
      }
    });
  } catch (e) {
    console.warn('Erreur lors de la lecture du dossier :', e);
  }
  return results;
}

const buildVersion = process.env.VERCEL_DEPLOYMENT_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || `${process.env.npm_package_version || 'local'}-${Date.now()}`;

export default defineConfig({
  plugins: [
    {
      name: 'newket-html-inject',
      enforce: 'pre',
      transformIndexHtml(html, ctx) {
        const path = ctx.path || '';
        const isMinimalPage = path.includes('/login') || path.includes('/publish') || path.includes('/choose-role') || path.includes('/reset-password') || path.includes('/seller-onboarding');
        const isAdminPage = path.includes('/admin/') || path.endsWith('/admin') || path.includes('/pages/admin/');

        // Inject build version meta tag + iOS PWA update script into every page
        html = html.replace(
          '<meta charset="UTF-8">',
          `<meta charset="UTF-8">\n    <meta name="newket-version" content="${buildVersion}">`
        );
        if (!html.includes('pwa-ios-update.js')) {
          html = html.replace(
            '</head>',
            `  <script src="/js/pwa-ios-update.js" defer><\/script>\n</head>`
          );
        }
        
        let newHtml = html;
        let rootPath = '/';
        
        if (!isAdminPage) {
          if (isMinimalPage) {
            let minimalHtml = readFileSync(resolve(__dirname, 'src/partials/header-minimal.html'), 'utf8');
            minimalHtml = minimalHtml.replace(/\{\{ROOT\}\}/g, rootPath);
            newHtml = newHtml.replace('<div id="header-placeholder"></div>', minimalHtml);
          } else {
            // Render the main header as part of the initial HTML response. The
            // ComponentLoader still refreshes its auth-dependent links later,
            // but visitors no longer see an empty header until JavaScript runs.
            let headerHtml = readFileSync(resolve(__dirname, 'src/partials/header.html'), 'utf8');
            headerHtml = headerHtml.replace(/\{\{ROOT\}\}/g, rootPath);
            headerHtml = headerHtml.replace(/\{\{AUTH_ONLY_START\}\}/g, '').replace(/\{\{AUTH_ONLY_END\}\}/g, '');
            newHtml = newHtml.replace('<div id="header-placeholder"></div>', headerHtml);

            let footerHtml = readFileSync(resolve(__dirname, 'src/partials/footer.html'), 'utf8');
            footerHtml = footerHtml.replace(/\{\{ROOT\}\}/g, rootPath);
            footerHtml = footerHtml.replace(/\{\{AUTH_ONLY_START\}\}/g, '').replace(/\{\{AUTH_ONLY_END\}\}/g, '');
            newHtml = newHtml.replace('<div id="footer-placeholder"></div>', footerHtml);
          }
        }
        
        return newHtml;
      }
    },
    {
      name: 'newket-service-worker-build-version',
      closeBundle() {
        const swPath = resolve(__dirname, 'dist/sw.js');
        try {
          const source = readFileSync(swPath, 'utf8');
          writeFileSync(
            swPath,
            source.replaceAll('__NEWKET_BUILD_VERSION__', buildVersion),
            'utf8'
          );
        } catch (err) {
          console.warn('[NewKet] Unable to stamp service worker build version:', err?.message || err);
        }
      }
    },
    {
      name: 'newket-manifest-build-version',
      closeBundle() {
        const manifestPath = resolve(__dirname, 'dist/manifest.json');
        try {
          const source = readFileSync(manifestPath, 'utf8');
          writeFileSync(
            manifestPath,
            source.replaceAll('__NEWKET_BUILD_VERSION__', buildVersion),
            'utf8'
          );
          console.log(`[NewKet] manifest.json stamped with version: ${buildVersion}`);
        } catch (err) {
          console.warn('[NewKet] Unable to stamp manifest build version:', err?.message || err);
        }
      }
    },
    {
      name: 'newket-icon-version-hash',
      closeBundle() {
        // Calcule un hash court du fichier icône principal.
        // Si l'icône change → hash change → ICON_VERSION change → bandeau iOS affiché.
        // Si seul le code change → icône inchangée → même hash → rien affiché.
        const iconPath = resolve(__dirname, 'public/icons/icon-512-v2.png');
        const pwaScriptPath = resolve(__dirname, 'dist/js/pwa-ios-update.js');
        try {
          const iconBuffer = readFileSync(iconPath);
          const iconHash = createHash('sha256').update(iconBuffer).digest('hex').slice(0, 8);
          const source = readFileSync(pwaScriptPath, 'utf8');
          writeFileSync(
            pwaScriptPath,
            source.replaceAll('__NEWKET_ICON_VERSION__', iconHash),
            'utf8'
          );
          console.log(`[NewKet] Icon version hash: ${iconHash}`);
        } catch (err) {
          console.warn('[NewKet] Unable to stamp icon version hash:', err?.message || err);
        }
      }
    },
    {
      name: 'newket-pretty-url-rewrites',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          try {
            const originalUrl = req.url || '';
            const legacyProduct = originalUrl.match(/^\/boutique\/[^/?#]+\/produit\/([^/?#]+)\/?(?:\?.*)?$/i);
            const prettyProduct = originalUrl.match(/^\/boutique\/[^/?#]+\/([^/?#]+)\/(?:[0-9]{1,3})\/newket\/?(?:\?.*)?$/i);
            const pMatch = legacyProduct || prettyProduct;
            if (pMatch) {
              const productToken = pMatch[1];
              const url = new URL(originalUrl, 'http://localhost');
              if (/^(prod-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(productToken)) {
                url.searchParams.set('id', productToken);
              }
              req.url = `/src/pages/product.html?${url.searchParams.toString()}`;
              return next();
            }

            const m = originalUrl.match(/^\/boutique\/([^/?#]+)(?:\/NewKet)?\/?(?:\?.*)?$/i);
            if (m) {
              const slug = m[1];
              const url = new URL(originalUrl, 'http://localhost');
              url.searchParams.set('shop', slug);
              req.url = `/src/pages/shop.html?${url.searchParams.toString()}`;
            }
          } catch {
          }
          next();
        });
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://code.iconify.design https://va.vercel-scripts.com https://unpkg.com https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net https://browser.sentry-cdn.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' http://localhost:3000 http://127.0.0.1:3000 ws://localhost:5173 wss://localhost:5173 https://unpkg.com https://cdn.jsdelivr.net https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.sentry.io https://*.ingest.de.sentry.io https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com https://fonts.googleapis.com https://fonts.gstatic.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://generativelanguage.googleapis.com",
        "media-src 'self' blob: https:",
        "worker-src 'self' blob:",
        "frame-src 'self'",
        "manifest-src 'self'",
      ].join('; '),
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    },
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws',
    }
  },
  root: '.',
  envDir: './',
  publicDir: './public',
  build: {
    outDir: './dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...getHtmlPages(resolve(__dirname, 'src/pages'))
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
