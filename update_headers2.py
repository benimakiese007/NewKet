import os
import re

directory = r"c:\Users\tmaut\Downloads\THE PHOENIX\NOVA V2"

replacements = [
    # Top wrapper padding for simpler pages (py-4)
    (r'<div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">',
     r'<div class="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">'),
     
    (r'<div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">',
     r'<div class="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">'),
     
    # Header gap
    (r'<div class="max-w-[1800px] mx-auto px-4 sm:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">',
     r'<div class="max-w-[1800px] mx-auto px-4 sm:px-8 py-2 flex flex-col md:flex-row justify-between items-center gap-4">'),
]

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        for old, new in replacements:
            new_content = new_content.replace(old, new)
            
        # Regex for spacer h-24 -> h-20
        new_content = re.sub(r'<div class="h-24"></div>', r'<div class="h-20"></div>', new_content)
        new_content = re.sub(r'<div class="h-32"></div>', r'<div class="h-24"></div>', new_content)
        new_content = re.sub(r'<div class="h-20"></div>', r'<div class="h-16"></div>', new_content) # Be careful, only replaces first match? No, replaces all. Actually, let's just make it h-16.
        
        # Logo height for other pages
        new_content = new_content.replace(r'<img src="Images/LOGO ENOVA.png" alt="ENova" class="h-10 w-auto invert">',
                                          r'<img src="Images/LOGO ENOVA.png" alt="ENova" class="h-8 w-auto invert">')

        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filename}")
