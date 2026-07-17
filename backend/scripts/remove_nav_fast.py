import os

dir_path = r"c:\Users\tmaut\Downloads\THE PHOENIX\NewKet"

files_removed = []
files_no_nav = []

for root, _, files in os.walk(dir_path):
    if "node_modules" in root or ".git" in root:
        continue
    for file in files:
        if file.endswith(".html"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content: str = f.read()

            new_content: str = content
            
            # Find the starting index of the comment
            start_idx = new_content.find("<!-- ========== MOBILE BOTTOM NAV ========== -->")
            if start_idx != -1:
                end_idx = new_content.find("</nav>", start_idx)
                if end_idx != -1:
                    new_content = new_content[:start_idx] + new_content[end_idx + 6:]
            else:
                nav_sig = 'class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between sm:hidden'
                start_idx = new_content.find(nav_sig)
                if start_idx != -1:
                    nav_start = new_content.rfind("<nav", 0, start_idx)
                    if nav_start != -1:
                        end_idx = new_content.find("</nav>", start_idx)
                        if end_idx != -1:
                            new_content = new_content[:nav_start] + new_content[end_idx + 6:]
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                files_removed.append(path)
            else:
                files_no_nav.append(path)

print(f"Removed nav from {len(files_removed)} files.")
