import glob, re
for path in glob.glob('frontend/src/**/*.html', recursive=True):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    matches = re.findall(r'<nav[^>]+class=\"[^\"]*bg-(?:\[#[0-9a-fA-F]+\]|gray-[0-9]+)[^\"]*\"[^>]*>', content)
    if matches:
        print(f'{path} : found {len(matches)} nav(s)')
