import os

target_string = '<script src="/src/services/components-loader.js"></script>'
frontend_dir = r"C:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend"

count = 0
for root, dirs, files in os.walk(frontend_dir):
    if "node_modules" in root:
        continue
    for f in files:
        if f.endswith(".html"):
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf8") as file:
                content = file.read()
            if target_string in content:
                # On essaie d'enlever aussi les sauts de ligne ajoutés
                new_content = content.replace(target_string + "\n    ", "").replace(target_string, "")
                with open(path, "w", encoding="utf8") as file:
                    file.write(new_content)
                count += 1
                print(f"Fixed {f}")
print(f"Fixed {count} files total")
