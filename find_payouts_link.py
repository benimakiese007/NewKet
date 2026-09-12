with open(r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\admin-layout.js', 'r', encoding='utf-8') as f:
    c = f.read()

idx = c.find("getShellHref('payouts')")
print(c[max(0,idx-300):idx+600])
