import os
import re

files_list_path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\html_files_list.txt'
with open(files_list_path, 'r', encoding='utf8') as f:
    files = f.read().splitlines()

target_script = '<script src="/src/services/components-loader.js"></script>'

count = 0
for filepath in files:
    filepath = filepath.strip().lstrip('\ufeff')
    if not filepath: continue
    try:
        with open(filepath, 'r', encoding='utf8') as f:
            content = f.read()
            
        if 'components-loader.js' in content:
            continue
            
        if '</head>' in content:
            if '<script type="module"' in content:
                pos = content.find('<script type="module"')
                if pos != -1:
                    new_content = content[:pos] + target_script + '\n    ' + content[pos:]
                    with open(filepath, 'w', encoding='utf8') as f:
                        f.write(new_content)
                    count += 1
                    continue
                    
            content = content.replace('</head>', '    ' + target_script + '\n</head>')
            with open(filepath, 'w', encoding='utf8') as f:
                f.write(content)
            count += 1
    except Exception as e:
        print(f'Error processing {filepath}: {e}'.encode('utf8', 'ignore').decode('utf8'))

print(f'Updated {count} HTML files.')
