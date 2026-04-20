/**
 * NewKet Admin Layout Manager
 * Centralizes the Sidebar and Navbar for all Admin pages.
 */

const AdminLayout = {
    async init() {

        // 1. Security Check (Strict Admin only for admin/ folder)
        this.checkAccess();

        // 2. Inject CSS
        this.injectStyles();

        // 3. Inject Layout Components
        this.renderNavbar();
        this.renderSidebar();

        // 4. Global Event Listeners (Mobile menu etc)
        this.bindEvents();

    },

    checkAccess() {
        // Wait for AuthManager to be ready before checking role.
        // AuthManager.role may be null at parse time — always read from localStorage as fallback.
        const role = window.AuthManager?.role || localStorage.getItem('newketRole');

        if (!role) {
            // No role found. If we're here fromDOMContentLoaded without newketInitialized, we wait.
            // If newketInitialized has already fired and we STILL have no role, redirect.
            if (window.newketInitialized) {
                console.error('[NewKet] No role found after initialization.');
                window.location.href = window.resolvePath('login');
            }
            return;
        }

        if (role !== 'admin') {
            console.error('[NewKet] Unauthorized access to Admin CMS. Role:', role);
            window.location.href = window.resolvePath('login');
        }
    },

    injectStyles() {
        if (!document.querySelector('link[href*="admin.css"]')) {
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

    renderNavbar() {
        const navbarPlaceholder = document.getElementById('adminNavbarPlaceholder');
        if (!navbarPlaceholder || navbarPlaceholder.dataset.rendered === 'true') return;

        navbarPlaceholder.innerHTML = `
            <nav class="fixed top-0 w-full z-[100] bg-white/70 backdrop-blur-xl border-b border-gray-100/50 transition-all duration-300">
                <div class="max-w-[1800px] mx-auto px-4 sm:px-8 py-3 flex justify-between items-center h-[64px]">
                    <div class="flex items-center gap-6">
                        <button id="adminMobileMenuBtn" class="md:hidden p-2.5 bg-gray-50 rounded-xl text-gray-500 hover:text-black hover:bg-gray-100 focus:outline-none flex items-center justify-center transition-all">
                            <iconify-icon icon="solar:hamburger-menu-bold" width="22"></iconify-icon>
                        </button>
                        <a href="${this.getAdjustedPath('./')}" class="flex items-center gap-3 group">
                            <div class="relative">
                                <div class="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                <div class="relative w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
                                    <img src="/src/assets/Images/logo-newket.png" alt="NewKet" class="w-full h-full object-contain">
                                </div>
                            </div>
                            <div class="flex flex-col">
                                <span class="text-lg font-black tracking-tight text-gray-900 leading-none">NEWKET</span>
                                <span class="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 mt-1">Console Administration</span>
                            </div>
                        </a>
                    </div>

                    <div class="flex items-center gap-2 sm:gap-6">
                        <div class="hidden lg:flex items-center bg-gray-50/50 rounded-2xl p-1 border border-gray-100/50" id="currencyToggle" data-active="CDF">
                             <button data-currency="USD" class="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-white hover:shadow-sm text-gray-400">USD</button>
                             <button data-currency="CDF" class="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all bg-white shadow-sm text-black">CDF</button>
                        </div>

                        <div class="h-8 w-px bg-gray-100 mx-1 hidden sm:block"></div>

                        <div class="flex items-center gap-3">
                            <a href="/" target="_blank" class="hidden sm:flex h-10 px-4 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-black bg-gray-50/50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100/50">
                                 <iconify-icon icon="solar:globus-bold" width="16"></iconify-icon>
                                 Boutique
                            </a>

                            <button onclick="if(window.AuthManager) { this.disabled=true; this.innerHTML='...'; AuthManager.logout(); } else { window.location.reload(); }" class="h-10 px-4 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-white bg-red-50 hover:bg-red-500 rounded-xl transition-all border border-red-100/50 flex items-center gap-2">
                                <iconify-icon icon="solar:logout-bold" width="16"></iconify-icon>
                                <span class="hidden sm:inline">Quitter</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
        `;
        navbarPlaceholder.dataset.rendered = 'true';
    },

    renderSidebar() {
        const sidebarPlaceholder = document.getElementById('adminSidebarPlaceholder');
        if (!sidebarPlaceholder) return;

        const currentPath = window.location.pathname;
        const currentFile = currentPath.split('/').pop().replace('.html', '') || 'index';

        // Optimization: If already rendered, just update the active state to prevent flicker
        if (sidebarPlaceholder.dataset.rendered === 'true') {
            const sidebarLinks = sidebarPlaceholder.querySelectorAll('.sidebar-link');
            sidebarLinks.forEach(link => {
                const href = link.getAttribute('href').split('/').pop().replace('.html', '') || 'index';
                const isActive = currentFile === href || (href === 'index' && currentFile === '');
                link.classList.toggle('active', isActive);
            });
            return;
        }

        const links = [
            { href: window.resolvePath('admin/index'), icon: 'solar:home-smile-bold', label: "Vue d'ensemble" },
            { href: window.resolvePath('admin/user'), icon: 'solar:users-group-two-rounded-bold', label: "Gestion Vendeurs" },
            { href: window.resolvePath('admin/products'), icon: 'solar:box-bold', label: "Contrôle Catalogue" },
            { href: window.resolvePath('admin/orders'), icon: 'solar:bag-bold', label: "Commandes & Retraits" },
            { href: window.resolvePath('admin/activities'), icon: 'solar:history-bold', label: "Journal d'Activités" },
            { href: window.resolvePath('admin/diagnostics'), icon: 'solar:chart-square-bold', label: "Audit & Diagnostics" },
            { href: window.resolvePath('admin/reviews'), icon: 'solar:star-bold', label: "Avis & Modération" },
            { href: window.resolvePath('admin/newsletter'), icon: 'solar:letter-bold', label: "Newsletter" },
            { href: window.resolvePath('admin/notifications-admin'), icon: 'solar:bell-bing-bold', label: "Notifications" },
            { href: window.resolvePath('admin/support'), icon: 'solar:chat-round-dots-bold', label: "Support Platform" },
            { href: window.resolvePath('admin/security'), icon: 'solar:shield-keyhole-bold-duotone', label: "Sécurité & Admins" },
            { href: window.resolvePath('admin/settings'), icon: 'solar:settings-bold', label: "Paramètres", sub: true }
        ];

        let sidebarHTML = `
            <div id="adminOverlay" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] hidden transition-all duration-300"></div>
            <aside id="adminSidebar" class="fixed inset-y-0 left-0 w-72 bg-white z-[120] transform -translate-x-full md:translate-x-0 md:static md:w-72 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) h-screen md:h-auto overflow-y-auto border-r border-gray-100 flex-shrink-0">
                <div class="p-6 md:px-4 md:py-8 md:sticky md:top-[64px]">
                    <div class="md:glass-panel p-6 md:px-6 md:py-4">
                        <nav class="space-y-1">
        `;

        links.forEach(link => {
            if (link.sub) sidebarHTML += `<div class="py-4"><div class="h-px bg-gray-100 mb-4"></div>`;

            const isActive = currentPath.includes(link.href) || (link.href === '/src/pages/admin/index.html' && (currentPath.endsWith('/admin/') || currentPath.endsWith('/admin/index.html'))) ? 'active' : '';

            sidebarHTML += `
                <a href="${link.href}" class="sidebar-link ${isActive} group/link relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 mb-1 hover:bg-gray-50">
                    <div class="sidebar-icon-container flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/20 text-white shadow-lg backdrop-blur-md' : 'bg-gray-100/50 text-gray-400 group-hover/link:bg-white group-hover/link:text-black group-hover/link:shadow-sm'}">
                        <iconify-icon icon="${link.icon}" width="20"></iconify-icon>
                    </div>
                    <span class="text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-gray-500 group-hover/link:text-black'}">${link.label}</span>
                    ${isActive ? '<div class="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>' : ''}
                </a>
            `;

            if (link.sub) sidebarHTML += `</div>`;
        });

        sidebarHTML += `
                        </nav>
                    </div>
                </div>
            </aside>
        `;

        sidebarPlaceholder.innerHTML = sidebarHTML;
        sidebarPlaceholder.dataset.rendered = 'true';
    },

    bindEvents() {
        const menuBtn = document.getElementById('adminMobileMenuBtn');
        const sidebar = document.getElementById('adminSidebar');
        const overlay = document.getElementById('adminOverlay');

        if (menuBtn && sidebar && overlay) {
            const toggleMenu = () => {
                sidebar.classList.toggle('-translate-x-full');
                overlay.classList.toggle('hidden');
                document.body.classList.toggle('overflow-hidden');
            };

            menuBtn.addEventListener('click', toggleMenu);
            overlay.addEventListener('click', toggleMenu);
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
    AdminLayout.injectStyles();
    AdminLayout.renderNavbar();
    AdminLayout.renderSidebar();
    AdminLayout.bindEvents();
}

function _adminCheckAuth() {
    AdminLayout.checkAccess();
}

// Passe 1 : rendu immédiat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _adminRenderLayout);
} else {
    _adminRenderLayout();
}

// Passe 2 : vérification d'accès (attend que l'auth soit résolue)
if (window.newketInitialized) {
    _adminCheckAuth();
} else {
    window.addEventListener('newketInitialized', _adminCheckAuth);
}
