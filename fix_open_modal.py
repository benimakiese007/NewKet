path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("document.getElementById('payoutStepSelfie').classList.add('hidden');\n                    document.getElementById('payoutStepDocs').classList.add('hidden');", "document.getElementById('payoutStepSecurity').classList.add('hidden');")

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
