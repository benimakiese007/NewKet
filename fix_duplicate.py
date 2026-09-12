path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Total length: {len(content)}")

# Find </html> tags - there should only be one at the very end
import re
html_ends = [m.start() for m in re.finditer(r'</html>', content)]
print(f"Found </html> at positions: {html_ends}")

# Find where the first script block after the duplicate starts
# The original file should end with the first </html>
if len(html_ends) > 1:
    first_end = html_ends[0] + len('</html>')
    print(f"Will truncate at position {first_end}")
    content_fixed = content[:first_end]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_fixed)
    
    # Count lines in fixed
    print(f"Fixed file: {content_fixed.count(chr(10))} lines")
else:
    print("Only one </html> found - no duplicate detected")
