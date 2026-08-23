import os

path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\products.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings
content = content.replace('\r\n', '\n')

replacements = [
    (
        "_handleUpdatedProductRealtime(rawProduct) {\n        const updated = this._mapProduct(rawProduct);",
        "_handleUpdatedProductRealtime(rawProduct) {\n        if (rawProduct.is_archived) {\n            this.products = this.products.filter(p => p.id !== rawProduct.id);\n            this._totalCount = Math.max(0, this._totalCount - 1);\n            window.dispatchEvent(new CustomEvent('productsUpdated'));\n            return;\n        }\n        const updated = this._mapProduct(rawProduct);"
    ),
    (
        "const fetchedProducts = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        order: ['created_at', { ascending: false }],\n                        limit: PRODUCTS_PAGE_SIZE\n                    });",
        "const fetchedProducts = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        eq: [['is_archived', false]],\n                        order: ['created_at', { ascending: false }],\n                        limit: PRODUCTS_PAGE_SIZE\n                    });"
    ),
    (
        "const fetchedProducts = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*',\n                        order: ['created_at', { ascending: false }],\n                        limit: PRODUCTS_PAGE_SIZE\n                    });",
        "const fetchedProducts = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*',\n                        eq: [['is_archived', false]],\n                        order: ['created_at', { ascending: false }],\n                        limit: PRODUCTS_PAGE_SIZE\n                    });"
    ),
    (
        "const pinned = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        order: ['created_at', { ascending: false }],\n                        eq: [['pinned', true]]\n                    });",
        "const pinned = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        order: ['created_at', { ascending: false }],\n                        eq: [['pinned', true], ['is_archived', false]]\n                    });"
    ),
    (
        "newProducts = await window.SupabaseAdapter.fetchWithFilters('products', {\n                    select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                    order: ['created_at', { ascending: false }],\n                    range: [offset, offset + PRODUCTS_PAGE_SIZE - 1]\n                });",
        "newProducts = await window.SupabaseAdapter.fetchWithFilters('products', {\n                    select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                    eq: [['is_archived', false]],\n                    order: ['created_at', { ascending: false }],\n                    range: [offset, offset + PRODUCTS_PAGE_SIZE - 1]\n                });"
    ),
    (
        "const probe = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: 'id',\n                        order: ['created_at', { ascending: false }],\n                        range: [offset + PRODUCTS_PAGE_SIZE, offset + PRODUCTS_PAGE_SIZE]\n                    });",
        "const probe = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: 'id',\n                        eq: [['is_archived', false]],\n                        order: ['created_at', { ascending: false }],\n                        range: [offset + PRODUCTS_PAGE_SIZE, offset + PRODUCTS_PAGE_SIZE]\n                    });"
    )
]

for find_str, replace_str in replacements:
    if find_str in content:
        content = content.replace(find_str, replace_str)
        print(f"Replaced {find_str[:40]}...")
    else:
        print(f"COULD NOT FIND {find_str[:40]}...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
