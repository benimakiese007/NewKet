import os
import re

directory = r"c:\Users\tmaut\Downloads\THE PHOENIX\NewKet"

# New Logo Designs
header_logo_replacement = '''<a href="index.html" class="flex-shrink-0 flex items-center gap-3">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                        <iconify-icon icon="solar:star-bold" width="22" class="text-white"></iconify-icon>
                    </div>
                    <span class="text-xl font-bold tracking-tighter text-gray-900">NEWKET</span>
                </a>'''

footer_logo_replacement = '''<div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                            <iconify-icon icon="solar:star-bold" width="24" class="text-gray-900"></iconify-icon>
                        </div>
                        <span class="text-xl font-bold tracking-tight">NEWKET</span>
                    </div>'''

mobile_menu_logo_replacement = '''<div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                    <iconify-icon icon="solar:star-bold" width="24" class="text-white"></iconify-icon>
                </div>
                <span class="text-xl font-bold tracking-tighter text-gray-900">NEWKET</span>
            </div>'''

admin_logo_replacement = '''<a href="dashboard.html" class="flex items-center gap-3">
                <div class="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                    <iconify-icon icon="solar:star-bold" width="24" class="text-white"></iconify-icon>
                </div>
                <span class="text-xl font-bold tracking-tighter text-gray-900">NEWKET</span>
                <span class="px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded-full uppercase tracking-widest">Admin</span>
            </a>'''

# Favicon SVG base64 for a star
favicon_tag = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'><path fill=\'%23000\' d=\'m12 17.27l4.15 2.51c.76.46 1.69-.22 1.49-1.08l-1.1-4.72l3.67-3.18c.67-.58.31-1.68-.57-1.75l-4.83-.41l-1.89-4.46c-.34-.81-1.5-.81-1.84 0L9.19 8.63l-4.83.41c-.88.07-1.24 1.17-.57 1.75l3.67 3.18l-1.1 4.72c-.2.86.73 1.54 1.49 1.08l4.15-2.51Z\'/></svg>">'

def process_file(filepath, is_admin=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content

    # 1. Add Favicon if not present
    if 'rel="icon"' not in new_content:
        new_content = new_content.replace('</head>', f'    {favicon_tag}\n</head>')

    # 2. Replace Header Logo
    # Match both standard and previously inverted/scaled images
    header_regex = r'<a href="index\.html" class="flex-shrink-0 flex items-center gap-[^"]*">.*?<img src="(?:\.\./)?Images/LOGO NEWKET\.png"[^>]*>.*?</a>'
    new_content = re.sub(header_regex, header_logo_replacement, new_content, flags=re.DOTALL)

    # 3. Replace Footer Logo
    footer_regex = r'<div class="flex items-center gap-3">\s*<img src="(?:\.\./)?Images/LOGO NEWKET\.png"[^>]*>\s*<span class="text-xl font-bold tracking-tight">NEWKET</span>\s*</div>'
    new_content = re.sub(footer_regex, footer_logo_replacement, new_content, flags=re.DOTALL)

    # 4. Replace Mobile Menu Logo
    mobile_regex = r'<img src="(?:\.\./)?Images/LOGO NEWKET\.png" alt="NewKet" class="h-8 w-auto invert">'
    # If it's in the mobile menu div
    new_content = new_content.replace(mobile_regex, mobile_menu_logo_replacement)

    # 5. Admin Header Logo
    if is_admin:
        admin_header_regex = r'<a href="dashboard\.html" class="flex items-center gap-2">.*?<img src="\.\./Images/LOGO NEWKET\.png"[^>]*>.*?<span[^>]*>Admin</span>.*?</a>'
        new_content = re.sub(admin_header_regex, admin_logo_replacement, new_content, flags=re.DOTALL | re.IGNORECASE)

    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

# Scan root directory
for filename in os.listdir(directory):
    if filename.endswith(".html"):
        if process_file(os.path.join(directory, filename)):
            print(f"Updated {filename}")

    # Scan admin directory
    admin_dir = os.path.join(directory, "admin")
if os.path.exists(admin_dir):
    for filename in os.listdir(admin_dir):
        if filename.endswith(".html"):
            if process_file(os.path.join(admin_dir, filename), is_admin=True):
                print(f"Updated Admin {filename}")

print("Logo and Favicon update complete.")
