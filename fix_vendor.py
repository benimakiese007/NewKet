import os

path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\products.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings
content = content.replace('\r\n', '\n')

replacements = [
    (
        "if (email) {\n                    byEmail = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        order: ['created_at', { ascending: false }],\n                        eq: [['supplier_email', email]],\n                        skipCache: true,\n                        suppressErrorLogging: true\n                    });\n                }",
        "if (email) {\n                    byEmail = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        order: ['created_at', { ascending: false }],\n                        eq: [['supplier_email', email], ['is_archived', false]],\n                        skipCache: true,\n                        suppressErrorLogging: true\n                    });\n                }"
    ),
    (
        "if (userId && userId !== 'null' && userId !== 'undefined') {\n                    byUser = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        order: ['created_at', { ascending: false }],\n                        eq: [['user_id', userId]],\n                        skipCache: true,\n                        suppressErrorLogging: true\n                    });\n                }",
        "if (userId && userId !== 'null' && userId !== 'undefined') {\n                    byUser = await window.SupabaseAdapter.fetchWithFilters('products', {\n                        select: '*, users!supplier_email(company_name, name, avatar, seller_type)',\n                        order: ['created_at', { ascending: false }],\n                        eq: [['user_id', userId], ['is_archived', false]],\n                        skipCache: true,\n                        suppressErrorLogging: true\n                    });\n                }"
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
