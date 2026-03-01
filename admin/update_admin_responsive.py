import os
import re
import glob

html_files = glob.glob('*.html')

# 1. Navbar Mobile Button Template
nav_button = """
                <!-- Mobile Menu Button -->
                <button id="adminMobileMenuBtn" class="md:hidden p-2 text-gray-500 hover:text-black focus:outline-none flex items-center justify-center">
                    <iconify-icon icon="solar:hamburger-menu-bold" width="24"></iconify-icon>
                </button>
"""

# 2. Sidebar Update Logic
# We want to transform:
# <aside class="w-full md:w-64 flex-shrink-0">
#     <div class="glass-panel p-6 sticky top-24">
# into something responsive.

overlay = '<div id="adminOverlay" class="fixed inset-0 bg-black/50 z-[55] hidden"></div>'

for file in html_files:
    if file in ['diagnostic_logo.html', '404.html']:
        continue
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already updated
    if 'id="adminMobileMenuBtn"' in content:
        print(f"Skipping {file} - Already responsive")
        continue

    # Insert Navbar Button
    # Look for the first flex items-center gap-4 in the nav
    nav_pattern = r'(<div class="flex items-center gap-4">)(\s+<a href="dashboard.html")'
    content = re.sub(nav_pattern, r'\1' + nav_button + r'\2', content)

    # Insert Overlay and Update Sidebar
    # We look for the main container starting tag and the aside
    aside_pattern = r'(<aside class="w-full md:w-64 flex-shrink-0">)(\s+<div class="glass-panel p-6 sticky top-24">)'
    
    new_aside = r'<!-- Sidebar Overlay -->\n        ' + overlay + r'\n\n        <!-- Sidebar -->\n        <aside id="adminSidebar" class="fixed inset-y-0 left-0 w-64 bg-white z-[60] transform -translate-x-full md:translate-x-0 md:static md:w-64 transition-transform duration-300 ease-in-out h-screen md:h-auto overflow-y-auto border-r md:border-none border-gray-100 flex-shrink-0">\n            <div class="p-6 md:p-0 md:sticky md:top-24">'
    
    # We replace the aside and the glass-panel div. 
    # Note: we are removing 'glass-panel' on mobile sidebar container to avoid double borders, 
    # but keeping it in the original structure might be better.
    # Let's keep it but adjust padding.
    
    content = re.sub(aside_pattern, new_aside, content)

    # Since we added a new div at the start of aside, we need to balance the closing tags if needed.
    # The original was:
    # <aside ...>
    #   <div class="glass-panel ...">
    #     <nav>...</nav>
    #   </div>
    # </aside>
    # Our new one:
    # <aside ...>
    #   <div class="...">
    #     <nav>...</nav>
    #   </div>
    # </aside>
    # We replaced 2 opening tags with 2 opening tags. So closing tags should be fine if we keep the structure.

    if content != content: # This is a dummy check, content changed in re.sub
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
    else:
        # Re-save because content WAS modified by re.sub (unless re.sub didn't find matches)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Processed {file}")

print("Done!")
