import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';

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
        
        let newHtml = html;
        let rootPath = '/';
        
        if (!isAdminPage) {
          if (isMinimalPage) {
            let minimalHtml = readFileSync(resolve(__dirname, 'src/partials/header-minimal.html'), 'utf8');
            minimalHtml = minimalHtml.replace(/\{\{ROOT\}\}/g, rootPath);
            newHtml = newHtml.replace('<div id="header-placeholder"></div>', minimalHtml);
          } else {
            let headerHtml = readFileSync(resolve(__dirname, 'src/partials/header.html'), 'utf8');
            headerHtml = headerHtml.replace(/\{\{ROOT\}\}/g, rootPath).replace(/\{\{ACCOUNT_PATH\}\}/g, rootPath + 'src/pages/login.html');
            
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
