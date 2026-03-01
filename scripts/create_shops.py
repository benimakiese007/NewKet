import os
import re

directory = r"c:\Users\tmaut\Downloads\THE PHOENIX\NOVA V2"

with open(os.path.join(directory, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()

main_content = '''
    <!-- Spacer for fixed header -->
    <div class="h-24 sm:h-28"></div>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 ring-gray-100">
        <div class="mb-10 text-center sm:text-left">
            <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">Parcourir les Boutiques</h1>
            <p class="text-gray-500 text-lg max-w-2xl mx-auto sm:mx-0">Découvrez nos vendeurs partenaires et leurs collections exclusives.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="shopsGrid">
            <!-- Loading Skeletons -->
            <div class="animate-pulse bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-48"></div>
            <div class="animate-pulse bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-48"></div>
            <div class="animate-pulse bg-white rounded-3xl p-6 shadow-sm border border-gray-100 h-48"></div>
        </div>
        <div id="noShopsMsg" class="hidden text-center py-20 text-gray-400 bg-white rounded-[2rem] border border-gray-100 shadow-sm col-span-full">Aucune boutique trouvée.</div>
    </main>
'''

html = re.sub(
    r'<!-- Spacer for fixed header -->.*?<!-- ========== FOOTER ========== -->',
    main_content + '\n    <!-- ========== FOOTER ========== -->',
    html,
    flags=re.DOTALL
)

script_content = '''
    <style>
        .shop-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.05); }
        .shop-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    </style>
    <script>
        async function loadShops() {
            const grid = document.getElementById('shopsGrid');
            const noShops = document.getElementById('noShopsMsg');

            try {
                if (!window.supabase) {
                    console.error('Supabase client not loaded');
                    grid.innerHTML = '';
                    noShops.classList.remove('hidden');
                    return;
                }

                const { data: sellers, error } = await window.supabase
                    .from('users')
                    .select('*')
                    .in('role', ['vendor', 'supplier'])
                    .order('date_joined', { ascending: false });

                if (error) throw error;

                if (!sellers || sellers.length === 0) {
                    grid.innerHTML = '';
                    noShops.classList.remove('hidden');
                    return;
                }

                grid.innerHTML = sellers.map(seller => {
                    const avatar = seller.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(seller.name || 'Vendor') + '&background=000000&color=fff');
                    const dateJoined = seller.date_joined ? new Date(seller.date_joined).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'récemment';
                    
                    return `
                        <a href="catalog.html?supplier=${encodeURIComponent(seller.email)}" class="shop-card bg-white rounded-[2rem] p-6 border border-gray-100 flex flex-col gap-4 group">
                            <div class="flex flex-row items-center justify-between">
                                <div class="w-16 h-16 rounded-2xl bg-gray-50 overflow-hidden border border-gray-100 p-0.5">
                                    <img src="${avatar}" alt="${seller.name}" class="w-full h-full object-cover rounded-xl" onerror="this.src='https://via.placeholder.com/64'">
                                </div>
                                <div class="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition-colors">
                                    <iconify-icon icon="solar:arrow-right-up-linear" width="20"></iconify-icon>
                                </div>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-gray-900 group-hover:text-black transition-colors mb-1 truncate" title="${seller.name || 'Boutique sans nom'}">${seller.name || 'Boutique sans nom'}</h3>
                                <div class="flex items-center justify-between mt-3">
                                    <span class="px-2 py-1 bg-black text-white rounded-lg text-[9px] font-bold uppercase tracking-widest">Partenaire</span>
                                    <span class="text-xs text-gray-400 flex items-center gap-1 font-medium">
                                        <iconify-icon icon="solar:calendar-outline"></iconify-icon>
                                        Depuis ${dateJoined}
                                    </span>
                                </div>
                            </div>
                        </a>
                    `;
                }).join('');

            } catch (err) {
                console.error('Erreur chargement boutiques:', err);
                grid.innerHTML = '';
                noShops.classList.remove('hidden');
                noShops.textContent = 'Erreur lors du chargement des boutiques.';
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (window.newketInitialized) {
                loadShops();
            } else {
                window.addEventListener('newketInitialized', loadShops);
            }
        });
    </script>
'''

html = html.replace('</body>', script_content + '\n</body>')
html = html.replace('<title>NewKet — Marketplace Moderne</title>', '<title>Boutiques — NewKet</title>')

with open(os.path.join(directory, 'shops.html'), 'w', encoding='utf-8') as f:
    f.write(html)

print("shops.html created.")


files_to_update = ['index.html', 'catalog.html', 'product.html', 'cart.html']
nav_link_desktop = '<a href="shops.html" class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Boutiques</a>'
nav_link_mobile = '''<a href="shops.html"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                        <iconify-icon icon="solar:shop-2-linear" width="20"></iconify-icon>
                        Boutiques
                    </a>'''

for filename in files_to_update:
    filepath = os.path.join(directory, filename)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'href="shops.html"' not in content:
        content = re.sub(r'(<a href="catalog\.html"[^>]*>Toutes\s+les\s+(?:pièces|catégories)</a>)', r'\1\n                    ' + nav_link_desktop, content)
        
        content = re.sub(r'(<a href="catalog\.html"[^>]*>\s*<iconify-icon icon="solar:shop-linear"[^>]*></iconify-icon>\s*Toutes\s+les\s+(?:pièces|catégories)\s*</a>)', r'\1\n                    ' + nav_link_mobile, content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filename}")
