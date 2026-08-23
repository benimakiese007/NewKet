import os

path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\search.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

replacements = [
    (
        "const popOptions = {\n                limit: 4,\n                order: ['created_at', { ascending: false }],\n                select: 'id, name, category, price, image'\n            };\n            \n            // Apply category filter if selected\n            if (this.selectedCategory !== 'all') {\n                popOptions.eq = [['category', this.selectedCategory]];\n            }",
        "const popOptions = {\n                limit: 4,\n                order: ['created_at', { ascending: false }],\n                select: 'id, name, category, price, image',\n                eq: [['is_archived', false]]\n            };\n            \n            // Apply category filter if selected\n            if (this.selectedCategory !== 'all') {\n                popOptions.eq.push(['category', this.selectedCategory]);\n            }"
    ),
    (
        "const searchOptions = {\n                or: `name.ilike.\"%${safeQuery}%\",category.ilike.\"%${safeQuery}%\"`,\n                limit: 6,\n                select: 'id, name, category, price, image'\n            };\n\n            // Apply category filter if selected\n            if (this.selectedCategory !== 'all') {\n                searchOptions.eq = [['category', this.selectedCategory]];\n            }",
        "const searchOptions = {\n                or: `name.ilike.\"%${safeQuery}%\",category.ilike.\"%${safeQuery}%\"`,\n                limit: 6,\n                select: 'id, name, category, price, image',\n                eq: [['is_archived', false]]\n            };\n\n            // Apply category filter if selected\n            if (this.selectedCategory !== 'all') {\n                searchOptions.eq.push(['category', this.selectedCategory]);\n            }"
    )
]

for f_str, r_str in replacements:
    if f_str in content:
        content = content.replace(f_str, r_str)
        print(f"Replaced {f_str[:30]}...")
    else:
        print(f"COULD NOT FIND {f_str[:30]}...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
