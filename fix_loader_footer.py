import re
path = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/components-loader.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

orig_content = content
content = content.replace('<footer class="newket-footer-shell', '<footer class="bg-newket-footer newket-footer-shell')
content = content.replace('border-[#0A4A2E]', 'border-gray-800')

if content != orig_content:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated components-loader.js footer')
else:
    print('No changes needed')
