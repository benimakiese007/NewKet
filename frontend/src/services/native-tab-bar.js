/**
 * NewKet — Native Tab Bar Bridge (iOS 26+ Liquid Glass)
 * ======================================================
 * Ce module initialise la barre d'onglets native Swift sur iOS 26+
 * via le plugin Capacitor NativeTabBarPlugin.
 *
 * Sur iOS < 26 ou sur Web/PWA/Android, il laisse la barre HTML classique.
 *
 * Architecture :
 *   JS (main.js) → NativeTabBarPlugin (Swift) → UITabBar native (UIGlassEffect)
 *   UITabBar (Swift) → event "tabSelected" → JS (navigation)
 */

// ─── Détection ────────────────────────────────────────────────────────────────

/**
 * @returns {boolean} true seulement sur iOS natif Capacitor
 */
function isIOSCapacitor() {
    return (
        window.Capacitor?.isNativePlatform?.() === true &&
        window.Capacitor?.getPlatform?.() === 'ios'
    );
}

// ─── Mapping URL → Tab ID ──────────────────────────────────────────────────────

const PATH_TO_TAB = {
    '/':                                'home',
    '/index.html':                      'home',
    '/src/pages/catalog.html':          'catalog',
    '/src/pages/publish.html':          'publish',
    '/src/pages/favorites.html':        'favorites',
    '/src/pages/notifications.html':    'notifications',
};

/**
 * Retourne l'ID de l'onglet correspondant au chemin URL courant.
 * @param {string} path
 * @returns {string}
 */
function getTabIdFromPath(path) {
    // Normalize
    const normalized = path.split('?')[0].split('#')[0].replace(/\/index\.html$/i, '/') || '/';
    return PATH_TO_TAB[normalized] || 'home';
}

// ─── Role detection ───────────────────────────────────────────────────────────

/**
 * Résout le rôle utilisateur courant depuis AuthManager ou localStorage.
 * @returns {'guest'|'customer'|'seller'|'supplier'|'admin'}
 */
function getCurrentRole() {
    // 1. Depuis AuthManager (source principale)
    if (window.AuthManager?.role) {
        return window.AuthManager.role;
    }
    // 2. Depuis localStorage (persisté entre sessions)
    const stored = localStorage.getItem('newket_user_role') ||
                   localStorage.getItem('userRole') ||
                   localStorage.getItem('role');
    if (stored && ['customer', 'seller', 'supplier', 'admin'].includes(stored)) {
        return stored;
    }
    return 'guest';
}

// ─── Gestion du plugin ─────────────────────────────────────────────────────────

let nativeTabBarActive = false;

/**
 * Initialise la tab bar native si on est sur iOS Capacitor.
 * Doit être appelé après que le DOM soit prêt.
 */
async function initNativeTabBar() {
    if (!isIOSCapacitor()) return;

    try {
        const { registerPlugin } = await import('@capacitor/core');
        const NativeTabBar = registerPlugin('NativeTabBarPlugin');

        // Vérifier que iOS 26+ est disponible
        const { available } = await NativeTabBar.isNativeAvailable();
        if (!available) {
            console.log('[NativeTabBar] iOS < 26 — fallback sur tab bar HTML');
            return;
        }

        // Déterminer l'onglet actif et le rôle au chargement
        const activeTab = getTabIdFromPath(window.location.pathname);
        const role      = getCurrentRole();

        // Cacher la tab bar HTML (elle sera remplacée par la native)
        hideHTMLTabBar();

        // Afficher la tab bar native avec le bon jeu d'onglets
        await NativeTabBar.show({ activeTab, role });
        nativeTabBarActive = true;

        console.log(`[NativeTabBar] Tab bar native iOS 26 Liquid Glass active ✓ (role: ${role})`);

        // Écouter les sélections d'onglets depuis Swift
        await NativeTabBar.addListener('tabSelected', ({ tab, url }) => {
            console.log('[NativeTabBar] Tab sélectionné:', tab, url);

            // Special actions (search, cart) handled in JS
            if (url === '#search') {
                const sc = document.getElementById('mobileSearchContainer');
                sc?.classList.toggle('user-hidden-on-mobile');
                if (!sc?.classList.contains('user-hidden-on-mobile')) {
                    setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
                }
                return;
            }
            if (url === '#cart') {
                window.CartManager?.toggleCartUI();
                return;
            }

            navigateToTab(url);
        });

        // Exposer globalement pour synchro depuis main.js
        window.NativeTabBar = {
            setActiveTab: (tabId) => NativeTabBar.setActiveTab({ tab: tabId }),
            updateRole:   (newRole) => {
                // Rebuild the tab bar when role changes (e.g. after login/logout)
                const activeTabId = getTabIdFromPath(window.location.pathname);
                return NativeTabBar.show({ activeTab: activeTabId, role: newRole });
            },
            hide:   () => NativeTabBar.hide(),
            show:   (tabId) => NativeTabBar.show({
                activeTab: tabId || getTabIdFromPath(window.location.pathname),
                role: getCurrentRole()
            }),
            isActive: () => nativeTabBarActive,
        };

        // Watch for role changes (login/logout)
        window.addEventListener('authStateChanged', () => {
            const newRole = getCurrentRole();
            window.NativeTabBar?.updateRole(newRole);
        });

    } catch (e) {
        console.warn('[NativeTabBar] Initialisation échouée, fallback HTML:', e?.message);
        nativeTabBarActive = false;
    }
}

/**
 * Cache la tab bar HTML pour éviter les doublons avec la native.
 */
function hideHTMLTabBar() {
    const nav = document.getElementById('mobileBottomNav');
    if (nav) {
        nav.style.display = 'none';
        nav.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Navigue vers l'URL d'un onglet.
 * @param {string} url - L'URL relative de l'onglet
 */
function navigateToTab(url) {
    if (!url) return;

    // Construire l'URL absolue à partir de la base Capacitor
    const base = window.location.origin;
    const target = new URL(url, base).href;

    if (window.location.href !== target) {
        window.location.href = target;
    }
}

/**
 * Synchronise l'onglet actif natif avec l'URL courante.
 * Appelé après chaque navigation (popstate, hashchange, etc.).
 */
function syncNativeTabBarWithCurrentPage() {
    if (!nativeTabBarActive || !window.NativeTabBar) return;

    const tabId = getTabIdFromPath(window.location.pathname);
    window.NativeTabBar.setActiveTab(tabId).catch(() => {});
}

// ─── Écouter les navigations futures ──────────────────────────────────────────

window.addEventListener('popstate', syncNativeTabBarWithCurrentPage);
window.addEventListener('hashchange', syncNativeTabBarWithCurrentPage);

// Observer les changements de page (SPA)
if (typeof history !== 'undefined') {
    const originalPushState = history.pushState.bind(history);
    history.pushState = function (...args) {
        originalPushState(...args);
        syncNativeTabBarWithCurrentPage();
    };

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = function (...args) {
        originalReplaceState(...args);
        syncNativeTabBarWithCurrentPage();
    };
}

// ─── Export ────────────────────────────────────────────────────────────────────

export {
    initNativeTabBar,
    syncNativeTabBarWithCurrentPage,
    getTabIdFromPath,
    isIOSCapacitor,
};
