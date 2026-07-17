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
            try:
                with open(path, "r", encoding="utf8") as file:
                    content = file.read()
            except UnicodeDecodeError:
                with open(path, "r", encoding="latin-1") as file:
                    content = file.read()
            if target_string in content:
                new_content = content.replace(target_string + "\n    ", "").replace(target_string, "")
                # Save using the same encoding
                try:
                    with open(path, "w", encoding="utf8") as file:
                        file.write(new_content)
                except UnicodeEncodeError:
                    pass
                count += 1
                print(f"Fixed {path}")
print(f"Fixed {count} files total")
