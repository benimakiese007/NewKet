import os
import re

directory = r"c:\Users\tmaut\Downloads\THE PHOENIX\NOVA V2"
index_path = os.path.join(directory, 'index.html')

with open(index_path, 'r', encoding='utf-8') as f:
    index_content = f.read()

# Extract the footer from index.html
# Find <!-- ========== FOOTER ========== --> up to </footer>
footer_match = re.search(r'(?s)<!-- ========== FOOTER ========== -->\s*<footer.*?</footer>', index_content)
if not footer_match:
    print("Could not find footer in index.html")
    exit(1)

master_footer = footer_match.group(0)

# Files to skip (Admin files have a different structure usually, but let's check root first)
skip_files = ['index.html', '404.html', 'diagnostic_logo.html']

for filename in os.listdir(directory):
    if filename.endswith(".html") and filename not in skip_files:
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Try to find existing footer in the file
        # It might have the exact comment or just <footer
        file_footer_match = re.search(r'(?s)(?:<!-- ========== FOOTER ========== -->\s*)?<footer.*?</footer>', content)
        
        if file_footer_match:
            existing_footer = file_footer_match.group(0)
            if existing_footer != master_footer:
                print(f"Updating footer in {filename}...")
                new_content = content[:file_footer_match.start()] + master_footer + content[file_footer_match.end():]
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
            else:
                pass # Already identical
        else:
            print(f"Warning: No footer found in {filename}")

# Note: For pages in ADMIN NOVA, they might not use this same footer or might use it. 
# They have a different structure without a main footer usually. Let's list files updated.
print("Finished checking and unifying footers in the root directory.")
