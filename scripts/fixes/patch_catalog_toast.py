import re

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/pages/catalog.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = r"navigator\.clipboard\.writeText\(productUrl\)\.then\(\(\) => \{\s*if \(window\.showToast\) \{\s*showToast\('Lien copiǸ dans le presse-papier !', 'success'\);\s*\}\s*\}\);"
target_clean = r"navigator\.clipboard\.writeText\(productUrl\)\.then\(\(\) => \{\s*if \(window\.showToast\) \{\s*showToast\('Lien copi. dans le presse-papier !', 'success'\);\s*\}\s*\}\);"

replacement = "window.copyAndAnimateButton(event, productUrl);"

content = re.sub(target_clean, replacement, content)

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/pages/catalog.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("catalog.html copy toast fixed!")
