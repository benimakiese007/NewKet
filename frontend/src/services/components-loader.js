/* NewKet EMarket Component Loader */

/**
 * Header HTML inlined to avoid CORS issues with file:// protocol.
 * When served via HTTP, fetch is used instead.
 */
const HEADER_HTML = `
    <!-- Main header container -->
    <header class="main-header fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <!-- Main header content (Logo, Search, Icons) -->
        <div class="header-content w-full px-2 sm:px-8 py-1 sm:py-2 flex flex-wrap items-center justify-between sm:gap-x-4">
            <!-- Left: Hamburger (Mobile) & Logo -->
            <div class="flex items-center gap-2 sm:gap-4">
                <button id="mobileMenuBtn" class="p-1 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors sm:hidden"
                    title="Menu">
                    <iconify-icon icon="solar:hamburger-menu-linear" width="24" class="text-gray-600"></iconify-icon>
                </button>
                <a href="{{ROOT}}index" class="flex-shrink-0 flex items-center gap-1 sm:gap-3">
                    <span
                        class="text-lg sm:text-xl font-bold tracking-tighter text-gray-900 max-[360px]:hidden">NEWKET</span>
                </a>
            </div>

            <!-- Center: Search & Publish -->
            <div id="mobileSearchContainer"
                class="order-3 sm:order-2 flex-none w-full sm:flex-1 sm:w-auto relative group flex flex-row flex-nowrap gap-2 sm:gap-3 items-center min-w-0">
                <div
                    class="search-bar flex-1 flex items-center bg-slate-100/50 border border-slate-200 rounded-2xl overflow-hidden focus-within:bg-white focus-within:ring-4 focus-within:ring-gray-100 focus-within:border-gray-200 transition-all duration-300 pr-2">
                    <input type="text" id="searchInput" placeholder="Qu'est-ce qui vous ferait plaisir ?"
                        class="w-full py-2 px-4 bg-transparent text-sm outline-none placeholder-slate-400 font-medium search-input">
                    <iconify-icon icon="solar:magnifer-linear" width="20" class="text-slate-400 sm:hidden"></iconify-icon>
                    <button id="searchBtn"
                        class="bg-slate-900 text-white px-5 py-2 m-1 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all uppercase tracking-wider hidden sm:block">RECHERCHE</button>
                </div>
                <!-- Publish Button (Desktop Only) -->
                <a href="{{ROOT}}pages/publish"
                    class="shrink-0 bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors hidden sm:flex items-center gap-2 publish-btn h-[40px] whitespace-nowrap">
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

                <!-- Notifications -->
                <a href="{{ROOT}}pages/notifications"
                    class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Notifications">
                    <iconify-icon icon="solar:bell-linear" width="22" class="text-gray-600"></iconify-icon>
                    <span
                        class="notification-badge absolute top-0.5 right-0.5 sm:-top-0.5 sm:-right-0.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:16px; height:16px; min-width: 16px;">0</span>
                </a>

                <!-- Favorites -->
                <a href="{{ROOT}}pages/favorites" class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Favoris">
                    <iconify-icon icon="solar:heart-linear" width="22" class="text-gray-600"></iconify-icon>
                    <span
                        class="favorites-badge absolute top-0.5 right-0.5 sm:-top-0.5 sm:-right-0.5 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-medium"
                        style="display:none; font-size:10px; width:18px; height:18px;">0</span>
                </a>

                <!-- Account (MODIFIED: removed hidden sm:block) -->
                <a href="{{ROOT}}{{ACCOUNT_PATH}}" class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Compte" id="accountLink">
                    <iconify-icon icon="solar:user-linear" width="22" class="text-gray-600"></iconify-icon>
                </a>

                <!-- Theme Toggle -->
                <button class="relative p-1 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors hidden sm:block"
                    data-theme-toggle onclick="ThemeManager.toggle()" title="Passer en mode sombre" aria-label="Passer en mode sombre">
                    <iconify-icon data-theme-icon icon="solar:moon-bold" width="22" class="text-gray-600"></iconify-icon>
                </button>
            </div>
        </div>

        <!-- Category Nav -->
        <div class="border-t border-gray-50 bg-white hidden sm:block">
            <div class="w-full px-4 sm:px-8">
                <nav class="flex items-center gap-1 overflow-x-auto py-1 -mx-2" style="scrollbar-width:none;">
                    <a href="{{ROOT}}pages/catalog"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Toutes les pièces</a>
                    <a href="{{ROOT}}pages/shops"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Boutiques</a>
                    <a href="{{ROOT}}pages/forum"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Forum</a>
                    <a href="{{ROOT}}pages/catalog?category=Collections Femme"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Collections Femme</a>
                    <a href="{{ROOT}}pages/catalog?category=Style Homme"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Style Homme</a>
                    <a href="{{ROOT}}pages/catalog?category=Tech & Gadgets"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Tech & Gadgets</a>
                    <a href="{{ROOT}}pages/catalog?category=Art de vivre"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap rounded-lg hover:bg-gray-50 transition-colors">Art de vivre</a>
                    <a href="{{ROOT}}pages/catalog?promo=true"
                        class="nav-link px-3 py-1.5 text-sm font-medium text-gray-900 hover:text-black whitespace-nowrap rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1">
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
        <span class="text-xl font-black tracking-tighter">NEWKET</span>
        <button id="closeMobileMenu" class="p-2 rounded-lg hover:bg-gray-100">
            <iconify-icon icon="solar:close-circle-linear" width="24" class="text-gray-600"></iconify-icon>
        </button>
    </div>

    <div class="flex-1 overflow-y-auto py-4">
        <!-- Guest Call to Action -->
        <div id="mobileGuestCTA" class="px-4 mb-6">
            <a href="{{ROOT}}{{ACCOUNT_PATH}}" class="flex flex-col items-center gap-2 p-6 bg-slate-900 text-white rounded-[2rem] text-center group transition-all hover:bg-slate-800">
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
            <a id="mobileLoggedLink" href="{{ROOT}}pages/customer-dashboard" class="flex flex-col items-center gap-2 p-6 bg-slate-900 text-white rounded-[2rem] text-center group transition-all hover:bg-slate-800 shadow-xl">
                <div class="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-1 group-hover:scale-105 transition-transform overflow-hidden border-2 border-white/20 shadow-md">
                    <img id="mobileLoggedAvatar" src="" alt="Avatar" class="w-full h-full object-cover hidden">
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
                <a href="{{ROOT}}pages/catalog"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:shop-linear" width="20"></iconify-icon> Toutes les pièces
                </a>
                <a href="{{ROOT}}pages/shops"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:shop-2-linear" width="20"></iconify-icon> Boutiques
                </a>
                <a href="{{ROOT}}pages/forum"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <iconify-icon icon="solar:chat-round-line-linear" width="20"></iconify-icon> Forum Communauté
                </a>
                <a href="{{ROOT}}pages/catalog?promo=true"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-red-600 font-bold">
                    <iconify-icon icon="solar:fire-bold" width="20"></iconify-icon> Promos
                </a>
            </nav>
        </div>

        <div class="px-4 mb-6 border-t border-gray-50 pt-6">
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Personnel</h3>
            <nav class="flex flex-col gap-1">
                <a href="{{ROOT}}pages/notifications"
                    class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
                    <span class="flex items-center gap-3"><iconify-icon icon="solar:bell-linear"
                            width="20"></iconify-icon> Notifications</span>
                    <span
                        class="notification-badge bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full hidden">0</span>
                </a>
                <a href="{{ROOT}}pages/favorites"
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
                <a href="{{ROOT}}pages/publish"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900 text-white font-medium mt-2 publish-btn">
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
            <button id="mobileLogoutBtn" onclick="AuthManager.logout()" style="display: none;"
                class="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold transition-colors">
                <iconify-icon icon="solar:logout-3-bold" width="20"></iconify-icon> Se déconnecter
            </button>
        </div>
    </div>
</div>`;;

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
                    <li><a href="{{ROOT}}{{ACCOUNT_PATH}}" class="text-gray-400 hover:text-white text-sm transition-colors">Mon Compte</a></li>
                    <li><a href="{{ROOT}}{{ACCOUNT_PATH}}" class="text-gray-400 hover:text-white text-sm transition-colors">Mes Activités</a></li>
                    <li><a href="{{ROOT}}pages/about" class="text-gray-400 hover:text-white text-sm transition-colors">Aide & FAQ</a></li>
                    <li><a href="{{ROOT}}pages/publish" class="text-gray-400 hover:text-white text-sm transition-colors publish-btn">Vendre un article</a></li>
                </ul>
            </div>
            <div class="lg:col-span-4 space-y-6">
                <h4 class="text-sm font-bold uppercase tracking-widest text-white/90">Inspiration & Offres</h4>
                <p class="text-gray-400 text-sm">Inscrivez-vous pour recevoir nos sélections exclusives et avant-premières.</p>
                <form id="newsletterForm" class="relative group" onsubmit="window.handleNewsletterSubmit ? window.handleNewsletterSubmit(event) : (event.preventDefault(), alert('Merci pour votre inscription !'))"> 
                    <input id="newsletterEmail" type="email" placeholder="Votre email" autocomplete="email" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all">
                    <button id="newsletterBtn" type="submit" class="absolute right-2 top-2 bg-white text-black text-xs font-bold uppercase px-4 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">S'inscrire</button>
                    <div id="newsletterMsg" class="hidden text-xs absolute -bottom-6 left-0 w-full mt-2"></div>
                </form>
            </div>
        </div>
        <div class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">© 2026 NEWKET — Expérience Luxe</p>
            <div class="flex gap-8">
                <a href="{{ROOT}}pages/privacy" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Confidentialité</a>
                <a href="{{ROOT}}pages/terms" class="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">Conditions</a>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-gray-500 text-[10px] uppercase tracking-widest font-semibold italic">Designed by</span>
                <span class="text-white text-[11px] font-black tracking-tighter hover:text-red-500 transition-colors cursor-pointer">SITYZEN</span>
            </div>
        </div>
    </div>
</footer>`;



const MINIMAL_HEADER_HTML = `<!-- NewKet Minimal Header Component -->
<header class="main-header fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm flex h-[60px] sm:h-[64px] items-center justify-center">
    <a href="{{ROOT}}index" class="flex items-center group" title="Retour à l'accueil">
        <span class="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 transition-transform group-hover:scale-105">NEWKET</span>
    </a>
    <div class="absolute right-4 items-center hidden sm:flex text-gray-300">
        <iconify-icon icon="solar:lock-password-bold" width="18"></iconify-icon>
        <span class="text-[10px] uppercase font-bold tracking-widest ml-1">Sécurisé</span>
    </div>
</header>`;

const ComponentLoader = {
    async init() {

        // Determine if we are on the home page (index.html or root)
        const currentPath = window.location.pathname;
        const isHomePage = currentPath === '/' || currentPath === '' || currentPath.endsWith('index.html') || currentPath.endsWith('/index') || currentPath.endsWith('/');
        // Pages that require focus/conversion
        const isMinimalPage = currentPath.includes('/login') || currentPath.includes('/publish');

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
            script.src = this.getAdjustedPath('js/newsletter.js');
            document.head.appendChild(script);
        }

        // Setup dynamic spacing for fixed header to prevent overlap
        this.setupHeaderSpacing();
    },

    setupHeaderSpacing() {
        const adjustSpacing = () => {
            const header = document.querySelector('.main-header');
            if (!header) return;
            
            const height = header.offsetHeight;
            if (height === 0) return; // Not rendered yet

            let spacer = document.getElementById('dynamic-header-spacer');
            if (!spacer) {
                spacer = document.createElement('div');
                spacer.id = 'dynamic-header-spacer';
                spacer.style.width = '100%';
                spacer.style.display = 'block';
                spacer.style.flexShrink = '0';
                
                // Remove hardcoded spacer elements to prevent double spacing
                const staticSpacers = document.querySelectorAll('.h-28, .h-24, .h-32');
                staticSpacers.forEach(s => {
                    if(s.innerHTML.trim() === '' && !s.children.length) s.remove();
                });

                // Remove top-padding from main containers that were manually added
                const mainTags = document.querySelectorAll('main, section, div');
                mainTags.forEach(m => {
                    if (m.className && typeof m.className === 'string') {
                        // Remove top-padding and top-margins that were manually added
                        // For py-*, we convert it to pb-* to keep the bottom spacing
                        const newClass = m.className
                            .replace(/\bpt-(20|24|28|32)\b/g, '')
                            .replace(/\bmt-(16|20|24|28|32)\b/g, '')
                            .replace(/\bpy-(20|24|28|32)\b/g, (match) => match.replace('py-', 'pb-'))
                            .trim();
                        if (newClass !== m.className) m.className = newClass;
                    }
                });
                
                // insert after header placeholder
                const placeholder = document.getElementById('header-placeholder');
                if (placeholder && placeholder.parentNode) {
                    placeholder.parentNode.insertBefore(spacer, placeholder.nextSibling);
                } else {
                    document.body.insertBefore(spacer, document.body.firstChild);
                }
            }
            
            // On mobile, add a bit more safety space (+15px)
            const isMobile = window.innerWidth < 640;
            const safetyMargin = isMobile ? 15 : 0;
            const finalHeight = height + safetyMargin;
            
            spacer.style.height = finalHeight + 'px';
            spacer.style.minHeight = finalHeight + 'px';
            

            
            // Adjust scroll-padding-top for anchors (#)
            document.documentElement.style.scrollPaddingTop = (finalHeight + 20) + 'px';
        };

        // Run initially completely after rendering
        setTimeout(adjustSpacing, 50);
        setTimeout(adjustSpacing, 500); // Fail-safe for slow rendering

        // Re-calculate on resize
        window.addEventListener('resize', () => {
            requestAnimationFrame(adjustSpacing);
        });

        // Observer for dynamic changes inside the header (like promos expanding)
        const headerNode = document.querySelector('.main-header');
        if (headerNode) {
            const resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(adjustSpacing);
            });
            resizeObserver.observe(headerNode);
        }
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
            
            // SECURITY: Check if the fetched content is actually a full page (fallback)
            // If it contains <!DOCTYPE or <html, it's a server fallback and shouldn't be injected
            if (html.toLowerCase().includes('<!doctype') || html.toLowerCase().includes('<html')) {
                throw new Error(`Fetched content for ${path} appears to be a full HTML document (likely a fallback).`);
            }
            
            this.injectHTML(element, html);
        } catch (error) {
            // CORS / file:// fallback or missing file error: use inline HTML
            if (fallbackHTML) {
                this.injectHTML(element, fallbackHTML);
            } else {
                console.error(`[NewKet] Failed to load component ${path}:`, error);
            }
        }
    },

    injectHTML(element, html) {
        // Replace {{ROOT}} placeholder with actual relative path prefix
        const rootPrefix = this.getAdjustedPath('');
        
        // --- NEW: Sync Account Path Resolution ---
        const role = localStorage.getItem('newketRole');
        const email = localStorage.getItem('newketUserEmail');
        let accountPath = 'pages/login';
        
        if (role && email) {
            if (role === 'admin') accountPath = 'pages/admin/dashboard';
            else if (role === 'supplier') accountPath = 'pages/vendor-dashboard';
            else accountPath = 'pages/customer-dashboard';
        }
        
        // If file:// protocol, keep .html extensions
        const isFileProtocol = window.location.protocol === 'file:';
        if (isFileProtocol) {
            accountPath += '.html';
        }

        let processedHTML = html
            .replace(/{{ROOT}}/g, rootPrefix)
            .replace(/{{ACCOUNT_PATH}}/g, accountPath);
        
        // --- GLOBAL CLEAN URL CLEANUP for production ---
        if (!isFileProtocol) {
            // Remove .html from all links in the injected content
            processedHTML = processedHTML.replace(/href="([^"]+)\.html"/g, 'href="$1"');
        }
        
        element.innerHTML = processedHTML;
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
        // Utilisation robuste des chemins absolus via le serveur (Vite/Prod)
        if (window.location.protocol !== 'file:') {
            let adjusted = '/' + path;
            // Optional: Strip .html for clean URLs if it's an internal link
            // (Only for internal pages, not for files like .js or .css)
            if (adjusted.includes('.html') && !adjusted.match(/\.(js|css|png|jpg|webp|svg|jpeg)$/i)) {
                adjusted = adjusted.replace('.html', '');
            }
            return adjusted;
        }

        // Sécurité de contournement (Fallback pour ouverture des fichiers au protocole file://)
        const pathname = window.location.pathname;
        const parts = pathname.split('/').filter(p => p !== '');
        
        let depth = 0;
        const rIndex = parts.lastIndexOf('pages');
        if (rIndex !== -1) {
            depth = parts.length - rIndex - 1;
        } else {
            const srcIndex = parts.lastIndexOf('src');
            if (srcIndex !== -1 && !pathname.endsWith('index.html')) {
                depth = parts.length - srcIndex - 1;
            }
        }

        let prefix = '';
        for(let i=0; i<depth; i++) {
            prefix += '../';
        }
        
        return prefix + path;
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
