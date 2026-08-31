import os
import glob

def replace_in_file(path, old, new):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        if old in content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content.replace(old, new))
    except Exception as e:
        pass

for path in glob.glob('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/**/*.html', recursive=True):
    replace_in_file(path, 'content="#013220"', 'content="#1f2937"')
    replace_in_file(path, 'background-color: #013220', 'background-color: #1f2937')
    replace_in_file(path, '#013220', '#111827')

for path in glob.glob('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/**/*.css', recursive=True):
    if 'style.css' in path:
        replace_in_file(path, '--newket-footer-bg: var(--newket-green)', '--newket-footer-bg: #1f2937')
    if 'admin.css' in path:
        replace_in_file(path, 'background: #013220 !important', 'background: #1f2937 !important')
    replace_in_file(path, '#013220', '#111827')

replace_in_file('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/config-manager.js', "headerBg: '#013220'", "headerBg: '#1f2937'")
replace_in_file('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/config-manager.js', "footerBg: '#013220'", "footerBg: '#1f2937'")
replace_in_file('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/config-manager.js', "themeColor: '#064734'", "themeColor: '#1f2937'")
replace_in_file('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/config-manager.js', "headerBg = row.headerBg ?? row.header_bg;", "headerBg = row.headerBg ?? row.header_bg ?? '#1f2937';")
replace_in_file('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/config-manager.js', "footerBg = row.footerBg ?? row.footer_bg;", "footerBg = row.footerBg ?? row.footer_bg ?? '#1f2937';")
replace_in_file('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/config-manager.js', "themeColor = row.themeColor ?? row.theme_color;", "themeColor = row.themeColor ?? row.theme_color ?? '#1f2937';")
replace_in_file('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/branding-manager.js', "|| '#013220'", "|| '#1f2937'")

print('Done!')
