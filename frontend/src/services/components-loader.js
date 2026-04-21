/* NewKet EMarket Component Loader */

/**
 * Header HTML inlined to avoid CORS issues with file:// protocol.
 * When served via HTTP, fetch is used instead.
 */
const HEADER_HTML = `
    <!-- Main header container -->
    <header class="main-header fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <!-- Top Info Bar -->
        <div class="bg-gray-950 text-white py-1.5 px-4 sm:px-8 border-b border-white/5">
            <div class="max-w-7xl mx-auto w-full flex items-center justify-between text-[9px] sm:text-[10px] font-bold tracking-widest uppercase gap-4">
                <div class="hidden md:flex items-center gap-6">
                    <span class="flex items-center gap-1.5"><iconify-icon icon="solar:delivery-bold" width="12" class="text-orange-400" aria-hidden="true"></iconify-icon> Livraison Offerte</span>
                    <span class="flex items-center gap-1.5 opacity-60"><iconify-icon icon="solar:shield-check-bold" width="12" aria-hidden="true"></iconify-icon> Paiement Sécurisé</span>
                </div>
                <div class="flex-1 flex justify-center text-center">
                    <span class="px-4">Marketplace de Luxe — Boutique NewKet Officielle</span>
                </div>
                <div class="hidden sm:flex items-center gap-6">
                    <a href="{{ROOT}}src/pages/support.html" class="hover:text-orange-400 transition-colors uppercase whitespace-nowrap">Support</a>
                    <a href="{{ROOT}}src/pages/faq.html" class="hover:text-orange-400 transition-colors uppercase whitespace-nowrap">FAQ</a>
                    <a href="{{ROOT}}src/pages/forum.html" class="hover:text-orange-400 transition-colors uppercase whitespace-nowrap">Forum</a>
                </div>
            </div>
        </div>
        <!-- Main header content (Logo, Search, Icons) -->
        <div class="header-content relative w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-y-3 sm:gap-x-8">
            <!-- Top section for mobile: Menu, Centered Logo, Account -->
            <div class="flex items-center justify-between w-full sm:w-auto h-12 sm:h-auto relative px-1 sm:px-0">
                <!-- Hamburger Menu (Mobile) -->
                <button id="mobileMenuBtn" class="p-2 rounded-lg hover:bg-gray-100 transition-colors sm:hidden btn-active-scale"
                    title="Menu" aria-label="Ouvrir le menu">
                    <iconify-icon icon="solar:hamburger-menu-linear" width="24" class="text-gray-600"></iconify-icon>
                </button>

                <!-- Logo Section -->
                <div class="flex items-center sm:min-w-[160px]">
                    <a href="{{ROOT}}index.html" class="flex-shrink-0 flex items-center py-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0 z-10 transition-transform hover:scale-105 duration-300">
                        <img src="{{ROOT}}Images/logo-newket.png" alt="NewKet" 
                            class="h-10 sm:h-16 w-auto object-contain"
                            onerror="this.src='/Images/logo-newket.png'; this.onerror=null;">
                    </a>
                </div>

                <!-- Account Icon (Mobile) -->
                <a id="accountLinkMobile" href="{{ROOT}}{{ACCOUNT_PATH}}" class="p-2 rounded-lg hover:bg-gray-50 transition-colors btn-active-scale sm:hidden"
                    title="Compte" aria-label="Mon compte">
                    <iconify-icon icon="solar:user-linear" width="22" class="text-gray-600"></iconify-icon>
                </a>
            </div>

            <!-- Search Bar (Full width on mobile, centered on desktop) -->
            <div id="mobileSearchContainer" 
                class="flex-none w-full sm:flex-1 sm:mx-auto relative group flex flex-row flex-nowrap gap-3 sm:gap-4 items-center min-w-0"
                style="max-width: 650px;">
                <div class="search-bar">
                    <!-- Category Selector -->
                    <div id="searchCategoryBtn" class="search-category-btn" title="Choisir une catégorie">
                        <span id="selectedCategoryName">TOUT</span>
                        <iconify-icon icon="solar:alt-arrow-down-linear" width="14"></iconify-icon>
                        
                        <!-- Mini Dropdown for categories -->
                        <div id="searchCategoryMenu" class="hidden absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] overflow-hidden">
                            <div class="py-2">
                                <button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900" data-value="all">Tout</button>
                                <button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900" data-value="Collections Femme">Femme</button>
                                <button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900" data-value="Style Homme">Homme</button>
                                <button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900" data-value="Tech & Gadgets">Tech</button>
                                <button class="category-option w-full px-4 py-2 text-left text-[10px] font-black hover:bg-gray-50 uppercase tracking-widest text-slate-900" data-value="Art de vivre">Maison</button>
                            </div>
                        </div>
                    </div>

                    <input type="text" id="searchInput" name="search" placeholder="Rechercher sur NewKet..." aria-label="Rechercher des produits"
                        class="search-input" autocomplete="off" spellcheck="false">
                        
                    <iconify-icon icon="solar:magnifer-linear" width="20" class="search-icon"></iconify-icon>
                    
                    <button id="searchBtn"
                        class="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all uppercase tracking-widest hidden md:block btn-active-scale">RECHERCHE</button>
                </div>

                <!-- Publish Button (Desktop Only) -->
                <a href="{{ROOT}}src/pages/publish.html"
                    class="shrink-0 bg-gray-900 text-white px-4 md:px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors hidden sm:flex items-center gap-2 publish-btn h-[44px] whitespace-nowrap btn-active-scale"
                    aria-label="Vendre un article">
                    <iconify-icon icon="solar:add-circle-bold" width="20"></iconify-icon>
                    <span class="hidden md:inline">Vendre</span>
                </a>

                <!-- Suggestions Dropdown -->
                <div id="searchSuggestions" class="search-suggestions"></div>
            </div>

            <!-- Desktop Icons (Notifications, Favorites, Account, Theme) -->
            <div class="hidden sm:flex items-center gap-4 shrink-0">
                <!-- Theme Toggle -->
                <button data-theme-toggle onclick="ThemeManager.toggle()"
                    class="p-2 rounded-lg hover:bg-gray-50 transition-colors btn-active-scale" 
                    title="Changer le thème">
                    <iconify-icon data-theme-icon icon="solar:moon-bold" width="22" class="text-gray-600"></iconify-icon>
                </button>

                <!-- Notifications -->
                <a href="{{ROOT}}src/pages/notifications.html"
                    class="relative p-2 rounded-lg hover:bg-gray-50 transition-colors btn-active-scale"
                    title="Notifications" aria-label="Voir les notifications">
                    <iconify-icon icon="solar:bell-linear" width="22" class="text-gray-600"></iconify-icon>
                    <span
                        class="notification-badge absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:16px; height:16px; min-width: 16px;">0</span>
                </a>

                <!-- Favorites -->
                <a href="{{ROOT}}src/pages/favorites.html" class="relative p-2 rounded-lg hover:bg-gray-50 transition-colors btn-active-scale"
                    title="Favoris" aria-label="Voir les favoris">
                    <iconify-icon icon="solar:heart-linear" width="22" class="text-gray-600"></iconify-icon>
                    <span
                        class="favorites-badge absolute -top-0.5 -right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:18px; height:18px;">0</span>
                </a>

                <!-- Account -->
                <a href="{{ROOT}}{{ACCOUNT_PATH}}" class="relative p-2 rounded-lg hover:bg-gray-50 transition-colors btn-active-scale"
                    title="Compte" id="accountLink" aria-label="Mon compte">
                    <iconify-icon icon="solar:user-linear" width="22" class="text-gray-600"></iconify-icon>
                </a>
            </div>
        </div>

        <!-- Global Search Overlay -->
        <div id="searchOverlay" class="search-overlay"></div>

        <!-- Category Nav -->
        <div id="categoryNav" class="category-nav border-t border-gray-50 bg-white hidden sm:block transition-all duration-300 ease-in-out transform origin-top">
            <div class="w-full px-4 sm:px-8">
                <nav class="flex items-center gap-2 overflow-x-auto py-2 -mx-2 scroll-affordance" style="scrollbar-width:none;">
                    <a href="{{ROOT}}src/pages/catalog.html"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors shrink-0">Toutes les pièces</a>
                    <a href="{{ROOT}}src/pages/shops.html"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors shrink-0">Boutiques</a>
                    <a href="{{ROOT}}src/pages/forum.html"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors shrink-0">Forum</a>
                    <a href="{{ROOT}}src/pages/catalog.html?category=Collections Femme"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors shrink-0">Collections Femme</a>
                    <a href="{{ROOT}}src/pages/catalog.html?category=Style Homme"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors shrink-0">Style Homme</a>
                    <a href="{{ROOT}}src/pages/catalog.html?category=Tech & Gadgets"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors shrink-0">Tech & Gadgets</a>
                    <a href="{{ROOT}}src/pages/catalog.html?category=Art de vivre"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors shrink-0">Art de vivre</a>
                    <a href="{{ROOT}}src/pages/catalog.html?promo=true"
                        class="nav-link px-4 py-2 text-sm font-medium text-gray-900 hover:text-black whitespace-nowrap rounded-lg hover:bg-100 transition-colors flex items-center gap-1 shrink-0">
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
    <div class="p-4 border-b border-gray-100 flex items-center justify-between">
        <img src="{{ROOT}}Images/logo-newket.png" alt="NewKet" class="h-10 w-auto object-contain pl-1">
        <button id="closeMobileMenu" class="p-2 rounded-lg hover:bg-gray-100 btn-active-scale" aria-label="Fermer le menu">
            <iconify-icon icon="solar:close-circle-linear" width="24" class="text-gray-600"></iconify-icon>
        </button>
    </div>

    <div class="flex-1 overflow-y-auto py-4">
        <!-- Guest Call to Action -->
        <div id="mobileGuestCTA" class="px-4 mb-6">
            <a href="/src/pages/login.html" class="flex flex-col items-center gap-2 p-6 bg-slate-900 text-white rounded-[2rem] text-center group transition-all hover:bg-slate-800">
                <div class="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                    <iconify-icon icon="solar:user-bold" width="24"></iconify-icon>
                </div>
                <div class="text-base font-bold">Compte NewKet</div>
                <div class="text-xs text-white/60 font-medium">Connectez-vous pour voir vos favoris et vos commandes.</div>
                <div class="mt-4 px-6 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest">Se connecter</div>
            </a>
        </div>

        <!-- Logged User Call to Action -->
        <div id="mobileLoggedCTA" class="px-4 mb-6" style="display: none;">
            <a id="mobileLoggedLink" href="{{ROOT}}src/pages/customer-dashboard.html" class="flex flex-col items-center gap-2 p-6 bg-slate-900 text-white rounded-[2rem] text-center group transition-all hover:bg-slate-800 shadow-xl">
                <div class="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-1 group-hover:scale-105 transition-transform overflow-hidden border-2 border-white/20 shadow-md">
                    <img id="mobileLoggedAvatar" src="" alt="Avatar" class="w-full h-full object-cover hidden" referrerpolicy="no-referrer" crossorigin="anonymous">
                    <iconify-icon id="mobileLoggedIcon" icon="solar:user-bold" width="30" class="text-white hidden"></iconify-icon>
                </div>
                <div id="mobileLoggedName" class="text-base font-bold leading-tight mt-1">Mon Compte</div>
                <div id="mobileLoggedRole" class="text-xs text-white/50 font-medium uppercase tracking-widest mt-1">Membre NewKet</div>
                <div class="mt-4 px-6 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-colors w-full">Mon Espace</div>
            </a>
        </div>

        <div class="px-4 mb-6">
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Catégories</h3>
            <nav class="flex flex-col gap-1">
                <a href="{{ROOT}}src/pages/catalog.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:shop-linear" width="20"></iconify-icon> Toutes les pièces
                </a>
                <a href="{{ROOT}}src/pages/shops.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:shop-2-linear" width="20"></iconify-icon> Boutiques
                </a>
                <a href="{{ROOT}}src/pages/forum.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:chat-round-line-linear" width="20"></iconify-icon> Forum Communauté
                </a>
                <a href="{{ROOT}}src/pages/catalog.html?promo=true"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-red-600 font-bold">
                    <iconify-icon icon="solar:fire-bold" width="20"></iconify-icon> Promos
                </a>
            </nav>
        </div>

        <div class="px-4 mb-6 border-t border-gray-50 pt-6">
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Personnel</h3>
            <nav class="flex flex-col gap-1">
                <a href="{{ROOT}}src/pages/notifications.html"
                    class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <span class="flex items-center gap-3"><iconify-icon icon="solar:bell-linear"
                            width="20"></iconify-icon> Notifications</span>
                    <span
                        class="notification-badge bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full hidden">0</span>
                </a>
                <a href="{{ROOT}}src/pages/favorites.html"
                    class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <span class="flex items-center gap-3"><iconify-icon icon="solar:heart-linear"
                            width="20"></iconify-icon> Favoris</span>
                    <span id="mobileFavoritesBadge"
                        class="bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full">0</span>
                </a>
                <button onclick="ThemeManager.toggle()"
                    class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium w-full text-left" title="Changer le thème">
                    <span class="flex items-center gap-3"><iconify-icon data-theme-icon icon="solar:moon-bold" width="20"></iconify-icon> Mode Sombre</span>
                </button>
                <a href="{{ROOT}}src/pages/publish.html"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900 text-white font-medium mt-2 publish-btn btn-active-scale">
                    <iconify-icon icon="solar:add-circle-linear" width="20"></iconify-icon> Vendre un article
                </a>
                <button onclick="window.AppNotifications && AppNotifications.promptInstall()" id="pwa-install-btn"
                    class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium mt-2 transition-all">
                    <iconify-icon icon="solar:download-square-bold" width="20"></iconify-icon> Installer l'Application
                </button>
            </nav>
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
            <button id="mobileLogoutBtn" onclick="if(window.AuthManager) { this.disabled=true; this.innerHTML='...'; AuthManager.logout(); } else { window.location.reload(); }" style="display: none;"
                class="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold transition-colors">
                <iconify-icon icon="solar:logout-3-bold" width="20"></iconify-icon> Se déconnecter
            </button>
        </div>
    </div>
</div>`;;

const FOOTER_HTML = `<!-- NewKet Footer Component -->
<footer class="bg-gray-900 text-white mt-16 pt-16 pb-8 border-t border-white/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-10 gap-10 mb-12">
            <div class="lg:col-span-4 space-y-6">
                <div class="flex items-center ml-2">
                    <img src="{{ROOT}}Images/logo-newket.png" alt="NewKet" class="h-28 w-auto object-contain transform scale-[2] grayscale invert opacity-90 origin-left">
                </div>
                <p class="text-gray-400 text-sm leading-relaxed max-w-sm">
                    L'excellence de la marketplace moderne. Découvrez une sélection rigoureuse d'articles de luxe et profitez d'une expérience shopping sans compromis.
                </p>
                <div class="flex items-center gap-4">
                    <a href="https://www.instagram.com/newket.shop" target="_blank" rel="noopener noreferrer" aria-label="NewKet sur Instagram" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:instagram" width="20"></iconify-icon></a>
                    <a href="https://www.facebook.com/newket.shop" target="_blank" rel="noopener noreferrer" aria-label="NewKet sur Facebook" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:facebook" width="20"></iconify-icon></a>
                    <a href="https://www.x.com/newket_shop" target="_blank" rel="noopener noreferrer" aria-label="NewKet sur X" class="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"><iconify-icon icon="line-md:twitter-x" width="20"></iconify-icon></a>
                </div>
            </div>
            <div class="lg:col-span-2 space-y-6">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Services</h4>
                <ul class="space-y-4">
                    <li><a id="accountLinkFooter" href="{{ROOT}}{{ACCOUNT_PATH}}" class="text-gray-400 hover:text-white text-sm transition-colors">Mon Compte</a></li>
                    <li><a href="{{ROOT}}src/pages/support.html" class="text-gray-400 hover:text-white text-sm transition-colors">Support Technique</a></li>
                    <li><a href="{{ROOT}}src/pages/faq.html" class="text-gray-400 hover:text-white text-sm transition-colors">FAQ</a></li>
                    <li><a href="{{ROOT}}src/pages/publish.html" class="text-gray-400 hover:text-white text-sm transition-colors publish-btn">Vendre un article</a></li>
                </ul>
            </div>
            <div class="lg:col-span-4 space-y-6">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Inspiration & Offres</h4>
                <p class="text-gray-400 text-sm">Inscrivez-vous pour recevoir nos sélections exclusives et avant-premières.</p>
                <form id="newsletterForm" class="relative group" onsubmit="event.preventDefault(); if (window.handleNewsletterSubmit) { window.handleNewsletterSubmit(event); } else if (window.showToast) { window.showToast('Merci pour votre inscription !', 'success', 'Newsletter'); }"> 
                    <input id="newsletterEmail" name="newsletterEmail" type="email" placeholder="Votre email" autocomplete="email" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all">
                    <button id="newsletterBtn" type="submit" class="absolute right-2 top-2 bg-white text-black text-xs font-bold uppercase px-4 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">S'inscrire</button>
                    <div id="newsletterMsg" class="hidden text-xs absolute -bottom-6 left-0 w-full mt-2"></div>
                </form>
            </div>
        </div>
        <div class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 NEWKET — Expérience Luxe</p>
            <div class="flex gap-8">
                <a href="{{ROOT}}src/pages/privacy.html" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Confidentialité</a>
                <a href="{{ROOT}}src/pages/terms.html" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Conditions</a>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-gray-500 text-[10px] uppercase tracking-widest font-semibold italic">Designed by</span>
                <span class="text-white text-[11px] font-black tracking-tighter hover:text-red-500 transition-colors cursor-pointer">SITYZEN</span>
            </div>
        </div>
    </div>
</footer>`;



const MINIMAL_HEADER_HTML = `<!-- NewKet Minimal Header Component -->
<header class="main-header fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm flex h-[60px] sm:h-[80px] items-center justify-center">
    <a href="{{ROOT}}index.html" class="flex items-center group py-2" title="Retour à l'accueil">
        <img src="{{ROOT}}Images/logo-newket.png" alt="NewKet" class="h-10 sm:h-16 w-auto object-contain transition-transform group-hover:scale-105">
    </a>
    <div class="absolute right-4 items-center hidden sm:flex text-gray-300">
        <iconify-icon icon="solar:lock-password-bold" width="18"></iconify-icon>
        <span class="text-[10px] uppercase font-bold tracking-widest ml-1">Sécurisé</span>
    </div>
</header>`;

const ComponentLoader = {
    async init() {

        // Determine current page status
        const currentPath = window.location.pathname;
        const isMinimalPage = currentPath.includes('/login') || currentPath.includes('/publish');

        // Prevent double initialization
        if (window.componentsLoading) return;
        window.componentsLoading = true;

        const componentsToLoad = [];

        if (isMinimalPage) {
            componentsToLoad.push(
                this.loadComponent('header-placeholder', 'components/header-minimal.html', MINIMAL_HEADER_HTML)
            );
        } else {
            componentsToLoad.push(
                this.loadComponent('header-placeholder', 'components/header.html', HEADER_HTML)
            );
        }



        if (!isMinimalPage) {
            componentsToLoad.push(
                this.loadComponent('footer-placeholder', 'components/footer.html', FOOTER_HTML)
            );
        }

        await Promise.all(componentsToLoad);

        // Set global flag to avoid race conditions
        window.componentsLoaded = true;

        // Dispatch event when components are ready
        window.dispatchEvent(new CustomEvent('componentsLoaded'));

        if (window.AuthManager) {
            AuthManager.enforcePermissions();
            AuthManager.updateAccountLink();
        }
        if (window.FavoritesManager) FavoritesManager.updateUI();
        if (window.CurrencyManager) CurrencyManager.updateCurrencyUI();
        if (window.SearchManager) SearchManager.init();

        // Load newsletter manager for footer form
        if (!window.NewsletterManager) {
            const script = document.createElement('script');
            script.src = this.getAdjustedPath('/js/newsletter.js');
            document.head.appendChild(script);
        }

        setTimeout(() => this.setupHeaderSpacing(), 50);
    },

    /**
     * Ensures page content is not hidden behind the fixed header.
     */
    setupHeaderSpacing() {
        const adjust = () => {
            const header = document.querySelector('.main-header');
            const placeholder = document.getElementById('header-placeholder');
            if (!header || !placeholder) return;

            const height = header.offsetHeight;
            if (height === 0) return;

            // Set global CSS variable for other components to use
            document.documentElement.style.setProperty('--header-height', `${height}px`);

            // Use a stable spacer instead of dynamic insertion if possible, 
            // but for existing pages we stick to the dynamic spacer for backward compatibility.
            let spacer = document.getElementById('dynamic-header-spacer');
            if (!spacer) {
                spacer = document.createElement('div');
                spacer.id = 'dynamic-header-spacer';
                placeholder.insertAdjacentElement('afterend', spacer);
            }

            spacer.style.height = `${height}px`;
            document.documentElement.style.scrollPaddingTop = `${height + 20}px`;
        };

        adjust();
        window.addEventListener('resize', adjust);
        
        // Observer for dynamic header changes (e.g. banners)
        const header = document.querySelector('.main-header');
        if (header && window.ResizeObserver) {
            new ResizeObserver(adjust).observe(header);
        }
    },

    async loadComponent(elementId, path, fallbackHTML = '') {
        const element = document.getElementById(elementId);
        if (!element) return;

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
        const role = localStorage.getItem('newketRole');
        const email = localStorage.getItem('newketUserEmail');
        let accountPath = 'src/pages/login.html';
        
        if (role && email) {
            if (role === 'admin') accountPath = 'src/pages/admin/index.html';
            else if (role === 'supplier') accountPath = 'src/pages/vendor-dashboard.html';
            else accountPath = 'src/pages/customer-dashboard.html';
        }

        let processedHTML = html
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

        // Sync theme toggle UI state if ThemeManager is available
        if (window.ThemeManager) {
            ThemeManager._syncToggleUI();
        }
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
