import json
import re

# 1. Update vercel.json
with open('vercel.json', 'r', encoding='utf-8') as f:
    vercel = json.load(f)

# The pages that exist in src/pages/
pages = ['catalog', 'login', 'product', 'shop', 'favorites', 'shops', 'support', 'faq', 'seller-onboarding', 'vendor-dashboard', 'customer-dashboard', 'publish', 'reset-password', 'achat', 'promo', 'settings', 'terms', 'privacy', 'mentions-legales', 'system-health', 'payment-success', 'payment-cancel', 'invoice-verify', 'about', 'seller', '404', '500']

new_rewrites = []
new_rewrites.append({
    "source": "/(" + "|".join(pages) + ")(?:\\.html)?",
    "destination": "/src/pages/$1.html"
})
new_rewrites.append({
    "source": "/admin/(.*)",
    "destination": "/src/pages/admin/$1"
})

# Add them to the top of rewrites
if 'rewrites' in vercel:
    # Remove existing ones if we run this twice
    vercel['rewrites'] = [r for r in vercel['rewrites'] if 'catalog' not in r.get('source', '') and '/admin/' not in r.get('source', '')]
    vercel['rewrites'] = new_rewrites + vercel['rewrites']

with open('vercel.json', 'w', encoding='utf-8') as f:
    json.dump(vercel, f, indent=2)

# 2. Update vite.config.js
with open('frontend/vite.config.js', 'r', encoding='utf-8') as f:
    vite = f.read()

# I need to add the middleware for the root pages.
middleware_code = """
            const rootPages = ['catalog', 'login', 'product', 'shop', 'favorites', 'shops', 'support', 'faq', 'seller-onboarding', 'vendor-dashboard', 'customer-dashboard', 'publish', 'reset-password', 'achat', 'promo', 'settings', 'terms', 'privacy', 'mentions-legales', 'system-health', 'payment-success', 'payment-cancel', 'invoice-verify', 'about', 'seller', '404', '500'];
            const simplePage = originalUrl.match(/^\\/([^/?#]+)(?:\\.html)?(?:\\?.*)?$/i);
            if (simplePage && rootPages.includes(simplePage[1])) {
              const url = new URL(originalUrl, 'http://localhost');
              req.url = `/src/pages/${simplePage[1]}.html${url.search}`;
              return next();
            }
            if (originalUrl.startsWith('/admin/')) {
              const url = new URL(originalUrl, 'http://localhost');
              let path = url.pathname;
              if (!path.endswith('.html')) path += '.html';
              req.url = `/src/pages${path}${url.search}`;
              return next();
            }
"""

if "const rootPages" not in vite:
    vite = vite.replace("next();\n        });", middleware_code + "            next();\n        });")
    with open('frontend/vite.config.js', 'w', encoding='utf-8') as f:
        f.write(vite)

print("Updated vercel.json and vite.config.js")
