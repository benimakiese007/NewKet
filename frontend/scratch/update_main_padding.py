import os
import re

directory = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend'
html_files = []

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.html'):
            html_files.append(os.path.join(root, file))

def update_class_attr(match):
    prefix = match.group(1)
    class_str = match.group(2)
    suffix = match.group(3)
    
    # Remove existing pt-* classes
    class_str = re.sub(r'\b(sm:|md:|lg:|xl:|2xl:)?pt-\d+\b', '', class_str)
    
    # Clean up multiple spaces
    class_str = re.sub(r'\s+', ' ', class_str).strip()
    
    # Add new padding classes
    new_classes = "pt-24 sm:pt-28 lg:pt-32"
    if class_str:
        class_str = f"{class_str} {new_classes}"
    else:
        class_str = new_classes
        
    return f'{prefix}class="{class_str}"{suffix}'

def update_main_tag(match):
    main_tag = match.group(0)
    
    if 'class="' in main_tag:
        # Update existing class attribute
        new_main_tag = re.sub(r'(<main\b[^>]*?)class="([^"]*)"([^>]*>)', update_class_attr, main_tag)
    else:
        # Add class attribute
        new_main_tag = re.sub(r'(<main\b[^>]*)>', r'\1 class="pt-24 sm:pt-28 lg:pt-32">', main_tag)
        
    return new_main_tag

modified_count = 0

for file_path in html_files:
    if 'node_modules' in file_path or 'dist' in file_path:
        continue
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = re.sub(r'<main\b[^>]*>', update_main_tag, content)
        
        if content != new_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            modified_count += 1
            print(f"Updated: {file_path}")
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

print(f"\nTotal files updated: {modified_count}")
