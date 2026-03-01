import os
import re
import glob

html_files = glob.glob('*.html')

def enhance_table_responsiveness(file):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update <table> tags
    # We want to change <table class="w-full text-left..."> to include min-w-[800px] or min-w-[600px]
    # To be safe, we'll look for `<table class="` and add `min-w-[800px] ` if not present
    
    def repl_table(match):
        classes = match.group(1)
        if 'min-w-' not in classes:
            classes = 'min-w-[800px] ' + classes
        return f'<table class="{classes}"'
    
    # We need to make sure we don't break non-data tables, but in this admin context, 
    # all tables are data tables taking full width inside an overflow container.
    new_content = re.sub(r'<table class="([^"]*)"', repl_table, content)

    # 2. Update <th> tags
    # Add whitespace-nowrap to all <th> to prevent header stacking
    def repl_th(match):
        classes = match.group(1) or ""
        if 'whitespace-nowrap' not in classes:
            classes = 'whitespace-nowrap ' + classes
        return f'<th class="{classes}"'
    
    # Handle cases where th has class="" or no class
    # Replace <th class="...">
    new_content = re.sub(r'<th class="([^"]*)"', repl_th, new_content)
    
    # Handle <th ...> without class attribute
    new_content = re.sub(r'<th(\s*(?!class=)[^>]*)>', r'<th class="whitespace-nowrap"\1>', new_content)

    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Enhanced tables in {file}")

for file in html_files:
    if file in ['diagnostic_logo.html', '404.html']: continue
    enhance_table_responsiveness(file)

print("Table responsiveness enhancement complete!")
