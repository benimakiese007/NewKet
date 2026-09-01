path = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/public/js/cart.js'
with open(path, 'r', encoding='utf-8') as f: content = f.read()
import re
content = re.sub(r'class="px-6 py-5 flex items-center justify-between shrink-0" style="background:#1f2937; border-bottom:[^"]+"', 'class="px-6 py-5 flex items-center justify-between shrink-0 bg-newket-header" style="border-bottom:1px solid rgba(255,255,255,0.1);"', content)
with open(path, 'w', encoding='utf-8') as f: f.write(content)
