/**
 * NewKet Admin Layout Manager
 * Centralizes the Sidebar and Navbar for all Admin pages.
 */

const AdminLayout = {
    navigationLoadingKey: 'newket_admin_navigation_loading',
    shellIndexPath: '/src/pages/admin/index.html',
    shellViewMap: {
        index: 'overview',
        user: 'user',
        'user-details': 'user-details',
        products: 'products',
        orders: 'orders',
        'otp-guide': 'otp-guide',
        'otp-tracker': 'otp-tracker',
        realtime: 'realtime',
        analytics: 'analytics',
        activities: 'activities',
        diagnostics: 'diagnostics',
        reviews: 'reviews',
        newsletter: 'newsletter',
        'notifications-admin': 'notifications-admin',
        support: 'support',
        referrals: 'referrals',
        security: 'security',
        hero: 'hero',
        branding: 'branding',
        settings: 'settings',
        'notion-manager': 'notion-manager',
        comptabilite: 'comptabilite',
        disputes: 'disputes',
        'dispute-details': 'dispute-details',
        payouts: 'payouts'
    },

    ensureNoFoucStyles() {
        if (document.getElementById('nk-admin-nofouc')) return;
        const style = document.createElement('style');
        style.id = 'nk-admin-nofouc';
        style.textContent = `
            /* Keep the admin chrome stable while the page-specific content hydrates. */
            html.admin-layout-loading body {
                background: #f8fafc;
            }

            html.admin-layout-loading #adminNavbarPlaceholder,
            html.admin-layout-loading #adminSidebarPlaceholder {
                opacity: 1 !important;
                visibility: visible !important;
            }

            html.admin-layout-loading .admin-shell > main {
                opacity: 1 !important;
                filter: none !important;
                transition: none !important;
            }
        `;
        document.head.appendChild(style);
    },

    setLayoutLoading(isLoading) {
        this.ensureNoFoucStyles();
        document.documentElement.classList.toggle('admin-layout-loading', Boolean(isLoading));
    },

    markNavigationLoading() {
        try {
            sessionStorage.setItem(this.navigationLoadingKey, '1');
        } catch (_) {}
        this.setLayoutLoading(true);
    },

    consumeNavigationLoading() {
        try {
            const pending = sessionStorage.getItem(this.navigationLoadingKey) === '1';
            if (pending) {
                sessionStorage.removeItem(this.navigationLoadingKey);
            }
            return pending;
        } catch (_) {
            return false;
        }
    },

    isAdminPageContext() {
        const path = window.location.pathname || '';
        // Admin pages live under multiple path layouts depending on dev/prod routing.
        // Examples:
        // - /admin/index.html
        // - /src/pages/admin/index.html (Vite dev / direct file serving)
        return (
            path.includes('/admin/') ||
            path.endsWith('/admin') ||
            path.includes('/pages/admin/')
        );
    },

    isEmbeddedPage() {
        try {
            return new URL(window.location.href).searchParams.get('embedded') === '1';
        } catch (_) {
            return false;
        }
    },

    getCurrentShellView() {
        try {
            const url = new URL(window.location.href);
            const requestedView = url.searchParams.get('view');
            if (requestedView && Object.values(this.shellViewMap).includes(requestedView)) {
                return requestedView;
            }
        } catch (_) {}

        return this.shellViewMap[this.getCurrentAdminFile()] || 'overview';
    },

    getShellHref(view = 'overview') {
        if (!view || view === 'overview') return this.shellIndexPath;
        return `${this.shellIndexPath}?view=${encodeURIComponent(view)}`;
    },

    getShellHrefForFile(file = 'index') {
        const view = this.shellViewMap[file] || 'overview';
        if (view !== 'user-details') {
            return this.getShellHref(view);
        }

        try {
            const currentUrl = new URL(window.location.href);
            const email = currentUrl.searchParams.get('email');
            const shellUrl = new URL(this.getShellHref(view), window.location.origin);
            if (email) {
                shellUrl.searchParams.set('email', email);
            }
            return `${shellUrl.pathname}${shellUrl.search}`;
        } catch (_) {
            return this.getShellHref(view);
        }
    },

    shouldRedirectLegacyPage() {
        if (!this.isAdminPageContext() || this.isEmbeddedPage()) return false;
        return this.getCurrentAdminFile() !== 'index';
    },

    redirectLegacyPageToShell() {
        if (!this.shouldRedirectLegacyPage()) return false;
        window.location.replace(this.getShellHrefForFile(this.getCurrentAdminFile()));
        return true;
    },

    getCurrentAdminFile(path = window.location.pathname || '') {
        if (!path) return 'index';
        if (path.endsWith('/admin') || path.endsWith('/admin/')) return 'index';

        const file = path.split('/').pop().replace('.html', '');
        return file || 'index';
    },

    async init() {

        // 1. Security Check (Strict Admin only for admin/ folder)
        this.checkAccess();

        // 2. Inject CSS
        this.injectStyles();
        this.promoteEmbeddedStyles();

        // Avoid visual jump: keep admin shell hidden until auth + SidebarManager settle.
        this.setLayoutLoading(true);

        // 3. Inject Layout Components
        this.renderNavbar();
        this.renderSidebar();

        // 3.5 Initialize Sidebar State
        if (window.SidebarManager) {
            window.SidebarManager.init('adminSidebar', 'admin-content');
        }

        // 4. Global Event Listeners (Mobile menu etc)
        this.bindEvents();

        // 5. Update Profile Info
        this.updateAdminProfile();
        window.addEventListener('profileUpdated', () => this.updateAdminProfile());
        window.addEventListener('componentsLoaded', () => this.updateAdminProfile());

        this.maybeDebugLayout('init');
    },

    checkAccess() {
        if (!this.isAdminPageContext()) return;

        const authReady = window.newketInitialized === true;
        const liveRole = window.AuthManager?.role || null;
        const storedRole = localStorage.getItem('newketRole');
        const role = authReady ? liveRole : (liveRole || storedRole);

        if (!role) {
            if (authReady) {
                try {
                    localStorage.removeItem('newketRole');
                } catch (_) {}
                console.error('[NewKet] No role found after initialization.');
                window.location.href = this.resolveAppPath('login');
            }
            return;
        }

        if (authReady && liveRole !== 'admin') {
            try {
                if (storedRole && storedRole !== liveRole) {
                    localStorage.removeItem('newketRole');
                }
            } catch (_) {}
            console.error('[NewKet] Unauthorized access to Admin CMS after auth resolution. Role:', liveRole);
            window.location.href = this.resolveAppPath('login');
            return;
        }

        if (!authReady && role !== 'admin') {
            console.error('[NewKet] Unauthorized access to Admin CMS. Role:', role);
            window.location.href = this.resolveAppPath('login');
        }
    },

    injectStyles() {
        const hasAdminCss = Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).some((link) => {
            const href = link.getAttribute('href') || '';
            return href.includes('/src/assets/css/admin.css') ||
                href.includes('/css/admin.css') ||
                /\/assets\/admin-[^/]+\.css(?:[?#].*)?$/.test(href);
        });

        if (!hasAdminCss) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/src/assets/css/admin.css';
            document.head.appendChild(link);
        }
    },

    getAdjustedPath(path) {
        if (!path) return '/src/pages/admin/index.html';
        
        // Handle root-relative paths
        if (path === './') return '/src/pages/admin/index.html';
        
        // Ensure path starts with / and ends with .html if it's a local page
        let adjusted = path;
        if (!adjusted.startsWith('/') && !adjusted.startsWith('http')) {
            adjusted = '/src/pages/admin/' + adjusted;
        }
        if (adjusted.includes('/src/pages/admin/') && !adjusted.endsWith('.html')) {
            adjusted += '.html';
        }
        
        return adjusted;
    },

    resolveAppPath(path) {
        if (typeof window.resolvePath === 'function') {
            return window.resolvePath(path);
        }

        if (!path) return '/';
        if (path === 'login') return '/src/pages/login.html';

        if (path.startsWith('admin/')) {
            const adminPath = path.replace(/^admin\//, '');
            return this.getAdjustedPath(adminPath);
        }

        return path.startsWith('/') ? path : `/${path}`;
    },

    setupEmbeddedMode() {
        if (!this.isEmbeddedPage() || document.getElementById('nk-admin-embedded-style')) return;

        document.documentElement.classList.add('admin-embedded-mode');
        document.body?.classList.add('admin-embedded-mode');

        const style = document.createElement('style');
        style.id = 'nk-admin-embedded-style';
        style.textContent = `
            html.admin-embedded-mode,
            html.admin-embedded-mode body {
                background: #f8fafc !important;
                margin: 0 !important;
            }

            html.admin-embedded-mode #adminNavbarPlaceholder,
            html.admin-embedded-mode #adminSidebarPlaceholder,
            html.admin-embedded-mode #adminOverlay,
            html.admin-embedded-mode #adminSidebar,
            html.admin-embedded-mode #adminMobileMenuBtn {
                display: none !important;
            }

            html.admin-embedded-mode .admin-shell {
                max-width: none !important;
                margin: 0 !important;
                padding-top: 0 !important;
                padding: 0 0.375rem 0.375rem !important;
                display: block !important;
                grid-template-columns: minmax(0, 1fr) !important;
                gap: 0 !important;
                overflow-x: visible !important;
            }

            html.admin-embedded-mode .admin-shell > main {
                width: 100% !important;
                min-width: 0 !important;
                max-width: none !important;
                padding-top: 0 !important;
                margin-top: 0 !important;
            }
        `;
        document.head.appendChild(style);

        const postMetrics = () => {
            try {
                const main = document.querySelector('.admin-shell > main');
                const height = Math.max(
                    main?.scrollHeight || 0,
                    document.body.scrollHeight || 0,
                    document.documentElement.scrollHeight || 0
                );
                window.parent?.postMessage({
                    type: 'newket-admin-embed-metrics',
                    view: this.getCurrentShellView(),
                    height,
                    title: document.title
                }, window.location.origin);
            } catch (_) {}
        };

        window.addEventListener('load', postMetrics);
        window.addEventListener('resize', postMetrics);
        window.setTimeout(postMetrics, 0);
        window.setTimeout(postMetrics, 250);

        if (!window.__newketAdminEmbeddedObserver) {
            const observer = new ResizeObserver(() => postMetrics());
            observer.observe(document.body);
            const main = document.querySelector('.admin-shell > main');
            if (main) observer.observe(main);
            window.__newketAdminEmbeddedObserver = observer;
        }

        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
            if (link.target && link.target !== '_self') return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin) return;
            if (!url.pathname.includes('/src/pages/admin/')) return;

            event.preventDefault();
            window.parent?.postMessage({
                type: 'newket-admin-embed-navigate',
                view: this.shellViewMap[this.getCurrentAdminFile(url.pathname)] || 'overview'
            }, window.location.origin);
        }, true);
    },

    promoteEmbeddedStyles() {
        if (!this.isEmbeddedPage()) return;

        document.documentElement.classList.add('admin-embedded-mode');
        document.body?.classList.add('admin-embedded-mode');

        const style = document.getElementById('nk-admin-embedded-style');
        if (style?.parentNode) {
            style.parentNode.appendChild(style);
        }
    },

    renderNavbar() {
        const navbarPlaceholder = document.getElementById('adminNavbarPlaceholder');
        if (!navbarPlaceholder || navbarPlaceholder.dataset.rendered === 'true') return;

        navbarPlaceholder.innerHTML = `
            <nav class="dashboard-topbar newket-dashboard-header fixed top-0 w-full z-[100] transition-all duration-300">
                <div class="dashboard-topbar-inner max-w-[1800px] mx-auto py-3 flex justify-between items-center h-[64px] sm:h-[96px] relative">
                    <div class="flex items-center gap-4 sm:gap-6">
                        <button id="adminMobileMenuBtn" data-toggle-sidebar="admin" class="p-2.5 text-gray-500 hover:text-black focus:outline-none focus:ring-0 focus-visible:outline-none flex items-center justify-center transition-all rounded-xl">
                            <iconify-icon icon="solar:hamburger-menu-bold" width="22"></iconify-icon>
                        </button>
                    </div>

                    <!-- Center Logo -->
                    <div class="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <a href="/" class="flex items-center justify-center group nk-header-logo-link" aria-label="Accueil NewKet">
                            <img src="https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572408/newket_assets/racine/Logo_NewKet_Pour_Les_HEADERs_Only.png" alt="NewKet Logo" class="header-brand-image h-10 sm:h-14 w-auto object-contain" onerror="this.src='https://res.cloudinary.com/dzhnphyp3/image/upload/c_limit,w_400,f_auto,q_auto/v1782572406/newket_assets/racine/Logo_Header_Officiel_PNG.png'; this.onerror=null;">
                        </a>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="h-8 w-px bg-white/15 mx-1 hidden sm:block"></div>

                        <div class="flex items-center gap-3">
                            <a href="/" class="hidden sm:flex h-10 px-4 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black bg-gray-50/50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100/50">
                                 <iconify-icon icon="solar:globus-bold" width="16"></iconify-icon>
                                 Boutique
                            </a>

                            <button data-logout-safe onclick="AuthManager.handleLogoutClick(this)" class="h-10 w-10 sm:w-auto sm:px-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-white bg-red-50 hover:bg-red-500 rounded-xl transition-all border border-red-100/50 flex items-center justify-center gap-2">
                                <iconify-icon icon="solar:logout-bold" width="16"></iconify-icon>
                                <span class="hidden sm:inline">Quitter</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
        `;

        // Offline network status icon
        const topbarRight = navbarPlaceholder.querySelector('.dashboard-topbar-inner > div:last-child');
        if (topbarRight) {
            const networkDiv = document.createElement('div');
            networkDiv.id = 'networkStatusIcon';
            networkDiv.className = 'hidden flex items-center justify-center text-red-500 bg-red-50 h-10 w-10 sm:w-auto sm:px-4 rounded-xl border border-red-100/50 tooltip-trigger transition-all';
            networkDiv.setAttribute('title', 'Vous êtes hors ligne');
            networkDiv.innerHTML = `
                <iconify-icon icon="mdi:wifi-off" width="20"></iconify-icon>
                <span class="hidden sm:inline ml-2 text-[10px] font-black uppercase tracking-widest">Hors ligne</span>
            `;
            // Insert at the beginning of the right container
            topbarRight.insertBefore(networkDiv, topbarRight.firstChild);
            const updateNetworkStatus = () => {
                if (navigator.onLine) {
                    networkDiv.classList.add('hidden');
                } else {
                    networkDiv.classList.remove('hidden');
                }
            };
            window.addEventListener('online', updateNetworkStatus);
            window.addEventListener('offline', updateNetworkStatus);
            updateNetworkStatus();
        }

        if (window.CurrencyManager && typeof CurrencyManager.updateCurrencyUI === 'function') {
            CurrencyManager.updateCurrencyUI();
        }

        // Ensure admin pages re-render monetary values on currency change
        if (!window.__newketAdminCurrencyBound) {
            window.__newketAdminCurrencyBound = true;

            window.addEventListener('currencyChanged', () => {
                try {
                    if (typeof window.refreshDashboardData === 'function') return window.refreshDashboardData();
                    if (typeof window.handleSearch === 'function') return window.handleSearch();
                    if (typeof window.renderAdminOrders === 'function') return window.renderAdminOrders();
                    if (typeof window.renderAdminProducts === 'function') return window.renderAdminProducts();
                    if (typeof window.renderUsers === 'function') return window.renderUsers();
                    if (typeof window.renderDiagnostics === 'function') return window.renderDiagnostics();
                    if (typeof window.renderActivities === 'function') return window.renderActivities();
                    if (typeof window.renderNotifications === 'function') return window.renderNotifications();
                    if (typeof window.renderReviews === 'function') return window.renderReviews();
                    if (typeof window.renderAdmins === 'function') return window.renderAdmins();
                    if (typeof window.renderStats === 'function') return window.renderStats();
                    if (typeof window.loadSubscribers === 'function') return window.loadSubscribers();
                    if (typeof window.loadUserDetails === 'function') return window.loadUserDetails();
                    if (window.CurrencyManager && typeof CurrencyManager.updateAllPrices === 'function') {
                        CurrencyManager.updateAllPrices();
                    }
                } catch (_) {}
            });
        }
        navbarPlaceholder.dataset.rendered = 'true';
        this.maybeDebugLayout('renderNavbar');
    },

    renderSidebar() {
        const sidebarPlaceholder = document.getElementById('adminSidebarPlaceholder');
        if (!sidebarPlaceholder) return;

        const currentPath = window.location.pathname;
        const currentFile = this.getCurrentAdminFile(currentPath);
        const currentView = this.getCurrentShellView();
        const getSidebarLabelClass = (label) => {
            const text = String(label || '').trim();
            return text.length > 14 ? 'sidebar-link-label--compact' : '';
        };

        // Optimization: If already rendered, just update the active state to prevent flicker
        if (sidebarPlaceholder.dataset.rendered === 'true') {
            const sidebarLinks = sidebarPlaceholder.querySelectorAll('.sidebar-link');
            sidebarLinks.forEach(link => {
                const href = link.getAttribute('href') || '';
                const url = new URL(href, window.location.origin);
                const hrefView = url.searchParams.get('view') || this.shellViewMap[this.getCurrentAdminFile(url.pathname)] || 'overview';
                const isActive = currentView === hrefView;
                link.classList.toggle('active', isActive);
            });
            return;
        }

        if (typeof window.resolvePath !== 'function') {
            window.resolvePath = (path) => {
                if (!path) return '/';
                if (path === 'login') return '/src/pages/login.html';
                if (path.startsWith('admin/')) {
                    return this.getAdjustedPath(path.replace(/^admin\//, ''));
                }
                return path.startsWith('/') ? path : `/${path}`;
            };
        }

        const links = [
            { href: this.getShellHref('overview'), icon: 'solar:home-smile-bold', label: "Vue d'ensemble", view: 'overview', section: 'Général' },
            { href: this.getShellHref('realtime'), icon: 'solar:users-group-two-rounded-bold-duotone', label: 'Temps réel', view: 'realtime', section: 'Général' },

            { href: this.getShellHref('analytics'), icon: 'solar:graph-up-bold', label: 'Comportements', view: 'analytics', section: 'Analytique' },
            { href: this.getShellHref('comptabilite'), icon: 'solar:wallet-bold', label: 'Comptabilité', view: 'comptabilite', section: 'Analytique' },
            { href: this.getShellHref('activities'), icon: 'solar:history-bold', label: "Journal d'Activités", view: 'activities', section: 'Analytique' },
            { href: this.getShellHref('diagnostics'), icon: 'solar:chart-square-bold', label: 'Audit & Diagnostics', view: 'diagnostics', section: 'Analytique' },

            { href: this.getShellHref('user'), icon: 'solar:users-group-two-rounded-bold', label: 'Gestion Vendeurs', view: 'user', section: 'Catalogue' },
            { href: this.getShellHref('notion-manager'), icon: 'simple-icons:notion', label: 'Gestionnaire Notion', view: 'notion-manager', section: 'Catalogue' },
            { href: this.getShellHref('products'), icon: 'solar:box-bold', label: 'Contrôle Catalogue', view: 'products', section: 'Catalogue' },
            { href: this.getShellHref('reviews'), icon: 'solar:star-bold', label: 'Avis & Modération', view: 'reviews', section: 'Catalogue' },

            { href: this.getShellHref('orders'), icon: 'solar:bag-bold', label: 'Commandes & Retraits', view: 'orders', section: 'Opérations' },
            { href: this.getShellHref('disputes'), icon: 'solar:shield-warning-bold', label: 'Gestion des Litiges', view: 'disputes', section: 'Opérations' },
            { href: this.getShellHref('payouts'), icon: 'solar:wallet-money-bold', label: 'Payouts Vendeurs', view: 'payouts', section: 'Opérations' },
            { href: this.getShellHref('notifications-admin'), icon: 'solar:bell-bing-bold', label: 'Notifications', view: 'notifications-admin', section: 'Opérations' },
            { href: this.getShellHref('support'), icon: 'solar:chat-round-dots-bold', label: 'Support Platform', view: 'support', section: 'Opérations' },
            { href: this.getShellHref('newsletter'), icon: 'solar:letter-bold', label: 'Newsletter', view: 'newsletter', section: 'Opérations' },

            { href: this.getShellHref('referrals'), icon: 'solar:gift-bold', label: 'Parrainage Système', view: 'referrals', section: 'Système' },
            { href: this.getShellHref('security'), icon: 'solar:shield-keyhole-bold-duotone', label: 'Sécurité & Admins', view: 'security', section: 'Système' },
            { href: this.getShellHref('otp-guide'), icon: 'solar:password-bold', label: 'Guide', view: 'otp-guide', section: 'Système' },
            { href: this.getShellHref('otp-tracker'), icon: 'solar:password-minimalistic-input-bold-duotone', label: 'OTP Tracker', view: 'otp-tracker', section: 'Système' },
            { href: this.getShellHref('branding'), icon: 'solar:palette-round-bold', label: 'Branding & Thème', view: 'branding', section: 'Système' },
            { href: this.getShellHref('hero'), icon: 'solar:gallery-wide-bold-duotone', label: 'HERO (Accueil)', view: 'hero', section: 'Système' },
            { href: this.getShellHref('settings'), icon: 'solar:settings-bold', label: 'Paramètres', view: 'settings', sub: true, section: 'Système' }
        ];

        let sidebarHTML = `
            <div id="adminOverlay" class="fixed inset-0 bg-black/50 z-[110] hidden transition-all duration-300"></div>
            <aside id="adminSidebar" class="fixed inset-0 w-screen max-w-none bg-white z-[120] transform -translate-x-full lg:translate-x-0 lg:static lg:inset-auto lg:w-72 lg:relative transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) h-screen lg:h-auto overflow-y-auto border-0 lg:border-r border-gray-100 flex-shrink-0">
                
                <!-- Desktop Collapse Toggle -->
                <button type="button" class="sidebar-toggle-btn hidden lg:flex rounded-xl" aria-label="Réduire le menu" onclick="SidebarManager.toggle()" data-no-close>
                    <iconify-icon icon="solar:alt-arrow-left-linear" width="18"></iconify-icon>
                </button>
                

                <div class="min-h-0 px-6 pb-6 pt-0 lg:min-h-0 lg:px-4 lg:pb-8 lg:pt-0 lg:sticky lg:top-[64px]">
                    <!-- Admin Profile Header -->
                    <div class="mb-6">
                        <div class="flex items-center gap-3 p-3 rounded-2xl bg-gray-50/50 border border-gray-100/50 shadow-sm transition-all hover:bg-gray-100/50">
                            <div class="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center font-black text-[11px] uppercase tracking-widest shadow-sm border border-white/15 overflow-hidden shrink-0">
                                <img id="adminAvatarImg" src="" alt="" class="w-full h-full object-cover hidden" referrerpolicy="no-referrer" crossorigin="anonymous">
                                <span id="adminAvatarPlaceholder">A</span>
                            </div>
                            <div class="flex flex-col min-w-0 flex-1">
                                <span id="adminDisplayName" class="text-sm font-bold text-gray-900 truncate">Admin</span>
                                <span class="text-[9px] font-bold text-green-600 flex items-center gap-1 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    Système Actif
                                </span>
                            </div>
                            <button onclick="SidebarManager.close()" class="lg:hidden p-2 bg-white rounded-xl text-gray-500 hover:text-black hover:bg-gray-100 transition-all shadow-sm border border-gray-100/50 flex-shrink-0">
                                <iconify-icon icon="solar:close-circle-bold" width="22"></iconify-icon>
                            </button>
                        </div>
                    </div>

                    <div class="glass-panel min-h-[calc(100vh-6rem)] rounded-none border-0 shadow-none p-6 md:px-6 md:py-4 lg:min-h-0 lg:rounded-[1.5rem] lg:border lg:shadow-sm">
                        <nav class="space-y-1" aria-label="Navigation Admin">
        `;

        let lastSection = null;
        links.forEach(link => {
            if (link.section && link.section !== lastSection) {
                lastSection = link.section;
                sidebarHTML += `
                    <div class="sidebar-section-title mt-4 mb-2 px-4 text-[10px] font-black tracking-widest text-gray-400 uppercase">${link.section}</div>
                `;
            }
            if (link.sub) sidebarHTML += `<div class="py-4"><div class="h-px bg-gray-100 mb-4"></div>`;

            // --- Dropdown / Accordion Link ---
            if (link.dropdown && link.children) {
                const isParentActive = link.matchPaths?.some(p => currentPath.includes(p)) || false;
                const openClass = isParentActive ? 'sidebar-dropdown--open' : '';

                sidebarHTML += `
                <div class="sidebar-dropdown ${openClass}" data-dropdown="${link.dropdown}">
                    <button
                        type="button"
                        onclick="AdminLayout._toggleDropdown('${link.dropdown}')"
                        class="sidebar-link ${isParentActive ? 'active' : ''} group/link relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 mb-1 hover:bg-gray-50 w-full text-left"
                    >
                        <div class="sidebar-icon-container flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${isParentActive ? 'bg-white/20 text-white shadow-lg backdrop-blur-md' : 'bg-gray-100/50 text-gray-400 group-hover/link:bg-white group-hover/link:text-black group-hover/link:shadow-sm'}">
                            <iconify-icon icon="${link.icon}" width="20"></iconify-icon>
                        </div>
                        <span class="flex-1 text-sm font-bold tracking-tight ${isParentActive ? 'text-white' : 'text-gray-500 group-hover/link:text-black'}">${link.label}</span>
                        <iconify-icon
                            icon="solar:alt-arrow-down-bold"
                            width="16"
                            class="sidebar-dropdown__chevron transition-transform duration-300 ${isParentActive ? 'text-white rotate-180' : 'text-gray-400 group-hover/link:text-black'}"
                        ></iconify-icon>
                    </button>
                    <div class="sidebar-dropdown__body overflow-hidden transition-all duration-300" style="${isParentActive ? '' : 'max-height:0;opacity:0;'} ">
                        <div class="ml-4 pl-4 border-l-2 border-gray-100 space-y-0.5 py-1 mb-1">
                `;

                link.children.forEach(child => {
                    const isChildActive = currentPath === child.href.split('?')[0] ||
                        (currentPath.includes(child.href.split('?')[0]) && child.href.includes('?') && window.location.search === '?' + child.href.split('?')[1]);
                    sidebarHTML += `
                        <a href="${child.href}" class="sidebar-link-child ${isChildActive ? 'active-child' : ''} group/child flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-gray-50">
                            <div class="flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-200 ${isChildActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 group-hover/child:bg-gray-200 group-hover/child:text-black'}">
                                <iconify-icon icon="${child.icon}" width="14"></iconify-icon>
                            </div>
                            <span class="text-xs font-bold tracking-tight ${getSidebarLabelClass(child.label)} ${isChildActive ? 'text-blue-600' : 'text-gray-400 group-hover/child:text-black'}">${child.label}</span>
                        </a>
                    `;
                });

                sidebarHTML += `
                        </div>
                    </div>
                </div>
                `;

            } else {
                // --- Regular Link ---
                const isActive = currentView === (link.view || 'overview') ? 'active' : '';
                sidebarHTML += `
                    <a href="${link.href}" class="sidebar-link ${isActive} group/link relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 mb-1 hover:bg-gray-50">
                        <div class="sidebar-icon-container flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${isActive ? 'bg-slate-900 text-white shadow-lg' : 'bg-gray-100/50 text-gray-400 group-hover/link:bg-white group-hover/link:text-black group-hover/link:shadow-sm'}">
                            <iconify-icon icon="${link.icon}" width="20"></iconify-icon>
                        </div>
                        <span class="text-sm font-bold tracking-tight ${getSidebarLabelClass(link.label)} ${isActive ? 'text-slate-900' : 'text-gray-500 group-hover/link:text-black'}">${link.label}</span>
                        ${isActive ? '<div class="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>' : ''}
                    </a>
                `;
            }

            if (link.sub) sidebarHTML += `</div>`;
        });

        sidebarHTML += `
                        </nav>
                        <div class="mt-6 pt-5 border-t border-gray-100 lg:hidden">
                            <p class="text-xs text-gray-500 mb-3 font-semibold">Devise d'affichage</p>
                            <div class="currency-switch-segmented scale-90 origin-left w-fit" id="currencyToggle" data-active="CDF" title="Devise d'affichage">
                                <div class="segmented-track">
                                    <div class="segmented-handle"></div>
                                    <span class="segmented-label" data-currency="USD">USD</span>
                                    <span class="segmented-label" data-currency="CDF">CDF</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </aside>
        `;

        sidebarPlaceholder.innerHTML = sidebarHTML;
        sidebarPlaceholder.dataset.rendered = 'true';
        this.maybeDebugLayout('renderSidebar');

        // Initialize open dropdowns after render
        sidebarPlaceholder.querySelectorAll('.sidebar-dropdown--open').forEach(el => {
            const body = el.querySelector('.sidebar-dropdown__body');
            if (body) { body.style.maxHeight = body.scrollHeight + 'px'; body.style.opacity = '1'; }
        });
    },

    _toggleDropdown(id) {
        const dropdown = document.querySelector(`.sidebar-dropdown[data-dropdown="${id}"]`);
        if (!dropdown) return;
        const body = dropdown.querySelector('.sidebar-dropdown__body');
        const chevron = dropdown.querySelector('.sidebar-dropdown__chevron');
        const btn = dropdown.querySelector('button.sidebar-link');
        const isOpen = dropdown.classList.contains('sidebar-dropdown--open');

        // Close all other open dropdowns
        document.querySelectorAll('.sidebar-dropdown--open').forEach(el => {
            if (el !== dropdown) {
                el.classList.remove('sidebar-dropdown--open');
                const b = el.querySelector('.sidebar-dropdown__body');
                const c = el.querySelector('.sidebar-dropdown__chevron');
                if (b) { b.style.maxHeight = '0'; b.style.opacity = '0'; }
                if (c) c.classList.remove('rotate-180');
            }
        });

        if (isOpen) {
            dropdown.classList.remove('sidebar-dropdown--open');
            if (body) { body.style.maxHeight = '0'; body.style.opacity = '0'; }
            if (chevron) chevron.classList.remove('rotate-180');
        } else {
            dropdown.classList.add('sidebar-dropdown--open');
            if (body) { body.style.maxHeight = body.scrollHeight + 'px'; body.style.opacity = '1'; }
            if (chevron) chevron.classList.add('rotate-180');
        }
    },

    bindEvents() {
        if (this._boundNavigationLoading) return;
        this._boundNavigationLoading = true;

        document.addEventListener('click', (event) => {
            const link = event.target.closest('#adminSidebar a[href], #adminNavbarPlaceholder a[href]');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
            if (link.target && link.target !== '_self') return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const url = new URL(link.href, window.location.origin);
            const isSameOrigin = url.origin === window.location.origin;
            const isAdminTarget = url.pathname.includes('/src/pages/admin/') || url.pathname.endsWith('/src/pages/admin');

            if (isSameOrigin && isAdminTarget) {
                const nextView = url.searchParams.get('view') || this.shellViewMap[this.getCurrentAdminFile(url.pathname)] || 'overview';
                if (typeof window.AdminShell?.navigate === 'function') {
                    event.preventDefault();
                    window.AdminShell.navigate(nextView);
                    return;
                }
                this.markNavigationLoading();
            }
        }, true);
    },

    maybeDebugLayout(stage) {
        try {
            const url = new URL(window.location.href);
            if (!url.searchParams.has('debugLayout')) return;

            const pick = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                return {
                    sel,
                    id: el.id || null,
                    className: typeof el.className === 'string' ? el.className : null,
                    rect: {
                        left: r.left,
                        top: r.top,
                        width: r.width,
                        height: r.height,
                        right: r.right,
                        bottom: r.bottom
                    },
                    computed: {
                        position: cs.position,
                        inset: cs.inset,
                        left: cs.left,
                        right: cs.right,
                        top: cs.top,
                        bottom: cs.bottom,
                        width: cs.width,
                        maxWidth: cs.maxWidth,
                        transform: cs.transform,
                        overflowX: cs.overflowX,
                        overflowY: cs.overflowY,
                        display: cs.display
                    }
                };
            };

            const snapshot = {
                stage,
                ts: new Date().toISOString(),
                viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
                scroll: { x: window.scrollX, y: window.scrollY },
                htmlClass: document.documentElement.className,
                bodyClass: document.body.className,
                sidebarCollapsedKey: localStorage.getItem('newketSidebarCollapsed'),
                nodes: {
                    shell: pick('.admin-shell'),
                    sidebarPlaceholder: pick('#adminSidebarPlaceholder'),
                    sidebar: pick('#adminSidebar'),
                    main: pick('.admin-shell > main'),
                    navbar: pick('.dashboard-topbar')
                },
                docScrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth
            };

            // eslint-disable-next-line no-console
            console.log('[NewKet][LayoutDebug]', snapshot);

            window.clearTimeout(window.__nkLayoutDebugTimer);
            window.__nkLayoutDebugTimer = window.setTimeout(() => {
                try { this.maybeDebugLayout(stage + ':t+2000ms'); } catch (_) {}
            }, 2000);
        } catch (_) {}
    },

    async updateAdminProfile() {
        const profile = window.ProfileManager ? window.ProfileManager.getProfile() : {};
        const name = profile.name || localStorage.getItem('newketUserName') || 'Admin';
        let avatarUrl =
            profile.avatar ||
            profile.avatar_url ||
            profile.picture ||
            profile.picture_url ||
            profile.photo_url ||
            profile.photoURL ||
            profile.avatarUrl ||
            localStorage.getItem('newketUserAvatar');

        if (!avatarUrl && window.SupabaseAdapter?.getClient) {
            try {
                const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                avatarUrl =
                    user?.user_metadata?.avatar_url ||
                    user?.user_metadata?.avatarUrl ||
                    user?.user_metadata?.pictureUrl ||
                    user?.user_metadata?.pictureURL ||
                    user?.user_metadata?.picture ||
                    user?.user_metadata?.picture_url ||
                    user?.user_metadata?.photo_url ||
                    user?.user_metadata?.photoURL ||
                    user?.user_metadata?.avatar ||
                    user?.identities?.[0]?.identity_data?.avatar ||
                    user?.identities?.[0]?.identity_data?.picture ||
                    user?.identities?.[0]?.identity_data?.picture_url ||
                    user?.identities?.[0]?.identity_data?.avatar_url ||
                    avatarUrl;

                if (!avatarUrl && user?.id && window.SupabaseAdapter.fetchWithFilters) {
                    const dbProfile = await window.SupabaseAdapter.fetchWithFilters('users', {
                        eq: [['id', user.id]],
                        single: true,
                        skipCache: true
                    });
                    avatarUrl =
                        dbProfile?.avatar ||
                        dbProfile?.avatar_url ||
                        dbProfile?.picture ||
                        dbProfile?.picture_url ||
                        dbProfile?.photo_url ||
                        dbProfile?.photoURL ||
                        dbProfile?.avatarUrl ||
                        avatarUrl;
                }
            } catch (_) {}
        }

        const nameEl = document.getElementById('adminDisplayName');
        if (nameEl) nameEl.textContent = name;

        if (window.renderAvatar) {
            window.renderAvatar(name, avatarUrl, 'adminAvatarImg', 'adminAvatarPlaceholder');
        }
    }
};

window.AdminLayout = AdminLayout;

// ─── STRATÉGIE DOUBLE-PASSE ─────────────────────────────────────────────────
//
//  PASSE 1 — Rendu immédiat (DOMContentLoaded)
//  → Injecte la navbar et la sidebar sans attendre l'auth.
//  → Élimine le FOUC (flash of unstyled content) lors de la navigation.
//
//  PASSE 2 — Vérification d'accès (newketInitialized)
//  → Une fois AuthManager prêt, on vérifie le rôle.
//  → Si non-admin, redirection vers /pages/login.
//
// ────────────────────────────────────────────────────────────────────────────

function _adminRenderLayout() {
    if (!AdminLayout.isAdminPageContext()) return;
    AdminLayout.consumeNavigationLoading();
    AdminLayout.setLayoutLoading(true);
    AdminLayout.injectStyles();
    AdminLayout.renderNavbar();
    AdminLayout.renderSidebar();
    AdminLayout.bindEvents();

    // Initialise SidebarManager dès la Passe 1 pour que le burger soit
    // fonctionnel avant même que l'auth soit résolue.
    // setupGlobalClickHandlers() est protégé par `state.initialized` et
    // ne s'enregistre qu'une seule fois ; un double appel en Passe 2 est
    // donc sans effet secondaire.
    if (window.SidebarManager) {
        window.SidebarManager.init('adminSidebar', 'admin-content', 'adminOverlay');
    }

    AdminLayout.maybeDebugLayout('pass1');
}

function _adminCheckAuth() {
    if (!AdminLayout.isAdminPageContext()) return;
    AdminLayout.checkAccess();
    AdminLayout.updateAdminProfile();
    // Init SidebarManager after auth is ready (SidebarManager is guaranteed available at this point)
    if (window.SidebarManager) {
        window.SidebarManager.init('adminSidebar', 'admin-content', 'adminOverlay');
    }

    // Reveal the shell only once the pass2 layout state has been applied.
    // Double-rAF ensures styles/class changes are committed before paint.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            AdminLayout.setLayoutLoading(false);
        });
    });
    AdminLayout.maybeDebugLayout('pass2');
}

function _hasAdminLayoutPlaceholders() {
    return Boolean(
        document.getElementById('adminNavbarPlaceholder') &&
        document.getElementById('adminSidebarPlaceholder')
    );
}

if (AdminLayout.isAdminPageContext()) {
    AdminLayout.setupEmbeddedMode();

    if (!AdminLayout.redirectLegacyPageToShell()) {
        // Passe 1 : rendu immediat
        if (_hasAdminLayoutPlaceholders()) {
            _adminRenderLayout();
        } else if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _adminRenderLayout);
        } else {
            _adminRenderLayout();
        }

        // Passe 2 : verification d'acces (attend que l'auth soit resolue)
        if (window.newketInitialized) {
            _adminCheckAuth();
        } else {
            window.addEventListener('newketInitialized', _adminCheckAuth);
        }
    }
}
