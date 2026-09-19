import re

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'if (grid) grid.innerHTML = <div',
    'if (grid) grid.innerHTML = <div'
)
content = content.replace(
    'mt-2">Réessayer</button></div>;',
    'mt-2">Réessayer</button></div>;'
)

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui.js', 'w', encoding='utf-8') as f:
    f.write(content)
