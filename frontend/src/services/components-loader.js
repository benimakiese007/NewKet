if (!window.ComponentLoader) {

/* NewKet EMarket Component Loader */

/**
 * Header HTML inlined to avoid CORS issues with file:// protocol.
 * When served via HTTP, fetch is used instead.
 */
const CATEGORY_NAV_HTML_TEMPLATE = ``;

const HEADER_HTML = `
    <!-- Main header container -->
    <nav class="main-header newket-header-shell fixed top-0 w-full z-[100] transition-all duration-300" data-header-shell="main">
        <!-- Main header content (Logo, Search, Icons) -->
            <div class="header-content relative w-full px-4 sm:px-8 py-2 sm:py-2 flex flex-col sm:flex-row items-center justify-between gap-y-3 sm:gap-x-5 lg:gap-x-8">
            <!-- Top section for mobile: Menu, Centered Logo, Account -->
            <div class="header-brand-row grid grid-cols-3 items-center w-full sm:flex sm:w-auto sm:flex-none h-12 sm:h-auto sm:relative px-1 sm:px-0">
                <!-- Hamburger Menu (tous écrans) — col gauche -->
                <div class="flex items-center justify-start">
                    <button id="mobileMenuBtn" class="header-icon-button p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                        title="Menu" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="mobileMenu">
                        <iconify-icon icon="solar:hamburger-menu-linear" width="24" class="text-white"></iconify-icon>
                    </button>
                </div>

                <!-- Logo Section — col centre (parfaitement centré sur mobile, statique sur desktop) -->
                <div class="flex items-center justify-center sm:min-w-0 sm:justify-start">
                    <a href="{{ROOT}}index.html" aria-label="Retour à l'accueil NewKet" title="Accueil NewKet" class="header-logo-link flex-shrink-0 flex items-center py-1 sm:static z-10 transition-transform hover:scale-105 duration-300">
                        <img src="https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572408/newket_assets/racine/Logo_NewKet_Pour_Les_HEADERs_Only.png" alt="NewKet" width="320" height="96"
                            data-site-logo="header"
                            class="header-brand-image h-8 sm:h-20 w-auto object-contain"
                            onerror="this.src='https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572406/newket_assets/racine/Logo_Header_Officiel_PNG.png'; this.onerror=null;">
                    </a>
                </div>

                <!-- Right Icons (Mobile) — col droite -->
                <div class="flex items-center gap-2 justify-end sm:hidden">
                    <!-- Offline Network Status Icon (Mobile) -->
                    <div class="network-status-icon hidden flex items-center justify-center text-red-500 bg-red-500/20 h-8 w-8 rounded-lg border border-red-500/30" title="Vous êtes hors ligne">
                        <iconify-icon icon="mdi:wifi-off" width="18"></iconify-icon>
                    </div>

                    <!-- Notifications Icon (Mobile) -->
                    <a href="{{ROOT}}src/pages/notifications.html" class="header-icon-button relative inline-flex items-center justify-center p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                        title="Notifications" aria-label="Voir les notifications">
                        <iconify-icon icon="solar:bell-linear" width="22" class="text-white"></iconify-icon>
                        <span class="notification-badge absolute top-0 right-0 bg-gray-900 text-white text-[9px] rounded-full flex items-center justify-center font-bold" style="display:none; width:14px; height:14px;">0</span>
                    </a>

                    <!-- Favorites Icon (Mobile) -->
                    <a href="{{ROOT}}src/pages/favorites.html" class="header-icon-button admin-hidden relative inline-flex items-center justify-center p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                        title="Favoris" aria-label="Voir les favoris">
                        <iconify-icon icon="solar:heart-linear" width="22" class="text-white"></iconify-icon>
                        <span class="favorites-badge absolute top-0 right-0 bg-gray-900 text-white text-[9px] rounded-full flex items-center justify-center font-bold" style="display:none; width:14px; height:14px;">0</span>
                    </a>
                </div>
            </div>

            <!-- Search Bar (Full width on mobile, centered on desktop) -->
            <div id="mobileSearchContainer" 
                class="header-search-row user-hidden-on-mobile sm:flex flex-none w-full sm:flex-[1_1_720px] sm:mx-4 lg:mx-8 relative group flex-row flex-nowrap gap-3 sm:gap-4 items-center min-w-0"
                style="max-width: 720px;">
                <div class="search-bar">
                    <!-- Category Selector -->
                    <div id="mobileSearchCategoryNativeShell" class="mobile-search-category-shell">
                        <select id="mobileSearchCategorySelect" class="mobile-search-category-native" aria-label="Choisir une catégorie">
                            <option value="all">Tout</option>
                            <!-- Dynamic Categories -->
                        </select>
                    </div>
                    <div id="searchCategoryBtn" class="search-category-btn" title="Choisir une catégorie">
                        <span id="selectedCategoryName">TOUT</span>
                        <iconify-icon icon="solar:alt-arrow-down-linear" width="14"></iconify-icon>
                        
                        <!-- Mini Dropdown for categories -->
                        <div id="searchCategoryMenu" class="hidden absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] overflow-hidden">
                            <div class="py-2" id="searchCategoryMenuList">
                                <button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900 rounded-xl" data-value="all">Tout</button>
                                <!-- Dynamic Categories -->
                            </div>
                        </div>
                    </div>

                    <input type="text" id="searchInput" name="search" placeholder="Rechercher sur NewKet..." aria-label="Rechercher des produits"
                        class="search-input" autocomplete="off" spellcheck="false">
                        

                    <div id="searchSuggestions" class="search-suggestions"></div>
                </div>

                <!-- Publish Button (seller only - shown via JS) -->
                <a href="{{ROOT}}src/pages/publish.html"
                    class="seller-ui-element shrink-0 bg-gray-900 text-white p-2 rounded-xl hover:bg-gray-800 transition-colors items-center justify-center publish-btn h-[44px] w-[44px] order-last btn-active-scale"
                    data-track-action="navigation:publish_click"
                    aria-label="Vendre un article"
                    title="Vendre un article"
                    style="display:none">
                    <iconify-icon icon="solar:add-circle-bold" width="22"></iconify-icon>
                </a>

                <!-- Cart Icon (Tablet) -->
                <button id="cartBtnTablet" onclick="window.CartManager && window.CartManager.toggleCartUI()" 
                    class="header-icon-button admin-hidden relative hidden items-center justify-center p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Panier" aria-label="Mon panier">
                    <iconify-icon icon="solar:cart-large-minimalistic-linear" width="22" class="text-white"></iconify-icon>
                    <span class="cart-badge absolute top-0 right-0 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold" style="display:none; width:14px; height:14px;">0</span>
                </button>

                <!-- Account Icon (Tablet) -->
                <a id="accountLinkTablet" href="{{ROOT}}{{ACCOUNT_PATH}}" class="header-icon-button relative hidden items-center justify-center p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Compte" aria-label="Mon compte">
                    <iconify-icon icon="solar:user-linear" width="22" class="text-white"></iconify-icon>
                </a>
            </div>

            <!-- Desktop Icons (Notifications, Favorites, Account, Theme) -->
            <div class="header-actions hidden sm:flex items-center gap-3 shrink-0">
                <!-- Currency Toggle (Desktop) -->
                <div class="hidden lg:flex items-center">
                    <div class="currency-switch-segmented scale-90 origin-right" id="desktopCurrencyToggle" data-active="CDF" title="Devise d'affichage">
                        <div class="segmented-track">
                            <div class="segmented-handle"></div>
                            <span class="segmented-label" data-currency="USD">USD</span>
                            <span class="segmented-label" data-currency="CDF">CDF</span>
                        </div>
                    </div>
                </div>

                <!-- Offline Network Status Icon (Desktop) -->
                <div class="network-status-icon hidden flex items-center gap-2 text-red-500 bg-red-500/20 h-10 px-3 rounded-xl border border-red-500/30" title="Vous êtes hors ligne">
                    <iconify-icon icon="mdi:wifi-off" width="20"></iconify-icon>
                    <span class="text-[10px] font-black uppercase tracking-widest text-white">Hors ligne</span>
                </div>

                <!-- Notifications -->
                <a href="{{ROOT}}src/pages/notifications.html"
                    class="header-icon-button relative p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Notifications" aria-label="Voir les notifications">
                    <iconify-icon icon="solar:bell-linear" width="22" class="text-white"></iconify-icon>
                    <span
                        class="notification-badge absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:16px; height:16px; min-width: 16px;">0</span>
                </a>

                <!-- Favorites -->
                <a href="{{ROOT}}src/pages/favorites.html" class="header-icon-button admin-hidden relative p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Favoris" aria-label="Voir les favoris">
                    <iconify-icon icon="solar:heart-linear" width="22" class="text-white"></iconify-icon>
                    <span
                        class="favorites-badge absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:18px; height:18px;">0</span>
                </a>

                <!-- Cart -->
                <button onclick="window.CartManager && window.CartManager.toggleCartUI()" class="header-icon-button admin-hidden relative p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Panier" aria-label="Voir le panier">
                    <iconify-icon icon="solar:cart-large-minimalistic-linear" width="22" class="text-white"></iconify-icon>
                    <span
                        class="cart-badge absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:18px; height:18px;">0</span>
                </button>

                <!-- Account -->
                <a href="{{ROOT}}{{ACCOUNT_PATH}}" class="header-icon-button relative p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Compte" id="accountLink" aria-label="Mon compte">
                    <iconify-icon icon="solar:user-linear" width="22" class="text-white"></iconify-icon>
                </a>
            </div>
        </div>

        <!-- Global Search Overlay -->
        <div id="searchOverlay" class="search-overlay"></div>

            </div>
    </nav>

<!-- Mobile Menu Sidebar -->
<div id="mobileOverlay"
    class="fixed inset-0 bg-black/50 opacity-0 pointer-events-none transition-opacity duration-300 sm:hidden" style="z-index: 9000;" aria-hidden="true">
</div>
<div id="mobileMenu" class="fixed inset-0 bg-white flex flex-col" style="z-index: 10000;" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Navigation mobile">
    <div class="mobile-menu-header px-4 flex items-center justify-between bg-white text-gray-900 border-b border-gray-100/60" style="padding-top: calc(2rem + env(safe-area-inset-top)); padding-bottom: 2rem;">
        <div class="mobile-menu-brand">
            <img src="https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572411/newket_assets/racine/Logo_Vert_Pour_Fond_Blanc.png" alt="NewKet" width="240" height="96" class="h-12 w-auto object-contain">
            <p class="mobile-menu-subtitle text-gray-500 text-xs">Votre navigation principale</p>
        </div>
        <button id="closeMobileMenu" class="p-2 transition-all btn-active-scale rounded-xl" aria-label="Fermer le menu">
            <iconify-icon icon="solar:close-circle-bold" width="32" class="text-gray-900"></iconify-icon>
        </button>
    </div>

    <div class="flex-1 overflow-y-auto pt-4 pb-6" style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));">
        <!-- Guest Call to Action -->
        <div id="mobileGuestCTA" class="px-4 mb-6">
            <a href="{{ROOT}}src/pages/login.html" class="flex flex-row items-center gap-3 p-4 bg-slate-900 text-white rounded-[1.5rem] text-left group transition-all hover:bg-slate-800">
                <div class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <iconify-icon icon="solar:user-bold" width="20"></iconify-icon>
                </div>
                <div class="flex-1 flex flex-col items-start min-w-0">
                    <div class="text-sm font-bold truncate w-full">Compte NewKet</div>
                    <div class="text-[10px] text-white/60 font-medium mt-0.5 leading-tight line-clamp-2">Connectez-vous pour voir vos favoris et vos commandes.</div>
                </div>
                <div class="w-10 h-10 bg-white text-slate-900 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:bg-gray-100 transition-colors">
                    <iconify-icon icon="solar:login-3-bold" width="20"></iconify-icon>
                </div>
            </a>
        </div>

        <!-- Logged User Call to Action -->
        <div id="mobileLoggedCTA" class="px-4 mb-6" style="display: none;">
            <a id="mobileLoggedLink" href="{{ROOT}}src/pages/customer-dashboard.html" class="flex flex-row items-center gap-3 p-4 bg-slate-900 text-white rounded-[1.5rem] text-left group transition-all hover:bg-slate-800 shadow-xl">
                <div class="w-10 h-10 shrink-0 bg-white/10 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden border-2 border-white/20 shadow-md">
                    <img id="mobileLoggedAvatar" src="" alt="Avatar" class="w-full h-full object-cover hidden" referrerpolicy="no-referrer" crossorigin="anonymous">
                    <iconify-icon id="mobileLoggedIcon" icon="solar:user-bold" width="20" class="text-white hidden"></iconify-icon>
                </div>
                <div class="flex-1 flex flex-col items-start min-w-0">
                    <div id="mobileLoggedName" class="text-sm font-bold leading-tight truncate w-full">Mon Compte</div>
                    <div id="mobileLoggedRole" class="text-[10px] text-white/50 font-medium uppercase tracking-widest mt-0.5 truncate w-full">Membre NewKet</div>
                </div>
                <div class="w-10 h-10 bg-white/10 text-white border border-white/20 rounded-xl flex items-center justify-center shrink-0 hover:bg-white hover:text-slate-900 transition-colors group-hover:scale-105">
                    <iconify-icon icon="solar:alt-arrow-right-bold" width="20"></iconify-icon>
                </div>
            </a>
        </div>

        <div class="mobile-menu-shortcuts px-4 mb-6">
            <div class="mobile-menu-shortcuts-grid">
                <a href="{{ROOT}}src/pages/catalog.html" class="mobile-menu-shortcut-card">
                    <iconify-icon icon="solar:shop-linear" width="20"></iconify-icon>
                    <span>Catalogue</span>
                </a>
                <a href="{{ROOT}}src/pages/shops.html" class="mobile-menu-shortcut-card">
                    <iconify-icon icon="solar:shop-2-linear" width="20"></iconify-icon>
                    <span>Boutiques</span>
                </a>
                <a href="{{ROOT}}src/pages/publish.html" class="mobile-menu-shortcut-card publish-btn seller-ui-element" data-track-action="navigation:publish_click" style="display:none">
                    <iconify-icon icon="solar:add-circle-bold" width="20"></iconify-icon>
                    <span>Vendre</span>
                </a>
                <a href="{{ROOT}}src/pages/favorites.html" class="mobile-menu-shortcut-card admin-hidden">
                    <iconify-icon icon="solar:heart-linear" width="20"></iconify-icon>
                    <span>Favoris</span>
                </a>
                <a href="{{ROOT}}src/pages/notifications.html" class="mobile-menu-shortcut-card non-seller-ui-element">
                    <iconify-icon icon="solar:bell-linear" width="20"></iconify-icon>
                    <span>Notifications</span>
                    <span class="notification-badge bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full hidden absolute top-2 right-2">0</span>
                </a>
            </div>
        </div>

        <div class="mobile-menu-sections-grid px-4 mb-6">
            <div class="mobile-menu-sections-left">
            <h3 class="mobile-menu-section-title">Catégories</h3>
            <nav class="flex flex-col gap-1">
                <a href="{{ROOT}}src/pages/catalog.html?category=Femme"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:user-circle-linear" width="20"></iconify-icon> Femme
                </a>
                <a href="{{ROOT}}src/pages/catalog.html?category=Homme"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:user-rounded-linear" width="20"></iconify-icon> Homme
                </a>
                <a href="{{ROOT}}src/pages/catalog.html?category=Tech & Gadgets"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:laptop-minimalistic-linear" width="20"></iconify-icon> Tech & Gadgets
                </a>
                <a href="{{ROOT}}src/pages/catalog.html?category=HIGH-TECH"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:cpu-linear" width="20"></iconify-icon> HIGH-TECH
                </a>
                <a href="{{ROOT}}src/pages/catalog.html?category=Art de vivre"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:sofa-linear" width="20"></iconify-icon> Art de vivre
                </a>
                <a href="{{ROOT}}src/pages/catalog.html?promo=true"
                    class="mobile-menu-link flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-red-600 font-bold">
                    <iconify-icon icon="solar:fire-bold" width="20"></iconify-icon> Promos
                </a>
            </nav>
            </div>

            <div class="mobile-menu-sections-right">



            <div class="header-quick-links mb-6 border-t border-gray-50 pt-6">
                <h3 class="mobile-menu-section-title">Liens utiles</h3>
                <nav class="flex flex-col gap-1">
                    <a href="{{ROOT}}src/pages/support.html"
                        class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                        <iconify-icon icon="solar:help-bold" width="20"></iconify-icon> Support
                    </a>
                    <a href="{{ROOT}}src/pages/faq.html"
                        class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                        <iconify-icon icon="solar:question-circle-bold" width="20"></iconify-icon> FAQ
                    </a>
                </nav>
            </div>
            </div>
        </div>

            <div class="px-4 mt-auto border-t border-gray-50 pt-5 pb-6">
                <div class="p-4 bg-gray-50 rounded-2xl mb-4">
                    <p class="text-xs text-gray-500 mb-3 font-semibold">Devise d'affichage</p>
                <div class="currency-switch-segmented scale-90 origin-left" id="mobileCurrencyToggle" data-active="CDF">
                    <div class="segmented-track">
                        <div class="segmented-handle"></div>
                        <span class="segmented-label" data-currency="USD">USD</span>
                        <span class="segmented-label" data-currency="CDF">CDF</span>
                    </div>
                </div>
            </div>
            
            <!-- Logout Button (Authenticated Only) -->
            <button id="mobileLogoutBtn" data-action="logout" style="display: none;"
                class="flex items-center justify-center gap-2 w-full px-4 py-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold transition-all active:scale-[0.98]">
                <iconify-icon icon="solar:logout-linear" width="20"></iconify-icon> Se déconnecter
            </button>
        </div>
    </div>
</div>`;

const FOOTER_HTML = `<!-- NewKet Footer Component -->
<footer class="newket-footer-shell text-white mt-16 pt-10 pb-7 border-t border-[#0A4A2E]" style="margin-top: 4rem; padding-top: 2.5rem; padding-bottom: calc(1.5rem + 80px + env(safe-area-inset-bottom));">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-10 gap-8 mb-10">
            <div class="lg:col-span-4 space-y-4">
                <div class="flex items-center justify-center lg:justify-start">
                    <img src="https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572389/newket_assets/frontend/src/assets/Images/logo-newket.png" alt="NewKet" width="320" height="128" data-site-logo="footer" class="h-20 sm:h-24 lg:h-28 w-auto object-contain">
                </div>
                <p class="text-gray-400 text-sm leading-relaxed max-w-md">
                    L'excellence de la marketplace moderne. Découvrez une sélection rigoureuse d'articles de luxe et profitez d'une expérience shopping sans compromis.
                </p>
                <div class="space-y-2 text-sm text-gray-400">
                    <a href="tel:+243990924254" class="flex items-center gap-2 hover:text-white transition-colors">
                        <iconify-icon icon="solar:phone-calling-linear" width="18"></iconify-icon>
                        <span>+243990924254</span>
                    </a>
                    <a href="mailto:benimakiese1234@gmail.com" onclick="if(window.copyTextToClipboard) { window.copyTextToClipboard('benimakiese1234@gmail.com'); if(window.showToast) window.showToast('Adresse email copiée dans le presse-papiers', 'success'); }" class="flex items-center gap-2 hover:text-white transition-colors break-all" title="Cliquer pour envoyer un email (ou copier l'adresse)">
                        <iconify-icon icon="solar:letter-linear" width="18"></iconify-icon>
                        <span>benimakiese1234@gmail.com</span>
                    </a>
                </div>
                <div class="flex items-center gap-4">
                    <a data-social-link="instagram" href="https://www.instagram.com/benimakiese007" target="_blank" rel="noopener noreferrer" aria-label="NewKet sur Instagram" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:instagram" width="20"></iconify-icon></a>
                    <a data-social-link="facebook" href="https://www.facebook.com/Benimakiese007" target="_blank" rel="noopener noreferrer" aria-label="NewKet sur Facebook" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:facebook" width="20"></iconify-icon></a>
                    <a data-social-link="x" href="https://x.com/lephoenixman" target="_blank" rel="noopener noreferrer" aria-label="NewKet sur X" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:twitter-x" width="20"></iconify-icon></a>
                    <a data-social-link="linkedin" href="https://www.linkedin.com/company/newket" target="_blank" rel="noopener noreferrer" aria-label="NewKet sur LinkedIn" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:linkedin" width="20"></iconify-icon></a>
                </div>
            </div>
            <div class="lg:col-span-2 space-y-4">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Services</h4>
                <ul class="space-y-4">
                    <li><a href="{{ROOT}}src/pages/about.html" class="text-gray-400 hover:text-white text-sm transition-colors">À propos de nous</a></li>
                    <li><a href="{{ROOT}}src/pages/seller.html" class="text-gray-400 hover:text-white text-sm transition-colors">Devenir Vendeur</a></li>
                    <li><a href="{{ROOT}}src/pages/support.html" class="text-gray-400 hover:text-white text-sm transition-colors">Support Technique</a></li>
                    <li><a href="{{ROOT}}src/pages/faq.html" class="text-gray-400 hover:text-white text-sm transition-colors">FAQ</a></li>
                    {{AUTH_ONLY_START}}<li><a href="{{ROOT}}src/pages/publish.html" class="text-gray-400 hover:text-white text-sm transition-colors publish-btn" data-track-action="navigation:publish_click">Vendre un article</a></li>{{AUTH_ONLY_END}}
                </ul>
            </div>
            <div class="lg:col-span-4 space-y-4">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Inspiration & Offres</h4>
                <p class="text-gray-400 text-sm">Inscrivez-vous pour recevoir nos sélections exclusives et avant-premières.</p>
                <form id="newsletterForm" class="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:relative" onsubmit="event.preventDefault(); if (window.handleNewsletterSubmit) { window.handleNewsletterSubmit(event); } else if (window.showToast) { window.showToast('Merci pour votre inscription !', 'success', 'Newsletter'); }"> 
                    <input id="newsletterEmail" name="newsletterEmail" type="email" placeholder="Votre email" autocomplete="email" class="w-full sm:flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all">
                    <button id="newsletterBtn" type="submit" class="w-full sm:w-auto bg-white text-black text-xs font-bold uppercase px-5 py-3 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap">S'inscrire</button>
                    <div id="newsletterMsg" class="hidden text-xs w-full sm:absolute sm:-bottom-6 sm:left-0 mt-1 sm:mt-2"></div>
                </form>
            </div>
        </div>
        <!-- Payment Methods -->
        <div class="flex flex-col items-center gap-3 mb-8 pt-6 border-t border-white/5">
            <span class="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Paiements acceptés</span>
            <div class="flex flex-wrap justify-center items-center gap-4">
                <img src="{{ROOT}}Images/Orange-Money.png" alt="Orange Money" title="Orange Money" style="height:28px; width:auto; object-fit:contain;" loading="lazy">
                <img src="{{ROOT}}Images/airtel-money.png" alt="Airtel Money" title="Airtel Money" style="height:28px; width:auto; object-fit:contain;" loading="lazy">
                <img src="{{ROOT}}Images/m-pesa.png" alt="M-Pesa" title="M-Pesa" style="height:28px; width:auto; object-fit:contain;" loading="lazy">
                <img src="{{ROOT}}Images/afri-money.png" alt="Afri Money" title="Afri Money" style="height:44px; width:auto; object-fit:contain;" loading="lazy">
                <img src="{{ROOT}}Images/mastercard.svg" alt="Mastercard" title="Mastercard" style="height:28px; width:auto; object-fit:contain;" loading="lazy">
                <img src="{{ROOT}}Images/visa.svg" alt="Visa" title="Visa" style="height:22px; width:auto; object-fit:contain;" loading="lazy">
            </div>
        </div>
        <div class="flex flex-col md:flex-row justify-between items-center gap-5">
            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 NEWKET — Expérience Luxe</p>
            <div class="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
                <a href="{{ROOT}}src/pages/mentions-legales.html" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Mentions légales</a>
                <a href="{{ROOT}}src/pages/terms.html" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">CGV</a>
                <a href="{{ROOT}}src/pages/privacy.html" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Confidentialité</a>
            </div>
        </div>
    </div>
</footer>`;

const MINIMAL_HEADER_HTML = `<!-- NewKet Minimal Header Component -->
<nav class="main-header newket-header-shell fixed top-0 w-full z-[100] transition-all duration-300" data-header-shell="minimal">
    <div class="relative flex h-[64px] sm:h-[92px] items-center justify-center">
    <a href="{{ROOT}}index.html" class="flex items-center group py-2" title="Retour à l'accueil">
        <img src="https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572408/newket_assets/racine/Logo_NewKet_Pour_Les_HEADERs_Only.png" alt="NewKet" width="320" height="96" class="header-brand-image h-12 sm:h-20 w-auto object-contain transition-transform group-hover:scale-105" onerror="this.src='https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572406/newket_assets/racine/Logo_Header_Officiel_PNG.png'; this.onerror=null;">
    </a>
    <div class="absolute right-4 items-center hidden sm:flex text-white/40">
        <iconify-icon icon="solar:lock-password-bold" width="18"></iconify-icon>
        <span class="text-[10px] uppercase font-bold tracking-widest ml-1">Sécurisé</span>
    </div>
    </div>
</nav>`;

const getBottomNavHTML = (role) => {
    const isSeller = role === 'seller' || role === 'supplier';
    const isAdmin = role === 'admin';
    
    return `<!-- Liquid Glass Bottom Navbar -->
<nav class="liquid-glass-nav fixed bottom-0 w-full z-[9999] flex items-center justify-around px-4 py-3 sm:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-3xl">
    <a href="{{ROOT}}index.html" data-bottom-nav-item="home" class="nav-item flex flex-col items-center justify-center gap-1 text-white hover:text-white/80 transition-all active:scale-95" aria-label="Accueil">
        <iconify-icon icon="solar:home-smile-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Accueil</span>
    </a>
    <a href="#" id="bottomNavSearchBtn" data-bottom-nav-item="search" onclick="event.preventDefault(); const sc = document.getElementById('mobileSearchContainer'); sc.classList.toggle('user-hidden-on-mobile'); if (!sc.classList.contains('user-hidden-on-mobile')) setTimeout(() => document.getElementById('searchInput').focus(), 50);" class="nav-item flex flex-col items-center justify-center gap-1 text-white hover:text-white/80 transition-all active:scale-95" aria-label="Recherche">
        <iconify-icon icon="solar:magnifer-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Recherche</span>
    </a>
    ${isSeller ? `
    <a href="{{ROOT}}src/pages/publish.html" data-bottom-nav-item="sell" class="nav-item-sell relative flex flex-col items-center justify-center -mt-5 publish-btn" aria-label="Vendre" data-track-action="navigation:publish_click">
        <span class="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#0A4A2E] to-[#1a7a4e] shadow-[0_4px_20px_rgba(10,74,46,0.5)] border-[3px] border-white/20 transition-transform active:scale-90 hover:scale-105">
            <iconify-icon icon="solar:add-circle-bold" width="28" class="text-white"></iconify-icon>
        </span>
        <span class="text-[9px] font-bold tracking-wide text-white mt-1">Vendre</span>
    </a>` : `
    <a href="{{ROOT}}src/pages/shops.html" data-bottom-nav-item="shops" class="nav-item flex flex-col items-center justify-center gap-1 text-white hover:text-white/80 transition-all active:scale-95" aria-label="Boutiques">
        <iconify-icon icon="solar:shop-2-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Boutique</span>
    </a>`}
    ${!isAdmin ? `
    <a href="#" data-bottom-nav-item="cart" onclick="event.preventDefault(); window.CartManager && window.CartManager.toggleCartUI();" class="nav-item relative flex flex-col items-center justify-center gap-1 text-white hover:text-white/80 transition-all active:scale-95" aria-label="Panier">
        <iconify-icon icon="solar:cart-large-minimalistic-linear" width="22"></iconify-icon>
        <span class="cart-badge absolute -top-1 right-1 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold" style="display:none; width:16px; height:16px;">0</span>
        <span class="text-[9px] font-medium tracking-wide">Panier</span>
    </a>` : ''}
    <a id="accountLinkMobileBottom" href="{{ROOT}}{{ACCOUNT_PATH}}" data-bottom-nav-item="account" class="nav-item flex flex-col items-center justify-center gap-1 text-white hover:text-white/80 transition-all active:scale-95" aria-label="Profil">
        <iconify-icon icon="solar:user-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Profil</span>
    </a>
</nav>`;
};

const ComponentLoader = {
    async init() {
        if (window.componentsLoading) return;
        window.componentsLoading = true;

        // Determine current page status
        const currentPath = window.location.pathname;
        const isMinimalPage = currentPath.includes('/login') || currentPath.includes('/publish');
        const isAdminPage = currentPath.includes('/admin/') || currentPath.endsWith('/admin') || currentPath.includes('/pages/admin/');
        const isDashboardPage = currentPath.includes('-dashboard');

        // If there is no active Supabase session, do not let stale role/email values
        // drive the UI (e.g. linking guests to vendor/admin surfaces). Keep buyer
        // interface as the default for guests.
        this.sanitizeGuestAuthState().then(() => {
            // Once sanitized, if the auth state has changed, update links
            if (window.AuthManager) {
                window.AuthManager.updateAccountLink();
            }
        });

        const componentsToLoad = [];

        if (isAdminPage) {
            // Admin pages are handled entirely by admin-layout.js
            // Do not inject consumer header, footer, or mobile nav.
        } else if (isMinimalPage) {
            componentsToLoad.push(
                this.loadComponent('header-placeholder', 'components/header-minimal.html', MINIMAL_HEADER_HTML)
            );
        } else {
            componentsToLoad.push(
                this.loadComponent('header-placeholder', 'components/header.html', HEADER_HTML)
            );

            // CategoryNav supprimé — navigation via le menu burger
        } // end else (standard page)

        if (!isMinimalPage && !isAdminPage && !isDashboardPage) {
            componentsToLoad.push(
                this.loadComponent('footer-placeholder', 'components/footer.html', FOOTER_HTML)
            );

            let mobileNavPlaceholder = document.getElementById('mobile-nav-placeholder');
            if (!mobileNavPlaceholder) {
                mobileNavPlaceholder = document.createElement('div');
                mobileNavPlaceholder.id = 'mobile-nav-placeholder';
                document.body.appendChild(mobileNavPlaceholder);
            }
            
            let userRole = 'buyer';
            try {
                userRole = localStorage.getItem('newketRole') || 'buyer';
            } catch (e) {}

            componentsToLoad.push(
                this.loadComponent('mobile-nav-placeholder', '', getBottomNavHTML(userRole))
            );
        }

        await Promise.all(componentsToLoad);
        this.loadSearchCategories();
        this.bindGlobalActions();
        this.applyConfiguredSocialLinks();
        window.addEventListener('configUpdated', () => this.applyConfiguredSocialLinks());
        this.attachCategoryNavToHeader();
        this.initCategoryNavScroll();

        // Disabled auto‑move of #categoryNav into the fixed header so it scrolls separately.
        // regardless of whether the page provides a dedicated placeholder.

        // Set global flag to avoid race conditions
        window.componentsLoaded = true;

        // Dispatch event when components are ready
        window.dispatchEvent(new CustomEvent('componentsLoaded'));

        if (window.AuthManager) {
            AuthManager.enforcePermissions();
            AuthManager.updateAccountLink();
        }

        // Show seller-only UI elements when role is seller/supplier
        this.updateSellerUI();
        // Retry after AuthManager has likely resolved the role
        setTimeout(() => this.updateSellerUI(), 1500);
        // React to window resize for responsive header button
        window.addEventListener('resize', () => this.updateSellerUI());
        if (window.FavoritesManager) FavoritesManager.updateUI();
        if (window.CurrencyManager) CurrencyManager.updateCurrencyUI();
        if (window.SearchManager) SearchManager.init();

        // Load newsletter manager for footer form
        if (!window.NewsletterManager) {
            const script = document.createElement('script');
            script.src = this.getAdjustedPath('/js/newsletter.js');
            document.head.appendChild(script);
        }

        // Load cart manager globally
        if (!window.CartManager) {
            const script = document.createElement('script');
            script.src = this.getAdjustedPath('/js/cart.js');
            document.head.appendChild(script);
        }

        // Load Cookie Consent globally
        if (!window.cookieConsent) {
            const script = document.createElement('script');
            script.src = this.getAdjustedPath('/cookie-consent.js');
            document.head.appendChild(script);
        }

        this.initNetworkStatus();
        this.initMobileSearchToggle();

        setTimeout(() => this.setupHeaderSpacing(), 50);
    },

    initCategoryNavScroll() {
        const nav = document.getElementById('categoryNavContainer');
        const btnLeft = document.getElementById('catNavScrollLeft');
        const btnRight = document.getElementById('catNavScrollRight');
        const fadeLeft = document.getElementById('catNavFadeLeft');
        const fadeRight = document.getElementById('catNavFadeRight');

        if (!nav || !btnLeft || !btnRight) return;

        const SCROLL_STEP = 220;

        const refresh = () => {
            const canScrollLeft = nav.scrollLeft > 4;
            const canScrollRight = nav.scrollLeft < nav.scrollWidth - nav.clientWidth - 4;
            const hasOverflow = nav.scrollWidth > nav.clientWidth;

            // Show/hide arrows only when there's overflow
            btnLeft.classList.toggle('hidden', !hasOverflow || !canScrollLeft);
            btnRight.classList.toggle('hidden', !hasOverflow || !canScrollRight);
            if (fadeLeft) fadeLeft.classList.toggle('hidden', !hasOverflow || !canScrollLeft);
            if (fadeRight) fadeRight.classList.toggle('hidden', !hasOverflow || !canScrollRight);
        };

        btnLeft.addEventListener('click', () => nav.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' }));
        btnRight.addEventListener('click', () => nav.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' }));
        nav.addEventListener('scroll', refresh, { passive: true });
        window.addEventListener('resize', refresh, { passive: true });

        // Run after icons are likely rendered
        refresh();
        setTimeout(refresh, 600);
    },

    initMobileSearchToggle() {
        // Hides mobile search when clicking or touching outside (fixes iOS delegation bug)
        const hideSearchIfOutside = (e) => {
            const searchContainer = document.getElementById('mobileSearchContainer');
            const searchBtn = document.getElementById('bottomNavSearchBtn');
            
            if (searchContainer && searchBtn && window.innerWidth <= 1023) {
                // If it's currently visible
                if (!searchContainer.classList.contains('user-hidden-on-mobile')) {
                    // And the click was outside both the container and the button
                    if (!searchContainer.contains(e.target) && !searchBtn.contains(e.target)) {
                        searchContainer.classList.add('user-hidden-on-mobile');
                    }
                }
            }
        };

        document.addEventListener('click', hideSearchIfOutside);
        document.addEventListener('touchstart', hideSearchIfOutside, { passive: true });
    },

    initNetworkStatus() {
        const updateNetworkStatus = () => {
            const isOnline = navigator.onLine;
            
            // 1. Update network status icons (headers, etc.)
            document.querySelectorAll('.network-status-icon').forEach(el => {
                if (isOnline) {
                    el.classList.add('hidden');
                } else {
                    el.classList.remove('hidden');
                }
            });

            // 2. Smart disable of critical form buttons
            document.querySelectorAll('button[type="submit"], [data-require-network="true"]').forEach(btn => {
                // Ignore buttons that explicitly shouldn't be disabled this way
                if (btn.hasAttribute('data-ignore-network')) return;

                if (isOnline) {
                    // Restore original state
                    if (btn.dataset.originalText) {
                        btn.innerHTML = btn.dataset.originalText;
                    }
                    btn.disabled = false;
                    btn.classList.remove('offline-disabled', 'cursor-not-allowed', 'opacity-60');
                } else {
                    // Save original state and show offline state
                    if (!btn.dataset.originalText) {
                        btn.dataset.originalText = btn.innerHTML;
                    }
                    btn.disabled = true;
                    btn.classList.add('offline-disabled', 'cursor-not-allowed', 'opacity-60');
                    
                    // Show a nice offline indicator with an icon inside the button
                    btn.innerHTML = `<div class="flex items-center justify-center gap-2"><iconify-icon icon="mdi:wifi-off" width="20"></iconify-icon><span>Hors ligne</span></div>`;
                }
            });
        };
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();
    },

    updateSellerUI() {
        const role = window.AuthManager?.role || localStorage.getItem('newketRole') || '';
        const isSeller = role === 'seller' || role === 'supplier';
        
        document.querySelectorAll('.seller-ui-element').forEach(el => {
            if (isSeller) {
                // Show: remove inline hide, set flex display for header buttons
                el.style.removeProperty('display');
                // For header button: use flex on md+, hide on mobile
                if (el.closest('.header-search-row')) {
                    el.style.display = window.innerWidth >= 640 ? 'flex' : 'none';
                }
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        });

        document.querySelectorAll('.non-seller-ui-element').forEach(el => {
            if (isSeller) {
                el.style.setProperty('display', 'none', 'important');
            } else {
                el.style.removeProperty('display');
            }
        });
    },

    async sanitizeGuestAuthState() {
        try {
            if (!window.SupabaseAdapter || typeof window.SupabaseAdapter.getSession !== 'function') return;

            // During the initial auth bootstrap, AuthManager is the source of truth.
            // Avoid probing Supabase from the component loader while the auth client
            // is still resolving its own session state, which can trigger lock contention.
            if (window.AuthManager && window.AuthManager._authChecking !== false && !window.AuthManager._initialized) {
                return;
            }

            const session = await window.SupabaseAdapter.getSession(800);
            this._initialHasSession = !!session;
            if (session) return;

            // Targeted cleanup: preserve non-auth state like cart or UI prefs.
            const authKeysToRemove = [
                'newketRole',
                'newketUserEmail',
                'newketUserStatus',
                'newketPendingRoleChoice',
                'newketRoleSelectionConfirmed',
                'newketUserAvatar'
            ];
            authKeysToRemove.forEach((key) => {
                try { localStorage.removeItem(key); } catch { /* ignore */ }
            });
        } catch {
            // ignore (keep best-effort behavior)
        }
    },

    /**
     * Moves the category nav inside the fixed header so the header + category nav behave like one block.
     * This avoids visible gaps from shadows/rounding differences on light pages.
     */
    async loadSearchCategories() {
        try {
            const apiBase = window.API_BASE || '/api';
            const response = await fetch(`${apiBase}/products/categories/ranked`);
            if (!response.ok) return;
            const data = await response.json();
            if (!data.success || !data.categories) return;

            const select = document.getElementById('mobileSearchCategorySelect');
            const menuList = document.getElementById('searchCategoryMenuList');

            if (select) {
                select.innerHTML = '<option value="all">Tout</option>';
                data.categories.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.category;
                    option.textContent = c.category;
                    select.appendChild(option);
                });
            }

            if (menuList) {
                menuList.innerHTML = '<button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900 rounded-xl" data-value="all">Tout</button>';
                data.categories.forEach(c => {
                    const btn = document.createElement('button');
                    btn.className = 'category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900';
                    btn.dataset.value = c.category;
                    btn.textContent = c.category;
                    menuList.appendChild(btn);
                });
            }
        } catch (e) {
            console.error('Failed to load search categories:', e);
        }
    },

    attachCategoryNavToHeader() {
        const catNav = document.getElementById('categoryNav');
        const searchContainer = document.getElementById('mobileSearchContainer');
        if (catNav && searchContainer) {
            // Nothing to do for now, handled via layout
        }
        const header = document.querySelector('.main-header');
        const nav = document.getElementById('categoryNav');
        if (!header || !nav) return;

        if (nav.parentElement === header) return;

        try {
            header.appendChild(nav);
            const placeholder = document.getElementById('category-nav-placeholder');
            if (placeholder && placeholder.children.length === 0) {
                placeholder.remove();
            }
        } catch {
            // ignore
        }
    },

    bindGlobalActions() {
        if (this.globalActionsBound) return;
        this.globalActionsBound = true;

        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-action]');
            if (!trigger) return;

            const action = trigger.dataset.action;
            if (action === 'logout') {
                event.preventDefault();
                if (window.AuthManager) AuthManager.handleLogoutClick(trigger);
                return;
            }

            if (action === 'install-app') {
                event.preventDefault();
                if (window.AppNotifications) AppNotifications.promptInstall();
            }
        });
    },

    normalizeSocialUrl(value, network) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        const handle = raw.replace(/^@/, '');
        if (network === 'instagram') return `https://www.instagram.com/${handle}`;
        if (network === 'facebook') return `https://www.facebook.com/${handle}`;
        if (network === 'x') return `https://x.com/${handle}`;
        if (network === 'linkedin') return `https://www.linkedin.com/in/${handle}`;
        return `https://${raw}`;
    },

    applyConfiguredSocialLinks() {
        const defaults = {
            instagram: 'https://www.instagram.com/benimakiese007',
            facebook: 'https://www.facebook.com/Benimakiese007',
            x: 'https://x.com/lephoenixman',
            linkedin: 'https://www.linkedin.com/company/newket'
        };
        const configLinks = window.ConfigManager?.getConfig?.().socialLinks || {};
        const links = {
            instagram: configLinks.instagram || defaults.instagram,
            facebook: configLinks.facebook || defaults.facebook,
            x: configLinks.x || configLinks.twitter || defaults.x,
            linkedin: configLinks.linkedin || defaults.linkedin
        };

        Object.entries(links).forEach(([network, href]) => {
            const normalizedHref = this.normalizeSocialUrl(href, network);
            document.querySelectorAll(`[data-social-link="${network}"]`).forEach((anchor) => {
                const safeHref = window.safeUrl ? window.safeUrl(normalizedHref) : normalizedHref;
                anchor.href = safeHref || defaults[network];
                anchor.classList.toggle('hidden', !safeHref);
            });
        });
    },

    /**
     * Ensures page content is not hidden behind the fixed header.
     */
    setupHeaderSpacing() {
        const adjust = () => {
            const header = document.querySelector('.main-header');
            const placeholder = document.getElementById('header-placeholder');
            if (!header || !placeholder) return;

            // Separate read and write to avoid forced reflows
            requestAnimationFrame(() => {
                // DOM READ
                const rect = header.getBoundingClientRect();
                // Use rect.bottom instead of offsetHeight to account for transforms and subpixel rounding.
                const height = Math.max(0, Math.round(rect.bottom));
                if (height === 0) return;

                requestAnimationFrame(() => {
                    // DOM WRITE
                    document.documentElement.style.setProperty('--header-height', `${height}px`);
                    placeholder.style.minHeight = `${height}px`;
                    const spacer = document.getElementById('dynamic-header-spacer');
                    if (spacer) spacer.remove();
                    document.documentElement.style.scrollPaddingTop = `${height + 20}px`;
                });
            });
        };

        adjust();
        // Extra passes to catch late-loading assets (logo/font) on mobile browsers
        requestAnimationFrame(adjust);
        setTimeout(adjust, 250);
        window.addEventListener('load', adjust, { once: true });
        if (document.fonts?.ready) {
            document.fonts.ready.then(adjust).catch(() => {});
        }
        window.addEventListener('resize', adjust);
        
        // Observer for dynamic header changes (e.g. banners)
        const header = document.querySelector('.main-header');
        if (header && window.ResizeObserver && !this.headerResizeObserver) {
            this.headerResizeObserver = new ResizeObserver(adjust);
            this.headerResizeObserver.observe(header);
        }
    },

    async loadComponent(elementId, path, fallbackHTML = '') {
        const element = document.getElementById(elementId);
        if (!element) return;

        // If the element already has content (pre-injected by Vite at build time),
        // just re-process its innerHTML for dynamic tokens (AUTH_ONLY, ACCOUNT_PATH, etc.)
        // This avoids FOUC: the nav is visible instantly without waiting for JS.
        if (element.children.length > 0) {
            this.injectHTML(element, element.innerHTML);
            return;
        }

        // Use inline HTML directly to avoid 404 errors and speed up loading
        if (fallbackHTML) {
            this.injectHTML(element, fallbackHTML);
            return;
        }

        try {
            // Adjust path based on current directory depth
            const adjustedPath = this.getAdjustedPath(path);
            const response = await fetch(adjustedPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const html = await response.text();
            
            // SECURITY: Check if the fetched content is actually a full page (fallback)
            // If it contains <!DOCTYPE or <html, it's a server fallback and shouldn't be injected
            if (html.toLowerCase().includes('<!doctype') || html.toLowerCase().includes('<html')) {
                throw new Error(`Fetched content for ${path} appears to be a full HTML document (likely a fallback).`);
            }
            
            this.injectHTML(element, html);
        } catch (error) {
            console.error(`[NewKet] Failed to load component ${path}:`, error);
        }
    },

    injectHTML(element, html) {
        // Replace {{ROOT}} placeholder with actual relative path prefix
        const rootPrefix = this.getAdjustedPath('');
        
        // --- NEW: Sync Account Path Resolution ---
        const hasSession = !!window.AuthManager?.user || !!this._initialHasSession;
        const role = window.AuthManager?.role || (hasSession ? localStorage.getItem('newketRole') : null);
        let accountPath = 'src/pages/login.html';
        
        if (hasSession && role) {
            if (role === 'admin') accountPath = 'src/pages/admin/index.html';
            else if (role === 'supplier') accountPath = 'src/pages/vendor-dashboard.html';
            else accountPath = 'src/pages/customer-dashboard.html';
        }

        // Resolve AUTH_ONLY blocks: show content only for authenticated users
        const authOnlyRegex = /\{\{AUTH_ONLY_START\}\}([\s\S]*?)\{\{AUTH_ONLY_END\}\}/g;
        const resolvedHTML = hasSession
            ? html.replace(authOnlyRegex, '$1')
            : html.replace(authOnlyRegex, '');

        let processedHTML = resolvedHTML
            .replace(/{{ROOT}}/g, '/')
            .replace(/{{ACCOUNT_PATH}}/g, accountPath);
        
        element.innerHTML = processedHTML;
        // Execute any inline scripts injected
        const scripts = element.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });

        // Dark mode removed: no theme sync required.
    },

    getAdjustedPath(path) {
        // Standardize to root-relative paths for consistent behavior across all levels.
        const root = '/';
        
        // If the path is empty, #, or root relative, handle accordingly
        if (!path || path === '#' || path === './') {
            return root + 'index.html';
        }

        // If it's an absolute URL or javascript:, return it as is.
        if (path.startsWith('/') || path.startsWith('http') || path.startsWith('javascript:')) {
            return path;
        }

        // Standardize path: remove redundant ./ or leading /
        let cleanPath = path.replace(/^\.\//, '').replace(/^\/+/, '');
        
        // Handle special redirects / shortcuts
        if (cleanPath === 'admin' || cleanPath === 'admin/') {
            cleanPath = 'pages/admin/index.html';
        }

        // Separate query string if present
        let query = '';
        if (cleanPath.includes('?')) {
            const parts = cleanPath.split('?');
            cleanPath = parts[0];
            query = '?' + parts[1];
        }

        // Ensure index/404 are relative to root
        if (cleanPath === 'index' || cleanPath === '404' || cleanPath === 'index.html' || cleanPath === '404.html') {
            if (!cleanPath.endsWith('.html')) cleanPath += '.html';
            return root + cleanPath + query;
        }

        // If it starts with assets/ or public/, ensure it's in src/ (legacy check)
        if (cleanPath.startsWith('assets/')) {
            return root + 'src/' + cleanPath + query;
        }
        if (cleanPath.startsWith('public/')) {
            return root + cleanPath + query; // public is usually root
        }

        // Everything else that doesn't start with src/ or pages/ is likely in pages/
        if (!cleanPath.startsWith('src/') && !cleanPath.startsWith('pages/')) {
            cleanPath = 'pages/' + cleanPath;
        }

        // Ensure src/ prefix
        if (!cleanPath.startsWith('src/')) {
            cleanPath = 'src/' + cleanPath;
        }

        // Add .html if missing (and it's not a folder or doesn't have an extension)
        if (!cleanPath.includes('.') && !cleanPath.endsWith('/')) {
            cleanPath += '.html';
        }

        return root + cleanPath + query;
    }
};

window.ComponentLoader = ComponentLoader;

// Auto-init: guard against DOMContentLoaded already having fired (ES module behavior)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ComponentLoader.init());
} else {
    // DOM is already ready (module evaluated after DOMContentLoaded)
    ComponentLoader.init();
}


}
