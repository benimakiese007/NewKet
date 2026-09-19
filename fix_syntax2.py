import re

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "window.filterAllProducts('')",
    "window.filterAllProducts('')"
)

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui.js', 'w', encoding='utf-8') as f:
    f.write(content)
