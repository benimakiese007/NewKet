import os
import re

frontend_dir = 'frontend'

def replace_in_files(directory, pattern, replacement, extensions=('.html', '.js')):
    count = 0
    for root, _, files in os.walk(directory):
        if 'node_modules' in root or 'dist' in root or '.git' in root or 'scratch' in root:
            continue
        for file in files:
            if file.endswith(extensions):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content = re.sub(pattern, replacement, content)
                    
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        count += 1
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")
    print(f"Replaced {pattern} in {count} files.")

replace_in_files(frontend_dir, r'href="/src/pages/([^"\?]+)\.html([^"]*)"', r'href="/\1\2"')
replace_in_files(frontend_dir, r'href="/src/pages/([^"\?]+)([^"]*)"', r'href="/\1\2"')

replace_in_files(frontend_dir, r"'/src/pages/([^'\?]+)\.html([^']*)'", r"'/\1\2'")
replace_in_files(frontend_dir, r"'/src/pages/([^'\?]+)([^']*)'", r"'/\1\2'")

replace_in_files(frontend_dir, r"`/src/pages/([^`\?]+)\.html([^`]*)`", r"`/\1\2`")
replace_in_files(frontend_dir, r"`/src/pages/([^`\?]+)([^`]*)`", r"`/\1\2`")

# Special case for component-loader which has {{ROOT}}src/pages/...
replace_in_files(frontend_dir, r'href="{{ROOT}}src/pages/([^"\?]+)\.html([^"]*)"', r'href="{{ROOT}}\1\2"')
replace_in_files(frontend_dir, r'href="{{ROOT}}src/pages/([^"\?]+)([^"]*)"', r'href="{{ROOT}}\1\2"')

# And ui-helpers.js modifications for resolvePath
ui_helpers = os.path.join(frontend_dir, 'src', 'services', 'ui-helpers.js')
if os.path.exists(ui_helpers):
    with open(ui_helpers, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to remove the src/pages prepending in resolvePath.
    # Lines to change:
    # if (!cleanPath.startsWith('src/') && !cleanPath.startsWith('pages/')) {
    #     cleanPath = 'pages/' + cleanPath;
    # }
    # if (!cleanPath.startsWith('src/')) {
    #     cleanPath = 'src/' + cleanPath;
    # }
    
    # We just replace the entire block with nothing, so cleanPath remains what it is!
    # Wait, if we do that, cleanPath = 'catalog', it returns root + 'catalog' + query.
    # Perfect!
    pattern = r"""    if \(!cleanPath\.startsWith\('src/'\) && !cleanPath\.startsWith\('pages/'\)\) \{
        cleanPath = 'pages/' \+ cleanPath;
    \}

    if \(!cleanPath\.startsWith\('src/'\)\) \{
        cleanPath = 'src/' \+ cleanPath;
    \}"""
    
    new_content = re.sub(pattern, "", content)
    if new_content != content:
        with open(ui_helpers, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Updated ui-helpers.js resolvePath logic.")
