import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: 'localhost',
    port: 5173,
    hmr: {
      host: 'localhost',
      protocol: 'ws',
    }
  },
  root: 'src',
  envDir: '../',
  publicDir: '../public',
  // Vite va résoudre le build à la racine par défaut
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Root pages
        main: './index.html',
        catalog: './pages/catalog.html',
        product: './pages/product.html',
        publish: './pages/publish.html',
        login: './pages/login.html',
        dashboard: './pages/vendor-dashboard.html',
        customer: './pages/customer-dashboard.html',
        settings: './pages/settings.html',
        shops: './pages/shops.html',
        seller_onboarding: './pages/seller-onboarding.html',
        shop: './pages/shop.html',
        notifications: './pages/notifications.html',
        favorites: './pages/favorites.html',
        forum: './pages/forum.html',
        about: './pages/about.html',
        privacy: './pages/privacy.html',
        terms: './pages/terms.html',
        error404: './pages/404.html',
        error500: './pages/500.html',
        
        // Admin pages
        admin_dashboard: './pages/admin/dashboard.html',
        admin_clients: './pages/admin/clients.html',
        admin_client_details: './pages/admin/client-details.html',
        admin_diagnostics: './pages/admin/diagnostics.html',
        admin_livraisons: './pages/admin/livraisons.html',
        admin_notifications: './pages/admin/notifications-admin.html',
        admin_orders: './pages/admin/orders.html',
        admin_products: './pages/admin/products.html',
        admin_profits: './pages/admin/profits.html',
        admin_promos: './pages/admin/promos.html',
        admin_rapports: './pages/admin/rapports.html',
        admin_reviews: './pages/admin/reviews.html',
        admin_settings: './pages/admin/settings.html',
        admin_support: './pages/admin/support.html',
        admin_user_details: './pages/admin/user-details.html',
        admin_user_stats: './pages/admin/user-stats.html',
        admin_user: './pages/admin/user.html',
        admin_index: './pages/admin/index.html',
        admin_newsletter: './pages/admin/newsletter.html'
      }
    }
  }
});
