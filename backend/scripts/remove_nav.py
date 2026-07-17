import os
import re

dir_path = r"c:\Users\tmaut\Downloads\THE PHOENIX\NewKet"

# Regex pattern to match the bottom nav block with or without comment
pattern_with_comment = re.compile(
    r'\s*<!--\s*==========\s*MOBILE BOTTOM NAV\s*==========\s*-->\s*<nav[^>]*bottom-0[^>]*>.*?</nav>\s*',
    re.DOTALL | re.IGNORECASE
)

pattern_without_comment = re.compile(
    r'\s*<nav[^>]*fixed\s+bottom-0\s+left-0[^>]*>.*?</nav>\s*',
    re.DOTALL | re.IGNORECASE
)

files_removed = []
files_no_nav = []

for root, _, files in os.walk(dir_path):
    if "node_modules" in root or ".git" in root:
        continue
    for file in files:
        if file.endswith(".html"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = pattern_with_comment.sub("\n\n", content)
            
            if new_content == content:
                new_content = pattern_without_comment.sub("\n\n", content)
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                files_removed.append(path)
            else:
                files_no_nav.append(path)

print(f"Removed nav from {len(files_removed)} files:")
for f in files_removed:
    print(f" - {f}")
print(f"Could not find nav in {len(files_no_nav)} files.")
