import os
import re

def replace_logos(directory):
    count = 0
    pattern = re.compile(
        r'(https://res\.cloudinary\.com/dzhnphyp3/image/upload/[^\s"\'\>]+/Logo_[^\s"\'\>]+|'
        r'https://res\.cloudinary\.com/dzhnphyp3/image/upload/[^\s"\'\>]+/logo-newket\.png|'
        r'/Images/Logo NewKet PNG\.png|'
        r'https://newket\.vercel\.app/Images/Logo NewKet PNG\.png)', 
        re.IGNORECASE
    )
    
    new_logo = '/icons/icon-512.png'

    for root, dirs, files in os.walk(directory):
        if 'node_modules' in root or '.git' in root or 'dist' in root:
            continue
        for file in files:
            if file.endswith(('.html', '.js', '.cjs', '.json', '.css')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if pattern.search(content):
                        new_content = pattern.sub(new_logo, content)
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f'Updated {path}')
                        count += 1
                except Exception as e:
                    pass
    print(f'Total updated: {count}')

replace_logos('.')
