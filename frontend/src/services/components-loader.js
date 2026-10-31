if (!window.ComponentLoader) {

/* NewKet EMarket Component Loader */

/**
 * Header HTML inlined to avoid CORS issues with file:// protocol.
 * When served via HTTP, fetch is used instead.
 */
const CATEGORY_NAV_HTML_TEMPLATE = ``;

const HEADER_HTML = `
    <!-- Main header container -->
    <nav class="bg-newket-header main-header newket-header-shell fixed top-0 w-full z-[100] transition-all duration-300" data-header-shell="main">
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
                    <a href="{{ROOT}}" aria-label="Retour à l'accueil NewKet" title="Accueil NewKet" class="header-logo-link flex-shrink-0 flex items-center py-1 sm:static z-10 transition-transform duration-300">
                        <img src="{{ROOT}}Images/Logo_NewKet_Pour_Les_HEADERs_Only.png" alt="NewKet" width="320" height="96"
                            data-site-logo="header"
                            class="header-brand-image h-8 sm:h-14 w-auto object-contain"
                            onerror="this.src='{{ROOT}}Images/Logo_Header_Officiel_PNG.png'; this.onerror=null;">
                    </a>
                </div>

                <!-- Right Icons (Mobile) — col droite -->
                <div class="flex items-center gap-2 justify-end sm:hidden">
                    <!-- Offline Network Status Icon (Mobile) -->
                    <div class="network-status-icon hidden flex items-center justify-center text-red-500 bg-red-500/20 h-8 w-8 rounded-lg border border-red-500/30" title="Vous êtes hors ligne">
                        <iconify-icon icon="mdi:wifi-off" width="18"></iconify-icon>
                    </div>

                    <!-- Search Icon (Mobile) — toggle la search bar -->
                    <button id="mobileHeaderSearchBtn"
                        class="header-icon-button p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                        title="Rechercher" aria-label="Rechercher"
                        onclick="const sc = document.getElementById('mobileSearchContainer'); sc.classList.toggle('user-hidden-on-mobile');
                    if (sc.classList.contains('user-hidden-on-mobile')) {
                        // On ferme la recherche : nettoyer immediatement les suggestions
                        window.SearchManager?.closeSearchOverlay?.();
                        const ss = document.getElementById('searchSuggestions');
                        if (ss) { ss.classList.remove('active'); ss.innerHTML = ''; }
                    } if (!sc.classList.contains('user-hidden-on-mobile')) setTimeout(() => document.getElementById('searchInput')?.focus(), 50);">
                        <iconify-icon icon="solar:magnifer-linear" width="22" class="text-white"></iconify-icon>
                    </button>
                </div>
            </div>

            <!-- Search Bar (Full width on mobile, centered on desktop) -->
            <div id="mobileSearchContainer" 
                class="header-search-row user-hidden-on-mobile sm:flex flex-none w-full sm:flex-[1_1_720px] sm:mx-4 lg:mx-8 relative group flex-row flex-nowrap gap-3 sm:gap-4 items-center min-w-0"
                style="max-width: 720px;">
                <div class="search-bar relative">
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
                        <div id="searchCategoryMenu" class="hidden absolute top-full left-0 mt-2 w-48 bg-white/85 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-100 z-[100] overflow-hidden">
                            <div class="py-2" id="searchCategoryMenuList">
                                <button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900 rounded-xl" data-value="all">Tout</button>
                                <!-- Dynamic Categories -->
                            </div>
                        </div>
                    </div>

                    <input type="text" id="searchInput" name="search" placeholder="Rechercher sur NewKet..." aria-label="Rechercher des produits"
                        class="search-input" autocomplete="off" spellcheck="false" style="padding-right: 40px;">
                        
                    <!-- 🧠 Bouton Google Lens -->
                        <label id="lens-btn" for="lens-input" role="button" tabindex="0" aria-label="Rechercher par image" class="lens-button absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5 rounded-full hover:bg-slate-100 cursor-pointer transition-colors z-[100]" title="Recherche par image (Google Lens)">
                            <iconify-icon icon="solar:camera-linear" width="18" class="text-white"></iconify-icon>
                        </label>
                    <input type="file" id="lens-input" accept="image/*" class="hidden">

                    <div id="searchSuggestions" class="search-suggestions"></div>
                </div>

                <!-- Publish Button (seller only - shown via JS) -->
                <a href="{{ROOT}}publish"
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
                <button onclick="event.preventDefault(); window.NotificationManager?.toggleUI ? window.NotificationManager.toggleUI() : window.DrawersManager?.toggleNotifications()"
                    class="header-icon-button relative p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Notifications" aria-label="Voir les notifications">
                    <iconify-icon icon="solar:bell-linear" width="22" class="text-white"></iconify-icon>
                    <span
                        class="notification-badge absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:16px; height:16px; min-width: 16px;">0</span>
                </button>

                <!-- Favorites -->
                <button onclick="event.preventDefault(); window.FavoritesManager?.toggleUI ? window.FavoritesManager.toggleUI() : window.DrawersManager?.toggleFavorites()" class="header-icon-button admin-hidden relative p-2 rounded-lg hover:bg-white/10 transition-colors btn-active-scale"
                    title="Favoris" aria-label="Voir les favoris">
                    <iconify-icon icon="solar:heart-linear" width="22" class="text-white"></iconify-icon>
                    <span
                        class="favorites-badge absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:18px; height:18px;">0</span>
                </button>

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
    class="fixed inset-0 bg-black/50 opacity-0 pointer-events-none transition-opacity duration-300" style="z-index: 9000;" aria-hidden="true"
    onclick="window.closeMobileMenu && window.closeMobileMenu(true)">
</div>
<div id="mobileMenu" class="fixed top-0 left-0 bottom-0 bg-white flex flex-col" style="z-index: 10000;" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Navigation mobile">
    <div class="mobile-menu-header px-4 pb-2 flex items-center justify-between text-white" style="background: #1f2937 !important; padding-top: max(0.5rem, env(safe-area-inset-top));">
        <a href="{{ROOT}}" aria-label="Retour à l'accueil NewKet" class="flex-shrink-0 flex items-center mt-1">
            <img src="{{ROOT}}Images/Logo_NewKet_Pour_Les_HEADERs_Only.png" alt="NewKet" width="160" height="48"
                class="h-8 w-auto object-contain"
                onerror="this.src='{{ROOT}}Images/Logo_Header_Officiel_PNG.png'; this.onerror=null;">
        </a>
        <button id="closeMobileMenu" class="p-1 transition-all btn-active-scale rounded-xl -mr-2 mt-1" aria-label="Fermer le menu">
            <iconify-icon icon="solar:close-circle-bold" width="32" class="text-white"></iconify-icon>
        </button>
    </div>

    <div class="flex-1 overflow-y-auto pt-1 pb-6" style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));">
        <!-- Guest Call to Action -->
        <div id="mobileGuestCTA" class="px-4 mb-6">
            <a href="{{ROOT}}login" class="flex flex-row items-center gap-3 p-4 bg-slate-900 text-white rounded-[1.5rem] text-left group transition-all hover:bg-slate-800">
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
            <a id="mobileLoggedLink" href="{{ROOT}}customer-dashboard" class="flex flex-row items-center gap-3 p-4 bg-slate-900 text-white rounded-[1.5rem] text-left group transition-all hover:bg-slate-800 shadow-xl">
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
                <a href="{{ROOT}}catalog" class="mobile-menu-shortcut-card">
                    <iconify-icon icon="solar:shop-linear" width="20"></iconify-icon>
                    <span>Catalogue</span>
                </a>
                <a href="{{ROOT}}shops" class="mobile-menu-shortcut-card">
                    <iconify-icon icon="solar:shop-2-linear" width="20"></iconify-icon>
                    <span>Boutiques</span>
                </a>
                <a href="{{ROOT}}publish" class="mobile-menu-shortcut-card publish-btn seller-ui-element" data-track-action="navigation:publish_click" style="display:none">
                    <iconify-icon icon="solar:add-circle-bold" width="20"></iconify-icon>
                    <span>Vendre</span>
                </a>
                <a href="{{ROOT}}favorites" onclick="if (!window.location.pathname.includes('/favorites')) { event.preventDefault(); window.SidebarManager?.close?.(); window.DrawersManager?.openFavorites(); }" class="mobile-menu-shortcut-card admin-hidden">
                    <iconify-icon icon="solar:heart-linear" width="20"></iconify-icon>
                    <span>Favoris</span>
                </a>
                <a id="mobileNotificationsShortcut" href="{{ROOT}}notifications" onclick="if (!window.location.pathname.includes('/notifications')) { event.preventDefault(); window.SidebarManager?.close?.(); window.DrawersManager?.openNotifications(); }" class="mobile-menu-shortcut-card" style="display:none">
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
                <a href="{{ROOT}}catalog?category=Femme"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:user-circle-linear" width="20"></iconify-icon> Femme
                </a>
                <a href="{{ROOT}}catalog?category=Homme"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:user-rounded-linear" width="20"></iconify-icon> Homme
                </a>
                <a href="{{ROOT}}catalog?category=Tech & Gadgets"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:laptop-minimalistic-linear" width="20"></iconify-icon> Tech & Gadgets
                </a>
                <a href="{{ROOT}}catalog?category=HIGH-TECH"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:cpu-linear" width="20"></iconify-icon> HIGH-TECH
                </a>
                <a href="{{ROOT}}catalog?category=Art de vivre"
                    class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                    <iconify-icon icon="solar:sofa-linear" width="20"></iconify-icon> Art de vivre
                </a>
                <a href="{{ROOT}}catalog?promo=true"
                    class="mobile-menu-link flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-red-600 font-bold">
                    <iconify-icon icon="solar:fire-bold" width="20"></iconify-icon> Promos
                </a>
            </nav>
            </div>

            <div class="mobile-menu-sections-right">



            <div class="header-quick-links mb-6 border-t border-gray-50 pt-6">
                <h3 class="mobile-menu-section-title">Liens utiles</h3>
                <nav class="flex flex-col gap-1">
                    <a href="{{ROOT}}support"
                        class="mobile-menu-link flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-100/50 text-gray-700 font-medium transition-all active:scale-[0.98]">
                        <iconify-icon icon="solar:help-bold" width="20"></iconify-icon> Support
                    </a>
                    <a href="{{ROOT}}faq"
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
                <div class="currency-switch-segmented origin-left" id="mobileCurrencyToggle" data-active="CDF" role="group" aria-label="Choix de la devise">
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
<footer class="bg-newket-footer newket-footer-shell text-white mt-16 pt-10 pb-7 border-t border-gray-800" style="margin-top: 4rem; padding-top: 2.5rem; padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px));">
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
                    <a href="mailto:newketmarket@gmail.com" onclick="if(window.copyAndAnimateButton) { window.copyAndAnimateButton(event, 'newketmarket@gmail.com'); } else if(window.copyTextToClipboard) { window.copyTextToClipboard('newketmarket@gmail.com'); }" class="flex items-center gap-2 hover:text-white transition-colors break-all" title="Cliquer pour envoyer un email (ou copier l'adresse)">
                        <iconify-icon icon="solar:letter-linear" width="18"></iconify-icon>
                        <span>newketmarket@gmail.com</span>
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
                    <li><a href="{{ROOT}}about" class="text-gray-400 hover:text-white text-sm transition-colors">À propos de nous</a></li>
                    <li><a href="{{ROOT}}seller" class="text-gray-400 hover:text-white text-sm transition-colors">Devenir Vendeur</a></li>
                    <li><a href="{{ROOT}}support" class="text-gray-400 hover:text-white text-sm transition-colors">Support Technique</a></li>
                    <li><a href="{{ROOT}}faq" class="text-gray-400 hover:text-white text-sm transition-colors">FAQ</a></li>
                    {{AUTH_ONLY_START}}<li><a href="{{ROOT}}publish" class="text-gray-400 hover:text-white text-sm transition-colors publish-btn" data-track-action="navigation:publish_click">Vendre un article</a></li>{{AUTH_ONLY_END}}
                </ul>
            </div>
            <div class="lg:col-span-4 space-y-4">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Inspiration & Offres</h4>
                <p class="text-gray-400 text-sm">Inscrivez-vous pour recevoir nos sélections exclusives et avant-premières.</p>
                <form id="newsletterForm" class="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:relative" onsubmit="event.preventDefault(); if (window.handleNewsletterSubmit) { window.handleNewsletterSubmit(event); } else { const msg = this.querySelector('#newsletterMsg'); if (msg) { msg.textContent = 'Merci pour votre inscription !'; msg.className = 'text-xs w-full sm:absolute sm:-bottom-6 sm:left-0 mt-1 sm:mt-2 text-emerald-300'; } }"> 
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
                <a href="{{ROOT}}mentions-legales" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Mentions légales</a>
                <a href="{{ROOT}}terms" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">CGV</a>
                <a href="{{ROOT}}privacy" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Confidentialité</a>
            </div>
        </div>
    </div>
</footer>`;

const MINIMAL_HEADER_HTML = `<!-- NewKet Minimal Header Component -->
<nav class="bg-newket-header main-header newket-header-shell fixed top-0 w-full z-[100] transition-all duration-300" data-header-shell="minimal">
    <div class="relative flex h-16 sm:h-20 items-center justify-center">
    <a href="{{ROOT}}" class="flex items-center group py-2" title="Retour à l'accueil">
        <img src="{{ROOT}}Images/Logo_NewKet_Pour_Les_HEADERs_Only.png" alt="NewKet" width="320" height="96" class="header-brand-image h-8 sm:h-14 w-auto object-contain transition-transform group-hover:scale-105" onerror="this.src='{{ROOT}}Images/Logo_Header_Officiel_PNG.png'; this.onerror=null;">
    </a>
    <div class="absolute right-4 items-center hidden sm:flex text-white/40">
        <iconify-icon icon="solar:lock-password-bold" width="18"></iconify-icon>
        <span class="text-[10px] uppercase font-bold tracking-widest ml-1">Sécurisé</span>
    </div>
    </div>
</nav>`;

const isIOSCapacitor = () => {
    try {
        return !!(window.Capacitor && (
            typeof window.Capacitor.isNativePlatform === 'function'
                ? window.Capacitor.isNativePlatform()
                : window.Capacitor.isNative
        ) && window.Capacitor.getPlatform?.() === 'ios');
    } catch (e) {
        return false;
    }
};

const isAndroidCapacitor = () => {
    try {
        return !!(window.Capacitor && (
            typeof window.Capacitor.isNativePlatform === 'function'
                ? window.Capacitor.isNativePlatform()
                : window.Capacitor.isNative
        ) && window.Capacitor.getPlatform?.() === 'android');
    } catch (e) {
        return false;
    }
};

const getBottomNavHTML = (role, isGuest = false) => {
    const isSeller = role === 'seller' || role === 'supplier';
    const isAdmin  = role === 'admin';
    const useLiquidGlass = isIOSCapacitor();

    // ── Item 3 : Boutiques (défaut) | Vendre (seller) ──────────────────────
    const item3_lg = isSeller
        ? `<a href="{{ROOT}}publish" data-bottom-nav-item="sell" class="nav-item flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95" aria-label="Vendre" data-track-action="navigation:publish_click">
        <iconify-icon icon="solar:add-circle-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Vendre</span>
    </a>`
        : `<a href="{{ROOT}}shops" data-bottom-nav-item="shops" class="nav-item flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95" aria-label="Boutiques">
        <iconify-icon icon="solar:shop-2-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Boutiques</span>
    </a>`;

    const item3_std = isSeller
        ? `<a href="{{ROOT}}publish" data-bottom-nav-item="sell" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Vendre" data-track-action="navigation:publish_click">
            <iconify-icon icon="solar:add-circle-linear" width="22"></iconify-icon>
            <span>Vendre</span>
        </a>`
        : `<a href="{{ROOT}}shops" data-bottom-nav-item="shops" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Boutiques">
            <iconify-icon icon="solar:shop-2-linear" width="22"></iconify-icon>
            <span>Boutiques</span>
        </a>`;

    // ── Item 4 : Notifs (admin) | Panier→login (invité) | Panier→drawer (buyer/seller) ──
    const item4_lg = isAdmin
        ? `<a href="{{ROOT}}notifications" data-bottom-nav-item="notifications" class="nav-item flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95" aria-label="Notifications">
        <iconify-icon icon="solar:bell-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Notifs</span>
    </a>`
        : isGuest
        ? `<a href="{{ROOT}}login" data-bottom-nav-item="cart" class="nav-item flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95" aria-label="Panier">
        <iconify-icon icon="solar:cart-large-minimalistic-linear" width="22"></iconify-icon>
        <span class="text-[9px] font-medium tracking-wide">Panier</span>
    </a>`
        : `<a href="#" data-bottom-nav-item="cart" onclick="event.preventDefault(); window.CartManager && window.CartManager.toggleCartUI();" class="nav-item relative flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-95" aria-label="Panier">
        <iconify-icon icon="solar:cart-large-minimalistic-linear" width="22"></iconify-icon>
        <span class="cart-badge absolute -top-1 right-1 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold" style="display:none; width:16px; height:16px;">0</span>
        <span class="text-[9px] font-medium tracking-wide">Panier</span>
    </a>`;

    const item4_std = isAdmin
        ? `<a href="{{ROOT}}notifications" data-bottom-nav-item="notifications" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Notifications">
            <iconify-icon icon="solar:bell-linear" width="22"></iconify-icon>
            <span>Notifs</span>
        </a>`
        : isGuest
        ? `<a href="{{ROOT}}login" data-bottom-nav-item="cart" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Panier">
            <iconify-icon icon="solar:cart-large-minimalistic-linear" width="22"></iconify-icon>
            <span>Panier</span>
        </a>`
        : `<a href="#" data-bottom-nav-item="cart" onclick="event.preventDefault(); window.CartManager && window.CartManager.toggleCartUI();" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Panier">
            <div class="relative flex items-center justify-center">
                <iconify-icon icon="solar:cart-large-minimalistic-linear" width="22"></iconify-icon>
                <span class="cart-badge absolute -top-1 -right-2 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold" style="display:none; width:16px; height:16px;">0</span>
            </div>
            <span>Panier</span>
        </a>`;

    // ── Liquid Glass (iOS Capacitor : Tab bar 100% native SwiftUI) ─────────
    if (useLiquidGlass) {
        return '<!-- Native SwiftUI TabView Active on iOS -->';
    }

    // ── Standard (Web / PWA / Android) ─────────────────────────────────────
    return `<!-- Standard Mobile Bottom Navbar (Web / PWA / Android) -->
<nav id="mobileBottomNav" class="standard-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200/60 dark:border-gray-700/60 sm:hidden transition-transform duration-300" style="padding-bottom: env(safe-area-inset-bottom, 0px); box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);">
    <div class="relative flex items-stretch justify-around h-[62px] overflow-hidden">
        <a href="{{ROOT}}" data-bottom-nav-item="home" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Accueil">
            <iconify-icon icon="solar:home-smile-linear" width="22"></iconify-icon>
            <span>Accueil</span>
        </a>
        <a href="{{ROOT}}catalog" data-bottom-nav-item="catalog" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Catalogue">
            <iconify-icon icon="solar:shop-linear" width="22"></iconify-icon>
            <span>Catalogue</span>
        </a>
        ${item3_std}
        ${item4_std}
        <a id="accountLinkMobileBottom" href="{{ROOT}}{{ACCOUNT_PATH}}" data-bottom-nav-item="account" class="nav-item relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] text-gray-500 dark:text-gray-400 font-medium text-[10px] py-2 px-1 transition-colors" aria-label="Compte">
            <iconify-icon icon="solar:user-linear" width="22"></iconify-icon>
            <span>Compte</span>
        </a>
    </div>
</nav>`;
};

const ComponentLoader = {
    async init() {
        if (window.componentsLoading) return;
        window.componentsLoading = true;

        // Determine current page status
        const currentPath = window.location.pathname;
        const isRoleChoicePage = currentPath.includes('/choose-role');
        const isMinimalPage = currentPath.includes('/login') || currentPath.includes('/publish') || currentPath.includes('/payment-success') || currentPath.includes('/payment-cancel');
        const isAdminPage = currentPath.includes('/admin/') || currentPath.endsWith('/admin') || currentPath.includes('/pages/admin/');
        const isDashboardPage = currentPath.includes('-dashboard');
        const isHomePage = currentPath === '/' || currentPath.endsWith('/index.html');

        // The role-choice flow is intentionally isolated: while a role is
        // pending, no navigation must give access to the rest of the app.
        if (!isAdminPage && !isRoleChoicePage) {
            this.ensurePlaceholder('header-placeholder', 'start');
        }

        // If there is no active Supabase session, do not let stale role/email values
        // drive the UI (e.g. linking guests to vendor/admin surfaces). Keep buyer
        // interface as the default for guests.
        this.sanitizeGuestAuthState().then(() => {
            // Once sanitized, if the auth state has changed, update links
            if (window.AuthManager) {
                window.AuthManager.updateAccountLink();
            }
        });

        if (isIOSCapacitor()) {
            document.documentElement.classList.add('is-ios-capacitor');
            document.getElementById('mobileBottomNav')?.remove();
            let earlyRole = 'buyer';
            try { earlyRole = localStorage.getItem('newketRole') || 'buyer'; } catch (e) {}
            try {
                window.Capacitor?.Plugins?.NativeTabBar?.setRole?.({ role: earlyRole });
                const hasUser = !!localStorage.getItem('newketUserId');
                const avatar = hasUser ? localStorage.getItem('newketUserAvatar') : null;
                const rawName = localStorage.getItem('newketUserUsername') || localStorage.getItem('newketUserName') || '';
                const init = rawName.trim() ? rawName.trim().charAt(0).toUpperCase() : 'C';
                window.Capacitor?.Plugins?.NativeTabBar?.setProfile?.({
                    isLoggedIn: hasUser,
                    avatarUrl: avatar,
                    initials: init,
                    role: earlyRole
                });
            } catch (_) {}
            // Sur iOS Capacitor, les dashboards (client, vendeur, admin) n'ont pas de TabBar, comme sur Web et Android
            if (isDashboardPage || isAdminPage) {
                try { window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {}); } catch (_) {}
            }
            this.initNativeHeaderButtons();
        }

        if (isAndroidCapacitor()) {
            document.documentElement.classList.add('is-android-capacitor');
        }

        const componentsToLoad = [];

        if (isAdminPage) {
            // Admin pages are handled entirely by admin-layout.js
            // Do not inject consumer header, footer, or mobile nav.
        } else if (isRoleChoicePage) {
            // No header or footer on this blocking decision screen.
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

        if (!isMinimalPage && !isRoleChoicePage && !isAdminPage && !isDashboardPage) {
            if (isHomePage) {
                componentsToLoad.push(
                    this.loadComponent('footer-placeholder', 'components/footer.html', FOOTER_HTML)
                );
            }

            // La navbar standard est pré-injectée dans le DOM par Vite (0ms FOUC pour Web, PWA et Android).
            // Sur iOS natif (Capacitor), on bascule vers le design Liquid Glass.
            // Pour les vendeurs/admins, on adapte également l'onglet dédié (Vendre / Notifs).
            const existingMobileNav = document.getElementById('mobileBottomNav');
            let userRole = 'buyer';
            let isGuest  = false;
            try {
                userRole = localStorage.getItem('newketRole') || 'buyer';
                isGuest  = !localStorage.getItem('newketUserId');
            } catch (e) {}

            const isSellerOrAdmin = userRole === 'seller' || userRole === 'supplier' || userRole === 'admin';
            if (isIOSCapacitor()) {
                // Sur iOS, la Tab Bar est 100% native SwiftUI (Liquid Glass iOS 26)
                document.documentElement.classList.add('is-ios-capacitor');
                if (existingMobileNav) existingMobileNav.remove();
                try {
                    window.Capacitor?.Plugins?.NativeTabBar?.setRole?.({ role: userRole });
                    const hasUser = !isGuest;
                    const avatar = hasUser ? localStorage.getItem('newketUserAvatar') : null;
                    const rawName = localStorage.getItem('newketUserUsername') || localStorage.getItem('newketUserName') || '';
                    const init = rawName.trim() ? rawName.trim().charAt(0).toUpperCase() : 'C';
                    window.Capacitor?.Plugins?.NativeTabBar?.setProfile?.({
                        isLoggedIn: hasUser,
                        avatarUrl: avatar,
                        initials: init,
                        role: userRole
                    });
                } catch (_) {}
                // Inject native header buttons (burger + search/logout) on all pages
                this.initNativeHeaderButtons();
            } else if (existingMobileNav && isSellerOrAdmin) {
                const navHTML = getBottomNavHTML(userRole, isGuest).replace(/\{\{ROOT\}\}/g, this.getAdjustedPath(''));
                existingMobileNav.outerHTML = navHTML;
            } else if (!existingMobileNav) {
                let mobileNavPlaceholder = document.getElementById('mobile-nav-placeholder');
                if (!mobileNavPlaceholder) {
                    mobileNavPlaceholder = document.createElement('div');
                    mobileNavPlaceholder.id = 'mobile-nav-placeholder';
                    document.body.appendChild(mobileNavPlaceholder);
                }

                componentsToLoad.push(
                    this.loadComponent('mobile-nav-placeholder', '', getBottomNavHTML(userRole, isGuest))
                );
            }
        }

        await Promise.all(componentsToLoad);
        // The home page ships a small static fallback for static/PWA-cache
        // failures. It is no longer needed once the real header is available.
        document.getElementById('header-fallback')?.remove();
        await this.loadSearchCategories();
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

        // Si le NotificationManager a déjà chargé les données, on met à jour
        // le badge immédiatement (les .notification-badge sont maintenant dans le DOM).
        if (window.NotificationManager) {
            window.NotificationManager.updateBadge();
        }

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

        // Load drawers manager globally (Favorites & Notifications slide-overs)
        if (!window.DrawersManager) {
            const dScript = document.createElement('script');
            dScript.src = this.getAdjustedPath('/js/drawers.js');
            document.head.appendChild(dScript);
        }

        // Load Cookie Consent globally
        if (!window.cookieConsent) {
            const script = document.createElement('script');
            script.src = this.getAdjustedPath('/cookie-consent.js');
            document.head.appendChild(script);
        }

        this.initNetworkStatus();
        this.initMobileSearchToggle();

        // Auto-open notifications or favorites drawer if redirected
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const openNotifs = urlParams.get('open') === 'notifications' || sessionStorage.getItem('nk_open_notifications_drawer') === 'true';
            const openFavs = urlParams.get('open') === 'favorites' || sessionStorage.getItem('nk_open_favorites_drawer') === 'true';
            const openSearch = urlParams.get('open') === 'search' || sessionStorage.getItem('nk_open_search') === 'true';
            if (openNotifs) {
                sessionStorage.removeItem('nk_open_notifications_drawer');
                if (urlParams.get('open') === 'notifications') {
                    const cleanUrl = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, '', cleanUrl);
                }
                setTimeout(() => {
                    if (window.DrawersManager?.openNotifications) {
                        window.DrawersManager.openNotifications();
                    } else if (window.NotificationManager?.openUI) {
                        window.NotificationManager.openUI();
                    }
                }, 400);
            } else if (openFavs) {
                sessionStorage.removeItem('nk_open_favorites_drawer');
                if (urlParams.get('open') === 'favorites') {
                    const cleanUrl = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, '', cleanUrl);
                }
                setTimeout(() => {
                    if (window.DrawersManager?.openFavorites) {
                        window.DrawersManager.openFavorites();
                    } else if (window.FavoritesManager?.openUI) {
                        window.FavoritesManager.openUI();
                    }
                }, 400);
            } else if (openSearch) {
                sessionStorage.removeItem('nk_open_search');
                if (urlParams.get('open') === 'search') {
                    const cleanUrl = window.location.pathname + window.location.hash;
                    window.history.replaceState({}, '', cleanUrl);
                }
                setTimeout(() => {
                    const sc = document.getElementById('mobileSearchContainer');
                    if (sc) {
                        sc.classList.remove('user-hidden-on-mobile');
                        setTimeout(() => {
                            const input = document.getElementById('searchInput');
                            if (input) {
                                input.focus();
                            }
                        }, 100);
                    }
                }, 350);
            }
        } catch (_) {}

        // setupHeaderSpacing is now called immediately after header injection (in loadComponent).
        // This second pass catches any late-loading assets (fonts, logo) that change the header height.
        setTimeout(() => this.setupHeaderSpacing(), 0);
    },

    ensurePlaceholder(elementId, position = 'end') {
        let element = document.getElementById(elementId);
        if (element || !document.body) return element;

        element = document.createElement('div');
        element.id = elementId;

        if (position === 'start') {
            document.body.insertBefore(element, document.body.firstChild);
        } else {
            document.body.appendChild(element);
        }

        return element;
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
        const FIXED_CATEGORIES = [
            'Mode Femme',
            'Mode Homme',
            'High-Tech & Gadgets',
            'Maison, Déco & Meubles',
            'Bricolage & Construction',
            'Beauté & Santé',
            'Sports & Loisirs',
            'Jouets & Enfants',
            'Culture & Divertissement',
            'Véhicules & Mobilité',
            'Alimentation & Boissons',
            'Animalerie',
            'Autres',
        ];

        const selects = document.querySelectorAll('#mobileSearchCategorySelect');
        const menuLists = document.querySelectorAll('#searchCategoryMenuList');

        selects.forEach(select => {
            select.innerHTML = '<option value="all">Tout</option>';
            FIXED_CATEGORIES.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                select.appendChild(option);
            });
        });

        menuLists.forEach(menuList => {
            menuList.innerHTML = '<button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900 rounded-xl" data-value="all">Tout</button>';
            FIXED_CATEGORIES.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900';
                btn.dataset.value = cat;
                btn.textContent = cat;
                menuList.appendChild(btn);
            });
        });
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


    // -- iOS Native Header Buttons -------------------------------------------
    /**
     * Shows two native Liquid Glass buttons (burger left, search/logout right)
     * floating above the WebView on iOS 26+.
     * Called once per page load when running in iOS Capacitor.
     */
    /**
     * Calculates whether the NativeTabBar should be visible on the current page
     * and applies the correct show/hide state. Safe to call multiple times
     * (e.g. on bfcache pageshow after swipe-back).
     */
    syncNativeTabBarVisibility() {
        const path = window.location.pathname;
        const isAdmin     = path.includes('/admin') || path.includes('/pages/admin');
        const isDashboard = path.includes('-dashboard') || path.includes('dashboard') || isAdmin;
        const isMinimal   = path.includes('/login') || path.includes('/choose-role') || path.includes('/publish') || path.includes('/payment-success') || path.includes('/payment-cancel');
        const isTabBarForbidden = isMinimal || isDashboard;

        if (isTabBarForbidden) {
            window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
        } else {
            window.Capacitor?.Plugins?.NativeTabBar?.show?.().catch(() => {});
        }
    },

    /**
     * Re-shows the native Liquid Glass header buttons after a bfcache restore
     * (iOS swipe-back). Does NOT re-bind any listeners — only updates visibility.
     * Safe to call multiple times.
     */
    syncNativeHeaderButtonsVisibility() {
        const plugin = window.Capacitor?.Plugins?.NativeHeaderButtons;
        if (!plugin) return;

        const path = window.location.pathname;
        const isAdmin     = path.includes('/admin') || path.includes('/pages/admin');
        const isDashboard = path.includes('-dashboard') || path.includes('dashboard') || isAdmin;
        const isMinimal   = path.includes('/login') || path.includes('/choose-role') || path.includes('/publish') || path.includes('/payment-success') || path.includes('/payment-cancel');

        if (isMinimal) {
            // Minimal pages (login, etc.) don't have header buttons
            plugin.hide().catch(() => {});
            return;
        }

        const rightIcon = isDashboard
            ? 'rectangle.portrait.and.arrow.right'
            : 'magnifyingglass';

        // Re-show buttons — pagehide/beforeunload had hidden them
        plugin.show({ showLeft: true, showRight: true, rightIcon }).catch(() => {});
    },

    initNativeHeaderButtons() {
        if (this._nativeHeaderButtonsInitialized) return;
        this._nativeHeaderButtonsInitialized = true;

        const plugin = window.Capacitor?.Plugins?.NativeHeaderButtons;
        if (!plugin) return;

        const path = window.location.pathname;
        const isAdmin     = path.includes('/admin') || path.includes('/pages/admin');
        const isDashboard = path.includes('-dashboard') || path.includes('dashboard') || isAdmin;
        const isMinimal   = path.includes('/login') || path.includes('/choose-role') || path.includes('/publish') || path.includes('/payment-success') || path.includes('/payment-cancel');

        // Initial badge sync for cart on iOS native TabView
        try {
            const rawCart = localStorage.getItem('newket_cart');
            if (rawCart) {
                const parsed = JSON.parse(rawCart);
                const cartCount = Array.isArray(parsed) ? parsed.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0) : 0;
                if (cartCount > 0) {
                    window.Capacitor?.Plugins?.NativeTabBar?.setBadge?.({ tabId: 'cart', count: cartCount });
                }
            }
        } catch (_) {}

        // TabBar interdite sur les dashboards, l'admin et les pages minimales (exactement comme tous les autres supports)
        const isTabBarForbidden = isMinimal || isDashboard;
        const rightIcon = isDashboard
            ? 'rectangle.portrait.and.arrow.right'
            : 'magnifyingglass';

        if (isTabBarForbidden) {
            window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
        }
        if (isMinimal) {
            plugin.hide().catch(() => {});
        }

        // 🍏 Delay native bars appearance until after the splash/launch screen has finished
        const revealNativeBars = () => {
            if (this._nativeBarsRevealed) return;
            this._nativeBarsRevealed = true;

            const isOverlayOpen = isAnyWebOverlayOpen();
            if (!isMinimal && !isOverlayOpen) {
                plugin.show({ showLeft: true, showRight: true, rightIcon }).catch(() => {});
            }
            if (!isTabBarForbidden && !isOverlayOpen) {
                window.Capacitor?.Plugins?.NativeTabBar?.show?.().catch(() => {});
            } else if (isTabBarForbidden) {
                window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
            }
        };

        // 🍏 iOS bfcache swipe-back: re-evaluate TabBar visibility on every pageshow
        // because _nativeHeaderButtonsInitialized blocks re-init, but the page
        // that hid the TabBar (e.g. /product) may have left it hidden.
        window.addEventListener('pageshow', (e) => {
            // persisted = true means the page was restored from bfcache (swipe-back)
            if (e.persisted) {
                this.syncNativeTabBarVisibility();
                // Re-show Liquid Glass header buttons hidden by beforeunload/pagehide
                this.syncNativeHeaderButtonsVisibility();
            }
        });

        if (window.newketInitialized || window.componentsLoaded || document.readyState === 'complete') {
            setTimeout(revealNativeBars, 80);
        } else {
            window.addEventListener('componentsLoaded', () => setTimeout(revealNativeBars, 150), { once: true });
            window.addEventListener('newketReady', () => setTimeout(revealNativeBars, 150), { once: true });
            setTimeout(revealNativeBars, 1600); // Safety fallback matching splash screen duration
        }

        // ------------------------------------------------------------------
        // Auto-hide / auto-show when a web overlay (sidebar, panier, drawer)
        // opens or closes. Since our native overlay sits on top of WKWebView,
        // it must be hidden while any web panel is visible.
        // ------------------------------------------------------------------
        const isAnyWebOverlayOpen = () => {
            if (window.SidebarManager?.state?.isDrawerOpen) return true;
            const menu = document.getElementById('mobileMenu');
            if (menu && (menu.classList.contains('active') || document.body.classList.contains('mobile-menu-open') || document.documentElement.classList.contains('mobile-menu-open') || menu.getAttribute('aria-hidden') === 'false' || menu.style.visibility === 'visible' || menu.style.opacity === '1')) return true;
            const cart = document.getElementById('cartSlideOver');
            if (cart && (!cart.classList.contains('translate-x-full') || (cart.parentElement && !cart.parentElement.classList.contains('hidden') && !cart.classList.contains('translate-x-full')))) return true;
            const fav = document.getElementById('favoritesSlideOver');
            if (fav && !fav.classList.contains('translate-x-full')) return true;
            const notif = document.getElementById('notificationsSlideOver');
            if (notif && !notif.classList.contains('translate-x-full')) return true;
            const adminSb = document.getElementById('adminSidebar');
            if (adminSb && adminSb.classList.contains('translate-x-0') && window.innerWidth < 1024) return true;
            const vendorSb = document.getElementById('vendorSidebar');
            if (vendorSb && vendorSb.classList.contains('translate-x-0') && window.innerWidth < 1024) return true;
            const customerSb = document.getElementById('customerSidebar');
            if (customerSb && customerSb.classList.contains('translate-x-0') && window.innerWidth < 1024) return true;
            const searchContainer = document.getElementById('mobileSearchContainer');
            if (searchContainer && !searchContainer.classList.contains('user-hidden-on-mobile') && window.innerWidth < 1024) return true;
            const zoom = document.getElementById('zoomModal') || document.getElementById('imageZoomModal');
            if (zoom && (!zoom.classList.contains('hidden') && zoom.style.display !== 'none')) return true;
            const modal = document.querySelector('.nk-modal-overlay, #nk-announcement-modal, .modal:not(.hidden), [data-modal]:not(.hidden), #orderModal:not([style*="display: none"]), #orderSuccessOverlay, #paymentSuccessOverlay');
            if (modal) return true;
            return false;
        };

        let _isOverlayActive = false;
        let _lastCloseConfigKey = '';
        let _overlayDebounceTimer = null;

        const _getOverlayCloseConfig = () => {
            const fav = document.getElementById('favoritesSlideOver');
            if (fav && !fav.classList.contains('translate-x-full')) {
                return { position: 'top-right', actionIcon: 'trash', actionType: 'clearFavorites' };
            }
            const notif = document.getElementById('notificationsSlideOver');
            if (notif && !notif.classList.contains('translate-x-full')) {
                return { position: 'top-right', actionIcon: 'checkmark', actionType: 'markAllRead' };
            }
            return { position: 'top-right' };
        };

        const _hideButtons = () => {
            const isSuccessOverlay = document.getElementById('orderSuccessOverlay') || document.getElementById('paymentSuccessOverlay');
            if (isSuccessOverlay) {
                _isOverlayActive = true;
                plugin.update({ showLeft: false, showRight: false }).catch(() => {});
                plugin.hideClose?.().catch?.(() => {});
                window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
                return;
            }
            const cfg = _getOverlayCloseConfig();
            const cfgKey = `${cfg.position}_${cfg.actionIcon || ''}`;
            if (_isOverlayActive && _lastCloseConfigKey === cfgKey) return;
            _isOverlayActive = true;
            _lastCloseConfigKey = cfgKey;
            plugin.update({ showLeft: false, showRight: false }).catch(() => {});
            plugin.showClose?.(cfg)?.catch?.(() => {});
            window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
        };

        const _showButtons = () => {
            if (!_isOverlayActive) return;
            _isOverlayActive = false;
            _lastCloseConfigKey = '';
            plugin.hideClose?.()?.catch?.(() => {});
            if (!isMinimal) {
                plugin.update({ showLeft: true, showRight: true }).catch(() => {});
            }
            if (!isTabBarForbidden) {
                window.Capacitor?.Plugins?.NativeTabBar?.show?.().catch(() => {});
            }
        };


        // 🍏 Disparition instantanée lors d'un changement de page pour ne jamais laisser de bouton fantôme traîner
        window.addEventListener('beforeunload', () => {
            plugin.hide().catch(() => {});
            plugin.hideClose?.().catch?.(() => {});
        });
        window.addEventListener('pagehide', () => {
            plugin.hide().catch(() => {});
            plugin.hideClose?.().catch?.(() => {});
        });

        // Global events that web layers dispatch when they open/close
        window.addEventListener('nativeOverlayOpen',  _hideButtons);
        window.addEventListener('nativeOverlayClose', _showButtons);

        // Debounced observer: only react when overlay state actually flips
        const bodyOverlayObserver = new MutationObserver(() => {
            if (_overlayDebounceTimer) clearTimeout(_overlayDebounceTimer);
            _overlayDebounceTimer = setTimeout(() => {
                const isOpen = isAnyWebOverlayOpen();
                if (isOpen) {
                    _hideButtons();
                } else if (!isOpen && _isOverlayActive) {
                    _showButtons();
                }
            }, 50);
        });
        bodyOverlayObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'style', 'aria-hidden'] });

        // -- Wire action tap (Native Swift Liquid Glass Trash / Checkmark) --> trigger slide-over action
        plugin.addListener('actionTap', (data) => {
            if (data?.action === 'clearFavorites') {
                if (window.DrawersManager && typeof window.DrawersManager.clearAllFavorites === 'function') {
                    window.DrawersManager.clearAllFavorites();
                } else if (window.FavoritesManager && typeof window.FavoritesManager.clearAll === 'function') {
                    window.FavoritesManager.clearAll();
                }
            } else if (data?.action === 'markAllRead') {
                if (window.DrawersManager && typeof window.DrawersManager.markAllNotificationsRead === 'function') {
                    window.DrawersManager.markAllNotificationsRead();
                } else if (window.NotificationManager && typeof window.NotificationManager.markAllAsRead === 'function') {
                    window.NotificationManager.markAllAsRead();
                }
            }
        });

        // -- Wire close tap (Native Swift Liquid Glass "X") --> close active overlay
        plugin.addListener('closeTap', () => {
            if (typeof window.closeMobileMenu === 'function') {
                window.closeMobileMenu(true);
            }
            document.getElementById('closeMobileMenu')?.click?.();
            if (window.SidebarManager && typeof window.SidebarManager.close === 'function') {
                window.SidebarManager.close();
            }
            if (window.CartManager && typeof window.CartManager._hideSlideOver === 'function') {
                window.CartManager._hideSlideOver();
            }
            document.getElementById('cartCloseBtn')?.click?.();
            document.getElementById('closeCartBtn')?.click?.();
            if (window.DrawersManager && typeof window.DrawersManager.closeAll === 'function') {
                window.DrawersManager.closeAll();
            }
            document.getElementById('favoritesCloseBtn')?.click?.();
            document.getElementById('notificationsCloseBtn')?.click?.();
            if (typeof window.closeZoom === 'function') {
                window.closeZoom();
            }
            if (typeof window.closeImageZoom === 'function') {
                window.closeImageZoom();
            }
            if (typeof window.closeOrderModal === 'function') {
                window.closeOrderModal();
            }
            if (typeof window.closeDisputeModal === 'function') {
                window.closeDisputeModal();
            }
            // Nettoie la recherche et ses suggestions teleportees
            window.SearchManager?.closeSearchOverlay?.();
            const searchSuggestions = document.getElementById('searchSuggestions');
            if (searchSuggestions) {
                searchSuggestions.classList.remove('active');
                searchSuggestions.innerHTML = '';
            }
            const searchContainer = document.getElementById('mobileSearchContainer');
            if (searchContainer) {
                searchContainer.classList.add('user-hidden-on-mobile');
                const searchClose = document.getElementById('closeSearchBtn') || document.querySelector('[data-close-search]');
                searchClose?.click?.();
            }
            const activeModalClose = document.querySelector('.modal:not(.hidden) [data-action*="close"], .modal:not(.hidden) .modal-close-btn, #orderModal:not([style*="display: none"]) [data-action*="close"], #disputeModal:not(.hidden) [data-action*="close"], [data-close-zoom], #cropperCancelBtn, .nk-modal-close');
            activeModalClose?.click?.();
        });

        // -- Wire burger tap --> open mobile menu -------------------------
        plugin.addListener('burgerTap', () => {
            const currentPath = window.location.pathname;
            const isDash = isDashboard || currentPath.includes('-dashboard') || currentPath.includes('dashboard') || currentPath.includes('/admin') ||
                           !!document.getElementById('vendorSidebar') || !!document.getElementById('customerSidebar') || !!document.getElementById('adminSidebar');

            if (isDash) {
                if (document.getElementById('vendorMobileBtn')) {
                    document.getElementById('vendorMobileBtn').click();
                } else if (document.getElementById('customerMobileBtn')) {
                    document.getElementById('customerMobileBtn').click();
                } else if (document.getElementById('adminMobileMenuBtn')) {
                    document.getElementById('adminMobileMenuBtn').click();
                } else if (typeof window.SidebarManager?.toggle === 'function') {
                    window.SidebarManager.toggle();
                }
            } else {
                if (typeof window.openMobileMenu === 'function') {
                    window.openMobileMenu();
                } else if (document.getElementById('mobileMenuBtn')) {
                    document.getElementById('mobileMenuBtn').click();
                } else if (typeof window.SidebarManager?.toggle === 'function') {
                    window.SidebarManager.toggle();
                }
            }
        });

        // -- Wire right tap --> search or logout --------------------------
        plugin.addListener('rightTap', () => {
            if (isDashboard) {
                if (typeof window.AuthManager?.handleLogoutClick === 'function') {
                    const logoutBtn = document.querySelector('[data-logout-safe], [data-action="logout"]');
                    window.AuthManager.handleLogoutClick(logoutBtn || document.body);
                } else {
                    document.querySelector('[data-logout-safe], [data-action="logout"]')?.click();
                }
            } else {
                const sc = document.getElementById('mobileSearchContainer');
                if (sc) {
                    const isOpening = sc.classList.contains('user-hidden-on-mobile');
                    sc.classList.toggle('user-hidden-on-mobile');
                    if (isOpening) {
                        // Search panel is now visible → hide buttons
                        _hideButtons();
                        setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
                        // Watch for close (re-add class = close)
                        const searchObs = new MutationObserver(() => {
                            if (sc.classList.contains('user-hidden-on-mobile')) {
                                _showButtons();
                                searchObs.disconnect();
                            }
                        });
                        searchObs.observe(sc, { attributes: true, attributeFilter: ['class'] });
                    }
                } else {
                    document.getElementById('mobileHeaderSearchBtn')?.click();
                }
            }
        });
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

        // Prevent full page reload when clicking "Accueil" (home link) while already on the homepage.
        // Instead, smoothly scroll to the top of the page.
        document.addEventListener('click', (event) => {
            const homeLink = event.target.closest('a[href="/"], a[href="/index.html"]');
            if (!homeLink) return;

            const currentPath = window.location.pathname;
            const isOnHomePage = currentPath === '/' || currentPath === '/index.html';

            if (isOnHomePage) {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
                if (elementId === 'header-placeholder') this.setupHeaderSpacing();
            return;
        }

        // Use inline HTML directly to avoid 404 errors and speed up loading
        if (fallbackHTML) {
            this.injectHTML(element, fallbackHTML);
                if (elementId === 'header-placeholder') this.setupHeaderSpacing();
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
            if (elementId === 'header-placeholder') this.setupHeaderSpacing();
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
        let accountPath = 'login';
        
        if (hasSession && role) {
            if (role === 'admin') accountPath = 'admin';
            else if (role === 'supplier') accountPath = 'vendor-dashboard';
            else accountPath = 'customer-dashboard';
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
        // Returns clean root-relative URLs (e.g. /catalog, /login, /admin/index).
        // The Vite dev middleware and Vercel rewrites map these to src/pages/*.html
        // transparently, so the browser URL stays clean.
        const root = '/';

        if (!path || path === '#' || path === './') {
            return root;
        }

        // Absolute URLs and javascript: pass through unchanged.
        if (path.startsWith('/') || path.startsWith('http') || path.startsWith('javascript:')) {
            return path;
        }

        // Normalise: strip leading ./ or extra /
        let cleanPath = path.replace(/^\.\//g, '').replace(/^\/+/g, '');

        // Strip legacy src/pages/ prefix so old callers still work.
        cleanPath = cleanPath.replace(/^src\/pages\//, '').replace(/^pages\//, '');

        // Strip .html extension — Vercel cleanUrls + dev middleware handle it
        cleanPath = cleanPath.replace(/\.html$/, '');

        // Admin shortcut: 'admin' or 'admin/' → /admin/index
        if (cleanPath === 'admin' || cleanPath === 'admin/') {
            cleanPath = 'admin/index';
        }

        // Separate query string if present
        let query = '';
        if (cleanPath.includes('?')) {
            const parts = cleanPath.split('?');
            cleanPath = parts[0];
            query = '?' + parts[1];
        }

        // Assets stay in src/
        if (cleanPath.startsWith('assets/')) {
            return root + 'src/' + cleanPath + query;
        }

        // Capacitor runs a simple static server. It needs the EXACT physical file path.
        if (window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative)) {
            if (cleanPath === '' || cleanPath === 'index') {
                return root + 'index.html' + query;
            }
            return root + 'src/pages/' + cleanPath + '.html' + query;
        }

        return root + cleanPath + query;
    },
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
