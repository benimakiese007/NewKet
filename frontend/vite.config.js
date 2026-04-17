import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: 'localhost',
    port: 5173,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    }
  },
  root: '.',
  envDir: './',
  publicDir: './public',
  // Vite va résoudre le build à la racine par défaut
  build: {
    outDir: './dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Root pages
        main: resolve(__dirname, 'index.html'),
        catalog: resolve(__dirname, 'src/pages/catalog.html'),
        product: resolve(__dirname, 'src/pages/product.html'),
        publish: resolve(__dirname, 'src/pages/publish.html'),
        login: resolve(__dirname, 'src/pages/login.html'),
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
        
        // Admin pages
        admin_index: resolve(__dirname, 'src/pages/admin/index.html'),
        admin_diagnostics: resolve(__dirname, 'src/pages/admin/diagnostics.html'),
        admin_notifications: resolve(__dirname, 'src/pages/admin/notifications-admin.html'),
        admin_orders: resolve(__dirname, 'src/pages/admin/orders.html'),
        admin_products: resolve(__dirname, 'src/pages/admin/products.html'),
        admin_reviews: resolve(__dirname, 'src/pages/admin/reviews.html'),
        admin_settings: resolve(__dirname, 'src/pages/admin/settings.html'),
        admin_support: resolve(__dirname, 'src/pages/admin/support.html'),
        admin_user: resolve(__dirname, 'src/pages/admin/user.html'),
        admin_security: resolve(__dirname, 'src/pages/admin/security.html'),
        admin_newsletter: resolve(__dirname, 'src/pages/admin/newsletter.html')
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
