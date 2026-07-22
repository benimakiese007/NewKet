import os, re
results = []
for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root: continue
    for f in files:
        if f.endswith('.html') or f.endswith('.js'):
            path = os.path.join(root, f)
            try:
                content = open(path, 'r', encoding='utf-8').read()
            except:
                continue
            buttons = re.findall(r'<button[^>]*>.*?<\/button>', content, re.IGNORECASE | re.DOTALL)
            for b in buttons:
                class_match = re.search(r'class=[\"\']([^\"\']+)[\"\']', b)
                if class_match:
                    classes = class_match.group(1)
                    if 'rounded' not in classes:
                        clean_btn = re.sub(r'\s+', ' ', b[:200])
                        results.append(f'{f}: {clean_btn}')
for r in set(results):
    print(r)
