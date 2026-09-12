import json

path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\vercel.json'

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for header_rule in data.get('headers', []):
    for h in header_rule.get('headers', []):
        if h.get('key') == 'Permissions-Policy':
            val = h['value']
            val = val.replace('camera=()', 'camera=(self)')
            h['value'] = val

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("vercel.json updated to allow camera")
