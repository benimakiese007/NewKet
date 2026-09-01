import glob, re

def update_tag(match, tag_name, class_to_add):
    full_tag = match.group(0)
    # Remove existing background classes
    full_tag = re.sub(r'\bbg-(?:\[#[0-9a-fA-F]+\]|gray-[0-9]+)\b', '', full_tag)
    # Remove style="background-color: #..."
    full_tag = re.sub(r'style=\"[^\"]*background-color:\s*#[0-9a-fA-F]+;?[^\"]*\"', '', full_tag)
    
    # Check if it already has the target class
    if class_to_add not in full_tag:
        # Add the class
        if 'class="' in full_tag:
            full_tag = full_tag.replace('class="', f'class="{class_to_add} ')
        else:
            # If no class attribute, add it after the tag name
            full_tag = full_tag.replace(f'<{tag_name}', f'<{tag_name} class="{class_to_add}"')
            
    # Clean up multiple spaces in class
    full_tag = re.sub(r'\s+', ' ', full_tag).replace('=" ', '="')
    return full_tag

changed_files = []
for path in glob.glob('frontend/src/**/*.html', recursive=True):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        orig_content = content
        
        # Process <header>
        content = re.sub(r'<header[^>]*>', lambda m: update_tag(m, 'header', 'bg-newket-header'), content)
        # Process <nav>
        content = re.sub(r'<nav[^>]*>', lambda m: update_tag(m, 'nav', 'bg-newket-header'), content)
        # Process <footer>
        content = re.sub(r'<footer[^>]*>', lambda m: update_tag(m, 'footer', 'bg-newket-footer'), content)
        
        if content != orig_content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            changed_files.append(path)
    except Exception as e:
        print(f"Error processing {path}: {e}")

print(f"Updated {len(changed_files)} files: {changed_files}")
