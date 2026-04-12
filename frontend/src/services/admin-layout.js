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

        // If no role found at all, wait 800ms then re-check once (handles async auth init)
        if (!role) {
            setTimeout(() => {
                const retryRole = window.AuthManager?.role || localStorage.getItem('newketRole');
                if (retryRole !== 'admin') {
                    console.error('[NewKet] Unauthorized after retry. Role:', retryRole);
                    window.location.href = '/pages/login';
                }
            }, 800);
            return;
        }

        if (role !== 'admin') {
            console.error('[NewKet] Unauthorized access to Admin CMS. Role:', role);
            window.location.href = '/pages/login';
        }
    },

    injectStyles() {
        if (!document.querySelector('link[href*="admin.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/admin.css';
            document.head.appendChild(link);
        }
    },

    getAdjustedPath(path) {
        if (!path) return './';
        // Local file protocol needs .html extension
        if (window.location.protocol === 'file:') {
            if (path === './') return 'index.html';
            return path.endsWith('.html') ? path : `${path}.html`;
        }
        return path;
    },

    renderNavbar() {
        const navbarPlaceholder = document.getElementById('adminNavbarPlaceholder');
        if (!navbarPlaceholder || navbarPlaceholder.dataset.rendered === 'true') return;

        navbarPlaceholder.innerHTML = `
            <nav class="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div class="max-w-[1800px] mx-auto px-4 sm:px-8 py-3 flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <button id="adminMobileMenuBtn" class="md:hidden p-2 text-gray-500 hover:text-black focus:outline-none flex items-center justify-center">
                            <iconify-icon icon="solar:hamburger-menu-bold" width="24"></iconify-icon>
                        </button>
                        <a href="${this.getAdjustedPath('./')}" class="flex items-center gap-2 group">
                            <img src="../../assets/Images/logo-newket-v2.jpeg" alt="NewKet" class="h-7 w-auto invert transition-transform group-hover:scale-105">
                            <span class="px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded-full uppercase tracking-widest">Admin</span>
                        </a>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="hidden md:block currency-switch-segmented" id="currencyToggle" data-active="CDF">
                            <div class="segmented-track">
                                <div class="segmented-handle"></div>
                                <span class="segmented-label" data-currency="USD">USD</span>
                                <span class="segmented-label" data-currency="CDF">CDF</span>
                            </div>
                        </div>

                        <a href="${window.location.protocol === 'file:' ? '../../index.html' : '/'}" target="_blank" class="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-black transition-colors flex items-center gap-2">
                            <iconify-icon icon="solar:globus-linear" width="18"></iconify-icon>
                            <span class="hidden sm:inline">Voir la boutique</span>
                        </a>

                        <div class="h-6 w-px bg-gray-200 mx-2"></div>

                        <button onclick="AuthManager.logout()" class="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors">Quitter</button>
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
            { href: './', icon: 'solar:home-smile-bold', label: "Vue d'ensemble" },
            { href: 'user', icon: 'solar:users-group-two-rounded-bold', label: "Gestion Vendeurs" },
            { href: 'products', icon: 'solar:box-bold', label: "Contrôle Catalogue" },
            { href: 'orders', icon: 'solar:bag-bold', label: "Commandes & Retraits" },
            { href: 'diagnostics', icon: 'solar:chart-square-bold', label: "Audit & Diagnostics" },
            { href: 'reviews', icon: 'solar:star-bold', label: "Avis & Modération" },
            { href: 'newsletter', icon: 'solar:letter-bold', label: "Newsletter" },
            { href: 'notifications-admin', icon: 'solar:bell-bing-bold', label: "Notifications" },
            { href: 'support', icon: 'solar:chat-round-dots-bold', label: "Support Platform" },
            { href: 'security', icon: 'solar:shield-keyhole-bold-duotone', label: "Sécurité & Admins" },
            { href: 'settings', icon: 'solar:settings-bold', label: "Paramètres", sub: true }
        ];

        let sidebarHTML = `
            <div id="adminOverlay" class="fixed inset-0 bg-black/50 z-[55] hidden"></div>
            <aside id="adminSidebar" class="fixed inset-y-0 left-0 w-64 bg-white z-[60] transform -translate-x-full md:translate-x-0 md:static md:w-64 transition-transform duration-300 ease-in-out h-screen md:h-auto overflow-y-auto border-r md:border-none border-gray-100 flex-shrink-0">
                <div class="p-6 md:p-0 md:sticky md:top-[52px]">
                    <div class="md:glass-panel p-6 md:px-6 md:py-4">
                        <nav class="space-y-1">
        `;

        links.forEach(link => {
            if (link.sub) sidebarHTML += `<div class="py-4"><div class="h-px bg-gray-100 mb-4"></div>`;

            const normalizedHref = link.href === './' ? 'index' : link.href;
            const isActive = currentFile === normalizedHref ? 'active' : '';

            sidebarHTML += `
                <a href="${this.getAdjustedPath(link.href)}" class="sidebar-link ${isActive}">
                    <iconify-icon icon="${link.icon}" width="20"></iconify-icon>
                    ${link.label}
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
