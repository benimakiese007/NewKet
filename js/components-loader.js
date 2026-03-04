/* NewKet EMarket Component Loader */

/**
 * Header HTML inlined to avoid CORS issues with file:// protocol.
 * When served via HTTP, fetch is used instead.
 */
const HEADER_HTML = `<!-- NewKet Header Component -->
<header class="main-header fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
    <!-- Main header -->
    <div class="header-content w-full px-2 sm:px-8 py-1 sm:py-2 flex flex-wrap items-center justify-between sm:gap-x-4">
        <!-- Left: Hamburger (Mobile) & Logo -->
        <div class="flex items-center gap-2 sm:gap-4">
            <button id="mobileMenuBtn" class="p-1 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors sm:hidden"
                title="Menu">
                <iconify-icon icon="solar:hamburger-menu-linear" width="24" class="text-gray-600"></iconify-icon>
            </button>
            <a href="index.html" class="flex-shrink-0 flex items-center gap-1 sm:gap-3">
                <span
                    class="text-lg sm:text-xl font-bold tracking-tighter text-gray-900 max-[360px]:hidden">NEWKET</span>
            </a>
            <!-- Mobile Publish Button (+) - Hidden as requested -->
            <a href="publish.html" class="p-1 hidden rounded-lg hover:bg-gray-100 transition-colors" title="Vendre">
                <iconify-icon icon="solar:add-circle-linear" width="24" class="text-gray-900"></iconify-icon>
            </a>
        </div>

        <!-- Center: Search & Publish (Desktop/Mobile) -->
        <div id="mobileSearchContainer"
            class="order-3 sm:order-2 flex-none w-full sm:flex-1 sm:w-auto relative group flex gap-3 items-center min-w-0">
            <div
                class="search-bar flex-1 flex items-center bg-slate-100/50 border border-slate-200 rounded-2xl overflow-hidden focus-within:bg-white focus-within:ring-4 focus-within:ring-gray-100 focus-within:border-gray-200 transition-all duration-300 pr-2">
                <input type="text" placeholder="Qu'est-ce qui vous ferait plaisir ?"
                    class="w-full py-2 px-4 bg-transparent text-sm outline-none placeholder-slate-400 font-medium search-input">
                <iconify-icon icon="solar:magnifer-linear" width="20" class="text-slate-400 sm:hidden"></iconify-icon>
                <button
                    class="bg-slate-900 text-white px-5 py-2 m-1 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all uppercase tracking-wider hidden sm:block">RECHERCHE</button>
            </div>
            <!-- Publish Button (Desktop Only) -->
            <a href="publish.html"
                class="shrink-0 bg-gray-900 text-white px-5 py-2 m-1 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors hidden sm:flex items-center gap-2 publish-btn h-[40px] flex items-center">
                <iconify-icon icon="solar:add-circle-bold" width="20"></iconify-icon>
                Vendre
            </a>
            <!-- Suggestions Dropdown -->
            <div id="searchSuggestions" class="search-suggestions hidden"></div>
        </div>

        <!-- Right: Icons -->
        <div class="order-2 sm:order-3 flex items-center gap-1.5 sm:gap-2 shrink-0">

            <!-- Currency Switch -->
            <div class="hidden md:block currency-switch-segmented" id="currencyToggle" data-active="CDF">
                <div class="segmented-track">
                    <div class="segmented-handle"></div>
                    <span class="segmented-label" data-currency="USD">USD</span>
                    <span class="segmented-label" data-currency="CDF">CDF</span>
                </div>
            </div>

            <!-- Notifications (Hidden on mobile as requested) -->
            <a href="notifications.html"
                class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors hidden sm:block"
                title="Notifications">
                <iconify-icon icon="solar:bell-linear" width="22" class="text-gray-600"></iconify-icon>
                <span
                    class="notification-badge absolute top-0.5 right-0.5 sm:-top-0.5 sm:-right-0.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
                    style="display:none; font-size:10px; width:16px; height:16px; min-width: 16px;">0</span>
            </a>

            <!-- Favorites -->
            <a href="favorites.html" class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
                title="Favoris">
                <iconify-icon icon="solar:heart-linear" width="22" class="text-gray-600"></iconify-icon>
                <span
                    class="favorites-badge absolute top-0.5 right-0.5 sm:-top-0.5 sm:-right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                    style="display:none; font-size:10px; width:18px; height:18px;">0</span>
            </a>

            <!-- Account -->
            <a href="login.html" class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
                title="Compte" id="accountLink">
                <iconify-icon icon="solar:user-linear" width="22" class="text-gray-600"></iconify-icon>
            </a>

            <!-- Cart -->
            <a href="cart.html" class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
                title="Panier">
                <iconify-icon icon="solar:bag-3-linear" width="22" class="text-gray-600"></iconify-icon>
                <span
                    class="absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                    style="font-size:10px; width:18px; height:18px;" id="cart-count">0</span>
            </a>

        </div>
    </div>



    <!-- Category nav -->
    <div class="border-t border-gray-50 bg-white hidden sm:block">
        <div class="w-full px-4 sm:px-8">
            <nav class="flex items-center gap-1 overflow-x-auto py-1 -mx-2" style="scrollbar-width:none;">
                <a href="catalog.html"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Toutes
                    les pièces</a>
                <a href="shops.html"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Boutiques</a>
                <a href="forum.html"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Forum</a>
                <a href="catalog.html?category=Collections Femme"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Collections
                    Femme</a>
                <a href="catalog.html?category=Style Homme"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Style
                    Homme</a>
                <a href="catalog.html?category=Tech & Gadgets"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Tech
                    & Gadgets</a>
                <a href="catalog.html?category=Art de vivre"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Art
                    de vivre</a>
                <a href="catalog.html"
                    class="nav-link px-3 py-1.5 text-sm font-medium text-gray-900 hover:text-black whitespace-nowrap rounded-lg hover:bg-100 transition-colors flex items-center gap-1">
                    <iconify-icon icon="solar:fire-bold" width="14"></iconify-icon>Promos
                </a>
            </nav>
        </div>
    </div>
</header>

<!-- Mobile Menu Sidebar -->
<div id="mobileOverlay"
    class="fixed inset-0 bg-black/50 z-[60] opacity-0 pointer-events-none transition-opacity duration-300 sm:hidden">
</div>
<div id="mobileMenu" class="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-[70] shadow-2xl sm:hidden flex flex-col">
    <div class="p-4 border-b border-gray-100 flex items-center justify-end">
        <button id="closeMobileMenu" class="p-2 rounded-lg hover:bg-gray-100">
            <iconify-icon icon="solar:close-circle-linear" width="24" class="text-gray-600"></iconify-icon>
        </button>
    </div>

    <div class="flex-1 overflow-y-auto py-4">
        <div class="px-4 mb-6">
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Catégories</h3>
            <nav class="flex flex-col gap-1">
                <a href="catalog.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:shop-linear" width="20"></iconify-icon> Toutes les pièces
                </a>
                <a href="shops.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:shop-2-linear" width="20"></iconify-icon> Boutiques
                </a>
                <a href="forum.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:chat-round-line-linear" width="20"></iconify-icon> Forum Communauté
                </a>
                <!-- ... other category links ... -->
            </nav>
        </div>

        <div class="px-4 mb-6 border-t border-gray-50 pt-6">
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Personnel</h3>
            <nav class="flex flex-col gap-1">
                <a href="notifications.html"
                    class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <span class="flex items-center gap-3"><iconify-icon icon="solar:bell-linear"
                            width="20"></iconify-icon> Notifications</span>
                    <span
                        class="notification-badge bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full hidden">0</span>
                </a>
                <a href="favorites.html"
                    class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <span class="flex items-center gap-3"><iconify-icon icon="solar:heart-linear"
                            width="20"></iconify-icon> Favoris</span>
                    <span id="mobileFavoritesBadge"
                        class="bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full">0</span>
                </a>
                <a href="publish.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900 text-white font-medium mt-2 publish-btn">
                    <iconify-icon icon="solar:add-circle-linear" width="20"></iconify-icon> Vendre un article
                </a>
            </nav>
        </div>

        <div class="px-4 mt-auto border-t border-gray-50 pt-6">
            <div class="p-4 bg-gray-50 rounded-2xl">
                <p class="text-xs text-gray-500 mb-3">Devise d'affichage</p>
                <div class="currency-switch-segmented scale-90 origin-left" id="mobileCurrencyToggle" data-active="CDF">
                    <div class="segmented-track">
                        <div class="segmented-handle"></div>
                        <span class="segmented-label" data-currency="USD">USD</span>
                        <span class="segmented-label" data-currency="CDF">CDF</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>`;

const FOOTER_HTML = `<!-- NewKet Footer Component -->
<footer class="bg-gray-900 text-white mt-16 pt-16 pb-8 border-t border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-10 gap-12 mb-16">
            <div class="lg:col-span-4 space-y-6">
                <div class="flex items-center gap-3">
                    <span class="text-xl font-bold tracking-tight">NEWKET</span>
                </div>
                <p class="text-gray-400 text-sm leading-relaxed max-w-sm">
                    L'excellence de la marketplace moderne. Découvrez une sélection rigoureuse d'articles de luxe et profitez d'une expérience shopping sans compromis.
                </p>
                <div class="flex items-center gap-4">
                    <a href="#" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:instagram" width="20"></iconify-icon></a>
                    <a href="#" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:facebook" width="20"></iconify-icon></a>
                    <a href="#" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:twitter-x" width="20"></iconify-icon></a>
                </div>
            </div>
            <div class="lg:col-span-2 space-y-6">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Services</h4>
                <ul class="space-y-4">
                    <li><a href="customer-dashboard.html" class="text-gray-400 hover:text-white text-sm transition-colors">Mon Compte</a></li>
                    <li><a href="customer-dashboard.html" class="text-gray-400 hover:text-white text-sm transition-colors">Suivi de Commande</a></li>
                    <li><a href="about.html" class="text-gray-400 hover:text-white text-sm transition-colors">Aide & FAQ</a></li>
                    <li><a href="publish.html" class="text-gray-400 hover:text-white text-sm transition-colors publish-btn">Vendre un article</a></li>
                </ul>
            </div>
            <div class="lg:col-span-4 space-y-6">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Inspiration & Offres</h4>
                <p class="text-gray-400 text-sm">Inscrivez-vous pour recevoir nos sélections exclusives et avant-premières.</p>
                <form class="relative group" onsubmit="event.preventDefault(); alert('Merci pour votre inscription !');"> 
                    <input type="email" placeholder="Votre email" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all">
                    <button type="submit" class="absolute right-2 top-2 bg-white text-black text-xs font-bold uppercase px-4 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">S'inscrire</button>
                </form>
            </div>
        </div>
        <div class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 NEWKET — Expérience Luxe</p>
            <div class="flex gap-8">
                <a href="privacy.html" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Confidentialité</a>
                <a href="terms.html" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Conditions</a>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-gray-500 text-[10px] uppercase tracking-widest font-semibold italic">Designed by</span>
                <span class="text-white text-[11px] font-black tracking-tighter hover:text-red-500 transition-colors cursor-pointer">SITYZEN</span>
            </div>
        </div>
    </div>
</footer>`;

const ComponentLoader = {
    async init() {
        console.log('[NewKet] Initializing Component Loader...');

        // Determine if we are on the home page (index.html or root)
        const isHomePage = window.location.pathname === '/' ||
            window.location.pathname === '' ||
            window.location.pathname.endsWith('index.html');

        const componentsToLoad = [
            this.loadComponent('header-placeholder', 'components/header.html', HEADER_HTML)
        ];

        if (isHomePage) {
            componentsToLoad.push(
                this.loadComponent('footer-placeholder', 'components/footer.html', FOOTER_HTML)
            );
        }

        await Promise.all(componentsToLoad);

        // Dispatch event when components are ready
        window.dispatchEvent(new CustomEvent('componentsLoaded'));

        // Re-initialize UI managers that depend on header/footer
        if (window.AuthManager) AuthManager.updateAccountLink();
        if (window.CartManager) CartManager.updateBadge();
        if (window.FavoritesManager) FavoritesManager.updateUI();
        if (window.CurrencyManager) CurrencyManager.updateCurrencyUI();
        if (window.SearchManager) SearchManager.init();
    },

    async loadComponent(elementId, path, fallbackHTML = '') {
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            // Adjust path based on current directory depth
            const adjustedPath = this.getAdjustedPath(path);
            const response = await fetch(adjustedPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            this.injectHTML(element, html);
            console.log(`[NewKet] Loaded ${path} via fetch`);
        } catch (error) {
            // CORS / file:// fallback: use inline HTML
            if (fallbackHTML) {
                this.injectHTML(element, fallbackHTML);
                console.log(`[NewKet] Loaded ${path} via inline fallback`);
            } else {
                console.error(`[NewKet] Failed to load component ${path}:`, error);
            }
        }
    },

    injectHTML(element, html) {
        element.innerHTML = html;
        // Execute any inline scripts injected
        const scripts = element.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    },

    getAdjustedPath(path) {
        let prefix = '';
        const pathParts = window.location.pathname.split('/');
        if (pathParts.includes('admin') || pathParts.filter(Boolean).length > 1) {
            prefix = '../';
        }
        return prefix + path;
    }
};

window.ComponentLoader = ComponentLoader;

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    ComponentLoader.init();
});
