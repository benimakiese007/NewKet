import re

# ---- 1. emailService.js - liens dans les emails transactionnels ----
with open('frontend/api/_backend/src/services/emailService.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '${process.env.FRONTEND_URL}/src/pages/admin/user.html',
    '${process.env.FRONTEND_URL}/admin/user'
)
content = content.replace(
    '${process.env.FRONTEND_URL}/src/pages/vendor-dashboard.html',
    '${process.env.FRONTEND_URL}/vendor-dashboard'
)

with open('frontend/api/_backend/src/services/emailService.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("emailService.js updated.")

# ---- 2. meta.routes.js - lien dans texte email ----
with open('frontend/api/_backend/src/routes/meta.routes.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'https://newket.vercel.app/src/pages/privacy.html',
    'https://newket.vercel.app/privacy'
)

with open('frontend/api/_backend/src/routes/meta.routes.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("meta.routes.js updated.")

# ---- 3. payment.controller.js - redirect après paiement ----
with open('frontend/api/_backend/src/controllers/payment.controller.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('/src/pages/payment-success.html', '/payment-success')
content = content.replace('/src/pages/payment-cancel.html', '/payment-cancel')

with open('frontend/api/_backend/src/controllers/payment.controller.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("payment.controller.js updated.")

# ---- 4. Canonical tags SEO dans les pages HTML ----
pages_canonical = {
    'frontend/src/pages/catalog.html': [
        ('https://newket.vercel.app/src/pages/catalog.html', 'https://newket.vercel.app/catalog'),
    ],
    'frontend/src/pages/product.html': [
        ('https://newket.vercel.app/src/pages/product.html', 'https://newket.vercel.app/product'),
    ],
    'frontend/src/pages/publish.html': [
        ('https://newket.cd/src/pages/publish.html', 'https://newket.cd/publish'),
    ],
    'frontend/src/pages/seller-onboarding.html': [
        ('https://newket.cd/src/pages/seller-onboarding', 'https://newket.cd/seller-onboarding'),
    ],
    'frontend/src/pages/vendor-dashboard.html': [
        ('https://newket.cd/src/pages/vendor-dashboard.html', 'https://newket.cd/vendor-dashboard'),
    ],
}

for filepath, replacements in pages_canonical.items():
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Canonical updated: {filepath}")

# ---- 5. index.html - JSON-LD search target ----
with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'https://newket.vercel.app/src/pages/catalog?q={search_term_string}',
    'https://newket.vercel.app/catalog?q={search_term_string}'
)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("index.html JSON-LD updated.")

print("\nDone! All critical /src/pages/ references cleaned up.")
