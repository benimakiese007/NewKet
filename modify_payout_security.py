path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\admin\payout-security.html'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Change title
c = c.replace('<title>Support & Tickets | NewKet Admin</title>', '<title>Sécurité Payouts | NewKet Admin</title>')

# 2. Change Header title
c = c.replace('<h1 class="admin-page-title text-4xl font-black tracking-tight text-gray-900">Support Utilisateur</h1>', '<h1 class="admin-page-title text-4xl font-black tracking-tight text-gray-900">Sécurité Payouts</h1>')
c = c.replace('<p class="text-gray-500 font-medium">Gérez les demandes de support clients et vendeurs.</p>', '<p class="text-gray-500 font-medium">Gérez les demandes de changement de numéro M-Pesa/Airtel.</p>')

# 3. Force filtering to ONLY PAYOUT_CHANGE in JS
old_js = '''            let { data, error } = await window.supabaseClient
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false });'''
new_js = '''            let { data, error } = await window.supabaseClient
                .from('support_tickets')
                .select('*')
                .eq('type', 'PAYOUT_CHANGE')
                .order('created_at', { ascending: false });'''
c = c.replace(old_js, new_js)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print('Done')
