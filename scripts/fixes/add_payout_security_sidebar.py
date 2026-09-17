layout_path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\services\admin-layout.js'

with open(layout_path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add 'payout-security' to shellViewMap
old_map = "        payouts: 'payouts'\n    },"
new_map = "        payouts: 'payouts',\n        'payout-security': 'payout-security'\n    },"
c = c.replace(old_map, new_map)

# 2. Add sidebar link after the payouts link
old_link = "            { href: this.getShellHref('payouts'), icon: 'solar:wallet-money-bold', label: 'Payouts Vendeurs', view: 'payouts', section: 'Opérations' },"
new_link = """            { href: this.getShellHref('payouts'), icon: 'solar:wallet-money-bold', label: 'Payouts Vendeurs', view: 'payouts', section: 'Opérations' },
            { href: this.getShellHref('payout-security'), icon: 'solar:shield-check-bold', label: 'Sécurité Payouts', view: 'payout-security', section: 'Opérations' },"""
c = c.replace(old_link, new_link)

with open(layout_path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Done:", "payout-security in map:", "'payout-security'" in c, "| link added:", "Sécurité Payouts" in c)
