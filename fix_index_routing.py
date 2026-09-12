path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\admin\index.html'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add payout-security to the viewSources map
old_view_sources = "                payouts: '/src/pages/admin/payouts.html?embedded=1',\n                'dispute-details': '/src/pages/admin/dispute-details.html?embedded=1'"
new_view_sources = "                payouts: '/src/pages/admin/payouts.html?embedded=1',\n                'payout-security': '/src/pages/admin/payout-security.html?embedded=1',\n                'dispute-details': '/src/pages/admin/dispute-details.html?embedded=1'"
c = c.replace(old_view_sources, new_view_sources)

# 2. Add the title for payout-security
old_title = "                payouts: 'Payouts Vendeurs | NewKet Admin',"
if old_title in c:
    c = c.replace(old_title, old_title + "\n                    'payout-security': 'Sécurité Payouts | NewKet Admin',")

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Done:", "'payout-security'" in c)
