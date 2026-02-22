import os
import re
import glob

html_files = glob.glob('*.html')

new_sidebar_template = """<nav class="space-y-1">
                    <a href="dashboard.html" class="sidebar-link"><iconify-icon icon="solar:home-smile-bold" width="20"></iconify-icon>Vue d'ensemble</a>
                    <a href="products.html" class="sidebar-link"><iconify-icon icon="solar:box-bold" width="20"></iconify-icon>Produits</a>
                    <a href="orders.html" class="sidebar-link"><iconify-icon icon="solar:cart-large-bold" width="20"></iconify-icon>Commandes</a>
                    <a href="livraisons.html" class="sidebar-link"><iconify-icon icon="solar:delivery-bold" width="20"></iconify-icon>Livraisons</a>
                    <a href="diagnostics.html" class="sidebar-link"><iconify-icon icon="solar:chart-square-bold" width="20"></iconify-icon>Analyses & Diagnostics</a>
                    <a href="profits.html" class="sidebar-link"><iconify-icon icon="solar:wad-of-money-bold" width="20"></iconify-icon>Calcul des Profits</a>
                    <a href="clients.html" class="sidebar-link"><iconify-icon icon="solar:users-group-rounded-bold" width="20"></iconify-icon>Mes Clients</a>
                    <a href="user.html" class="sidebar-link admin-only"><iconify-icon icon="solar:user-bold" width="20"></iconify-icon>Utilisateurs</a>
                    <a href="user-stats.html" class="sidebar-link admin-only"><iconify-icon icon="solar:users-group-two-rounded-bold" width="20"></iconify-icon>Analyse Utilisateurs</a>
                    <a href="promos.html" class="sidebar-link"><iconify-icon icon="solar:ticket-bold" width="20"></iconify-icon>Codes Promo</a>
                    <a href="reviews.html" class="sidebar-link"><iconify-icon icon="solar:star-bold" width="20"></iconify-icon>Avis & Évaluations</a>
                    <a href="rapports.html" class="sidebar-link"><iconify-icon icon="solar:chart-2-bold" width="20"></iconify-icon>Rapports</a>
                    <a href="notifications-admin.html" class="sidebar-link"><iconify-icon icon="solar:bell-bing-bold" width="20"></iconify-icon>Notifications</a>
                    <a href="support.html" class="sidebar-link"><iconify-icon icon="solar:chat-round-dots-bold" width="20"></iconify-icon>Support / Tickets</a>
                    <div class="py-4">
                        <div class="h-px bg-gray-100 mb-4"></div>
                        <a href="settings.html" class="sidebar-link"><iconify-icon icon="solar:settings-bold" width="20"></iconify-icon>Paramètres</a>
                    </div>
                </nav>"""

nav_regex = re.compile(r'<nav class="space-y-1">.*?</nav>', re.DOTALL)

for file in html_files:
    if file in ['diagnostic_logo.html', '404.html']:
        continue
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if '<nav class="space-y-1">' not in content:
        print(f"Skipping {file} - Sidebar not found")
        continue

    # Prepare active link in the template
    # `file` is e.g. 'dashboard.html'
    # we want to find `href="dashboard.html" class="sidebar-link"` and add `active`
    
    # We'll regex replace just the class for the matching href
    # if it's new files generated with "active" already, we should strip first
    clean_template = new_sidebar_template.replace('class="sidebar-link active"', 'class="sidebar-link"')
    
    # some links have admin-only
    # e.g href="users.html" class="sidebar-link admin-only"
    
    # Let's make a generic replace function
    def add_active(match):
        href = match.group(1)
        classes = match.group(2)
        if href == file:
            classes = classes + " active"
        return f'href="{href}" class="{classes}"'
    
    modified_sidebar = re.sub(r'href="([^"]+)" class="([^"]+sidebar-link[^"]*)"', add_active, clean_template)

    new_content = nav_regex.sub(modified_sidebar, content)
    
    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file}")
    else:
        print(f"No changes needed for {file}")
