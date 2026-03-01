import os
import re
import glob

html_files = glob.glob('*.html')

overlay = '<div id="adminOverlay" class="fixed inset-0 bg-black/50 z-[55] hidden"></div>'
nav_button = """
                <!-- Mobile Menu Button -->
                <button id="adminMobileMenuBtn" class="md:hidden p-2 text-gray-500 hover:text-black focus:outline-none flex items-center justify-center">
                    <iconify-icon icon="solar:hamburger-menu-bold" width="24"></iconify-icon>
                </button>
"""

def clean_and_fix_file(file):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Navbar: Clean and Insert Button
    # Remove ALL existing variants to be safe
    content = re.sub(r'<!-- Mobile Menu Button -->.*?id="adminMobileMenuBtn".*?</button>', '', content, flags=re.DOTALL)
    nav_pattern = r'(<div class="flex items-center gap-4">)(\s+<a href="dashboard.html")'
    content = re.sub(nav_pattern, r'\1' + nav_button + r'\2', content)

    # 2. Sidebar: Clean and Apply correct responsive structure
    nav_match = re.search(r'<nav class="space-y-1">.*?</nav>', content, re.DOTALL)
    if not nav_match: return

    current_nav = nav_match.group(0)
    
    new_aside_block = f"""<!-- Sidebar -->
        <!-- Sidebar Overlay -->
        {overlay}

        <aside id="adminSidebar" class="fixed inset-y-0 left-0 w-64 bg-white z-[60] transform -translate-x-full md:translate-x-0 md:static md:w-64 transition-transform duration-300 ease-in-out h-screen md:h-auto overflow-y-auto border-r md:border-none border-gray-100 flex-shrink-0">
            <div class="p-6 md:p-0 md:sticky md:top-24">
                <div class="md:glass-panel md:p-6">
                    {current_nav}
                </div>
            </div>
        </aside>"""

    # VERY AGGRESSIVE search for anything that looks like our sidebar block
    # Matches from <!-- Sidebar --> to </aside> including duplicate overlays
    aggressive_sidebar_regex = re.compile(r'(<!-- Sidebar -->\s+)?(<!-- Sidebar Overlay -->.*?</div>\s+)?(<!-- Sidebar -->\s+)?(<!-- Sidebar Overlay -->.*?</div>\s+)?(<!-- Sidebar -->\s+)?(<aside id="adminSidebar"|<aside class="w-full md:w-64).*?</aside>', re.DOTALL)
    
    new_content = aggressive_sidebar_regex.sub(new_aside_block, content)

    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Cleaned {file}")

for file in html_files:
    if file in ['diagnostic_logo.html', '404.html']: continue
    clean_and_fix_file(file)

print("Cleanup complete!")
