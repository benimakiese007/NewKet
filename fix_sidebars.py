import glob
files = glob.glob('frontend/src/**/*.html', recursive=True)
for path in files:
    try:
        with open(path, 'r', encoding='utf-8') as f: content = f.read()
        orig = content
        content = content.replace('<nav class="bg-newket-header space-y-1.5"', '<nav class="space-y-1.5"')
        content = content.replace('<nav class="bg-newket-header space-y-1"', '<nav class="space-y-1"')
        content = content.replace('<nav class="bg-newket-header space-y-2"', '<nav class="space-y-2"')
        
        # also sidebar nav usually has sidebar-nav class?
        content = content.replace('bg-newket-header sidebar', 'sidebar')
        
        if orig != content:
            with open(path, 'w', encoding='utf-8') as f: f.write(content)
            print(f'Fixed sidebar nav in {path}')
    except Exception as e: pass
