import re
path = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/components-loader.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

def update_tag(match, class_to_add):
    full_tag = match.group(0)
    full_tag = re.sub(r'\bbg-(?:\[#[0-9a-fA-F]+\]|gray-[0-9]+)\b', '', full_tag)
    if class_to_add not in full_tag:
        if 'class="' in full_tag:
            full_tag = full_tag.replace('class="', f'class="{class_to_add} ')
    full_tag = re.sub(r'\s+', ' ', full_tag).replace('=" ', '="')
    return full_tag

orig_content = content
content = re.sub(r'<nav[^>]*newket-header-shell[^>]*>', lambda m: update_tag(m, 'bg-newket-header'), content)

if content != orig_content:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated components-loader.js')
else:
    print('No changes needed in components-loader.js')
