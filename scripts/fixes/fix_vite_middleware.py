"""Fix the broken vite.config.js middleware by rewriting lines 140-192 cleanly."""

with open('frontend/vite.config.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines 140-192 (0-indexed: 139-191) need to be replaced
# The current plugin block (lines 136-192, 0-indexed 135-191) is broken
# We'll rebuild it cleanly

new_plugin = '''    {
      name: 'newket-pretty-url-rewrites',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          try {
            const originalUrl = req.url || '';
            const legacyProduct = originalUrl.match(/^\\/boutique\\/[^/?#]+\\/produit\\/([^/?#]+)\\/?(?:\\?.*)?$/i);
            const prettyProduct = originalUrl.match(/^\\/boutique\\/[^/?#]+\\/([^/?#]+)\\/(?:[0-9]{1,3})\\/newket\\/?(?:\\?.*)?$/i);
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

            const m = originalUrl.match(/^\\/boutique\\/([^/?#]+)(?:\\/NewKet)?\\/?(?:\\?.*)?$/i);
            if (m) {
              const slug = m[1];
              const url = new URL(originalUrl, 'http://localhost');
              url.searchParams.set('shop', slug);
              req.url = `/src/pages/shop.html?${url.searchParams.toString()}`;
              return next();
            }

            // /facture/:orderId \u2192 invoice-verify
            const factureMatch = originalUrl.match(/^\\/facture\\/([^/?#]+)(?:\\?.*)?$/i);
            if (factureMatch) {
              const url = new URL(originalUrl, 'http://localhost');
              url.searchParams.set('order_id', factureMatch[1]);
              req.url = `/src/pages/invoice-verify.html?${url.searchParams.toString()}`;
              return next();
            }

            // Pretty URL dev rewrites: /catalog \u2192 /src/pages/catalog.html
            // Only single-segment paths with no dots (to exclude assets & HMR URLs)
            const rootPages = ['catalog', 'login', 'product', 'shop', 'favorites', 'shops', 'support', 'faq', 'seller-onboarding', 'vendor-dashboard', 'customer-dashboard', 'publish', 'reset-password', 'achat', 'promo', 'settings', 'terms', 'privacy', 'mentions-legales', 'system-health', 'payment-success', 'payment-cancel', 'invoice-verify', 'about', 'seller', '404', '500'];
            const simplePage = originalUrl.match(/^\\/([^/?#.@]+)(?:\\.html)?(\\?.*)?$/i);
            if (simplePage && rootPages.includes(simplePage[1])) {
              req.url = `/src/pages/${simplePage[1]}.html${simplePage[2] || ''}`;
              return next();
            }

            // /admin/xxx \u2192 /src/pages/admin/xxx.html
            if (originalUrl.startsWith('/admin/')) {
              const url = new URL(originalUrl, 'http://localhost');
              let pathname = url.pathname;
              if (!pathname.includes('.')) pathname += '.html';
              req.url = `/src/pages${pathname}${url.search}`;
              return next();
            }
          } catch {
          }
          next();
        });
      }
    }\n'''

# Find the line with 'newket-pretty-url-rewrites' and 'name:' to find start
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if "name: 'newket-pretty-url-rewrites'" in line:
        # Find the line with the opening { above it
        start_idx = i - 1  # the { line
    if start_idx is not None and i > start_idx and line.strip() == '}' and i < start_idx + 70:
        # Check that the next non-empty line is '],' (end of plugins array)
        for j in range(i+1, min(i+5, len(lines))):
            if lines[j].strip():
                if lines[j].strip() == '],' or lines[j].strip().startswith('server:') or lines[j].strip().startswith('],'):
                    end_idx = i
                    break
        if end_idx is not None:
            break

print(f"start_idx={start_idx}, end_idx={end_idx}")
print(f"start line: {lines[start_idx].rstrip()}")
print(f"end line:   {lines[end_idx].rstrip()}")

# Replace those lines with the new plugin block
new_lines = lines[:start_idx] + [new_plugin] + lines[end_idx+1:]

with open('frontend/vite.config.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done. vite.config.js updated.")
