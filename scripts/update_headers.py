import os
import re

directory = r"c:\Users\tmaut\Downloads\THE PHOENIX\NewKet"

replacements = [
    # Top wrapper padding
    (r'<div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">',
     r'<div class="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-4">'),
     
    # Logo height
    (r'<img src="Images/LOGO NEWKET.png" alt="NewKet" class="h-8 sm:h-10 w-auto invert">',
     r'<img src="Images/LOGO NEWKET.png" alt="NewKet" class="h-6 sm:h-8 w-auto invert">'),
     
    # Mobile Search padding
    (r'<div id="mobileSearchContainer" class="hidden px-4 pb-3 sm:hidden">',
     r'<div id="mobileSearchContainer" class="hidden px-4 pb-2 sm:hidden">'),
     
    (r'class="w-full py-2.5 px-3 bg-transparent text-sm outline-none placeholder-slate-400"',
     r'class="w-full py-2 px-3 bg-transparent text-sm outline-none placeholder-slate-400"'),
     
    # Spacer heights
    (r'<div class="h-16 sm:h-32 lg:h-40"></div>',
     r'<div class="h-14 sm:h-24 lg:h-28"></div>'),
    (r'<div class="h-16 sm:h-32 lg:h-36"></div>',
     r'<div class="h-14 sm:h-24 lg:h-28"></div>')
]

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        for old, new in replacements:
            new_content = new_content.replace(old, new)
            
        # Regex for search input
        new_content = re.sub(r'class="w-full py-3 px-3 bg-transparent text-sm outline-none placeholder-slate-400 font-medium([^"]*)"', 
                             r'class="w-full py-2 px-3 bg-transparent text-sm outline-none placeholder-slate-400 font-medium\1"', new_content)
                             
        # Regex for search button
        new_content = re.sub(r'class="bg-slate-900 text-white px-6 py-2\.5 m-1 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all uppercase tracking-wider"',
                             r'class="bg-slate-900 text-white px-5 py-2 m-1 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all uppercase tracking-wider"', new_content)
                             
        # Category nav index
        new_content = new_content.replace(r'<nav class="flex items-center gap-1 overflow-x-auto py-2 -mx-2" style="scrollbar-width:none;">',
                                          r'<nav class="flex items-center gap-1 overflow-x-auto py-1 -mx-2" style="scrollbar-width:none;">')
        # Category nav catalog
        new_content = new_content.replace(r'<div class="flex items-center gap-8 overflow-x-auto no-scrollbar py-3">',
                                          r'<div class="flex items-center gap-8 overflow-x-auto no-scrollbar py-2">')

        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filename}")
