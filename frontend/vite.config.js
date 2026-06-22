import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const buildVersion = process.env.VERCEL_DEPLOYMENT_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || `${process.env.npm_package_version || 'local'}-${Date.now()}`;

export default defineConfig({
  plugins: [
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
        catalog: resolve(__dirname, 'src/pages/catalog.html'),
        product: resolve(__dirname, 'src/pages/product.html'),
        publish: resolve(__dirname, 'src/pages/publish.html'),
        login: resolve(__dirname, 'src/pages/login.html'),
        choose_role: resolve(__dirname, 'src/pages/choose-role.html'),
        dashboard: resolve(__dirname, 'src/pages/vendor-dashboard.html'),
        customer: resolve(__dirname, 'src/pages/customer-dashboard.html'),
        settings: resolve(__dirname, 'src/pages/settings.html'),
        shops: resolve(__dirname, 'src/pages/shops.html'),
        seller_onboarding: resolve(__dirname, 'src/pages/seller-onboarding.html'),
        shop: resolve(__dirname, 'src/pages/shop.html'),
        notifications: resolve(__dirname, 'src/pages/notifications.html'),
        favorites: resolve(__dirname, 'src/pages/favorites.html'),
        forum: resolve(__dirname, 'src/pages/forum.html'),
        about: resolve(__dirname, 'src/pages/about.html'),
        privacy: resolve(__dirname, 'src/pages/privacy.html'),
        terms: resolve(__dirname, 'src/pages/terms.html'),
        error404: resolve(__dirname, 'src/pages/404.html'),
        error500: resolve(__dirname, 'src/pages/500.html'),
        achat: resolve(__dirname, 'src/pages/achat.html'),
        faq: resolve(__dirname, 'src/pages/faq.html'),
        payment_success: resolve(__dirname, 'src/pages/payment-success.html'),
        invoice_verify: resolve(__dirname, 'src/pages/invoice-verify.html'),
        promo: resolve(__dirname, 'src/pages/promo.html'),
        support: resolve(__dirname, 'src/pages/support.html'),
        system_health: resolve(__dirname, 'src/pages/system-health.html'),
        payment_cancel: resolve(__dirname, 'src/pages/payment-cancel.html'),
        
        admin_index: resolve(__dirname, 'src/pages/admin/index.html'),
        admin_realtime: resolve(__dirname, 'src/pages/admin/realtime.html'),
        admin_analytics: resolve(__dirname, 'src/pages/admin/analytics.html'),
        admin_activities: resolve(__dirname, 'src/pages/admin/activities.html'),
        admin_diagnostics: resolve(__dirname, 'src/pages/admin/diagnostics.html'),
        admin_notifications: resolve(__dirname, 'src/pages/admin/notifications-admin.html'),
        admin_orders: resolve(__dirname, 'src/pages/admin/orders.html'),
        admin_otp_guide: resolve(__dirname, 'src/pages/admin/otp-guide.html'),
        admin_otp_tracker: resolve(__dirname, 'src/pages/admin/otp-tracker.html'),
        admin_products: resolve(__dirname, 'src/pages/admin/products.html'),
        admin_reviews: resolve(__dirname, 'src/pages/admin/reviews.html'),
        admin_branding: resolve(__dirname, 'src/pages/admin/branding.html'),
        admin_hero: resolve(__dirname, 'src/pages/admin/hero.html'),
        admin_settings: resolve(__dirname, 'src/pages/admin/settings.html'),
        admin_referrals: resolve(__dirname, 'src/pages/admin/referrals.html'),
        admin_support: resolve(__dirname, 'src/pages/admin/support.html'),
        admin_user: resolve(__dirname, 'src/pages/admin/user.html'),
        admin_user_details: resolve(__dirname, 'src/pages/admin/user-details.html'),
        admin_security: resolve(__dirname, 'src/pages/admin/security.html'),
        admin_newsletter: resolve(__dirname, 'src/pages/admin/newsletter.html'),
        admin_notion_manager: resolve(__dirname, 'src/pages/admin/notion-manager.html')
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
