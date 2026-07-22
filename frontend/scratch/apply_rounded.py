import os, re, sys

def process_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return
        
    def replace_btn(match):
        btn_tag = match.group(0)
        class_match = re.search(r'class=[\"\']([^\"\']*)[\"\']', btn_tag)
        if class_match:
            classes = class_match.group(1)
            if 'rounded' not in classes:
                new_classes = classes + ' rounded-xl' if classes else 'rounded-xl'
                # Replace the exact class string inside the tag
                # Be careful not to replace other similar strings
                new_tag = btn_tag.replace(class_match.group(0), f'class="{new_classes}"')
                return new_tag
            return btn_tag
        else:
            # No class attribute, add it before >
            if btn_tag.endswith('/>'):
                return btn_tag[:-2] + ' class="rounded-xl"/>'
            else:
                return btn_tag[:-1] + ' class="rounded-xl">'
                
    new_content = re.sub(r'<button[^>]*>', replace_btn, content, flags=re.IGNORECASE)
    
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {path}")

for root, _, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or 'scratch' in root: continue
    for f in files:
        if f.endswith('.html') or f.endswith('.js'):
            path = os.path.join(root, f)
            process_file(path)
