import os

problem_refs = []
canonical_refs = []
other_refs = []

for root, dirs, files in os.walk('frontend'):
    dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist', '.git')]
    for file in files:
        if not file.endswith(('.html', '.js')):
            continue
        fp = os.path.join(root, file)
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except:
            continue
        for i, line in enumerate(lines):
            if '/src/pages/' not in line:
                continue
            stripped = line.strip()
            if 'vite.config' in fp:
                continue
            if stripped.startswith('//') or stripped.startswith('*'):
                continue
            if 'canonical' in line or 'og:url' in line or '"item"' in line:
                canonical_refs.append((fp, i+1, stripped[:110]))
            elif 'placeholder=' in line:
                other_refs.append((fp, i+1, stripped[:110]))
            elif ('window.location' in line or 'href=' in line or
                  'req.url' in line or 'resolvePath' in line or 'location.href' in line):
                problem_refs.append((fp, i+1, stripped[:110]))
            else:
                other_refs.append((fp, i+1, stripped[:110]))

print(f"=== PROBLEMES DE NAVIGATION ({len(problem_refs)}) ===")
for fp, ln, txt in problem_refs:
    print(f"  {fp}:{ln}: {txt}")

print(f"\n=== BALISES CANONIQUES / SEO ({len(canonical_refs)}) ===")
for fp, ln, txt in canonical_refs:
    print(f"  {fp}:{ln}: {txt}")

print(f"\n=== AUTRES ({len(other_refs)}) ===")
for fp, ln, txt in other_refs:
    print(f"  {fp}:{ln}: {txt}")
