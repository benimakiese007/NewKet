import os
import re
import glob

html_files = glob.glob('*.html')

def fix_table_responsiveness(file):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Clean up the corrupted headers:
    # <table class="min-w-[800px] w-full text-left border-collapse">
    # <th class="whitespace-nowrap"ead>
    
    # We first fix the `ead>` corruption which happened to `<thead>`
    content = content.replace('<th class="whitespace-nowrap"ead>', '<thead>')
    
    # We remove duplicate class attributes that were injected, e.g. <th class="whitespace-nowrap" class="...">
    # and consolidate them.
    # We'll just carefully remove `<th class="whitespace-nowrap"` and clean up duplicate classes.
    
    # Let's revert the messy `th` modifications. The easiest way is to remove `<th class="whitespace-nowrap"` 
    # and `class="whitespace-nowrap ` if they were added incorrectly.
    content = content.replace('<th class="whitespace-nowrap" class="whitespace-nowrap', '<th class="whitespace-nowrap')
    content = content.replace('<th class="whitespace-nowrap"\n                                    class="', '<th class="whitespace-nowrap ')
    content = content.replace('<th class="whitespace-nowrap"\nclass="', '<th class="whitespace-nowrap ')
    
    # Clean up double classes like `class="whitespace-nowrap" class="p-4..."` 
    content = re.sub(r'<th class="whitespace-nowrap"\s+class="([^"]+)"', r'<th class="\1 whitespace-nowrap"', content)

    # Clean up cases where `whitespace-nowrap` was added twice
    content = content.replace('whitespace-nowrap whitespace-nowrap', 'whitespace-nowrap')

    if content != content: # dummy check because replacing strings directly updates content
        pass
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed tables in {file}")

for file in html_files:
    if file in ['diagnostic_logo.html', '404.html']: continue
    fix_table_responsiveness(file)

print("Table fix complete!")
