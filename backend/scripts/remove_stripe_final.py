import os

directory = r"c:\Users\tmaut\Downloads\THE PHOENIX\NOVA V2"

search_pattern = 'logos:stripe'

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                new_lines = [line for line in lines if search_pattern not in line]
                
                if len(new_lines) < len(lines):
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.writelines(new_lines)
                    print(f"Removed Stripe from {filepath}")
            except Exception as e:
                print(f"Error processing {filepath}: {e}")

print("Cleanup complete.")
