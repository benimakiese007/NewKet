// app.js - Centralized entry point for NewKet services
// This file aggregates all the main modules to optimize loading and maintainability (Phases 5 & 6)

import { inject } from '@vercel/analytics';
import { initGoogleAnalytics } from './google-analytics.js';
import './supabase-client.js';
import './supabase-adapter.js';
import './api-client.js';
import './sanitize.js';

import './config-manager.js';

import './auth.js';
import './products.js';
import './orders.js';
import './delivery-tracking.js';
import './favorites.js';
import './currency.js';
import './managers.js';
import './profile-manager.js';
import './user-manager.js';

import './ui-helpers.js';
import './ui.js';
import './pull-to-refresh.js';
import './components-loader.js';
import './search.js';

// main.js is usually the last one as it depends on initialized UI
import './main.js';

// Initialize Vercel Analytics only in production contexts.
// This avoids local 403/noise when debug script is blocked by browser policies/ad blockers.
const isLocalHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

if (!isLocalHost) {
    const startVercelAnalytics = (choices) => {
        if (!choices?.analytics || window.__newketVercelAnalyticsInitialized) return;
        window.__newketVercelAnalyticsInitialized = true;
        try { inject(); } catch (err) {
            console.warn('[NewKet] Vercel Analytics disabled:', err?.message || err);
        }
    };
    window.addEventListener('nk:consent', (event) => startVercelAnalytics(event.detail));
    startVercelAnalytics(window.NewKetCookieConsent?.getChoices?.());
}

try {
    initGoogleAnalytics();
} catch (err) {
    console.warn('[NewKet] Google Analytics disabled:', err?.message || err);
}

const isAdminPage =
    window.location.pathname.includes('/admin/') ||
    window.location.pathname.endsWith('/admin') ||
    window.location.pathname.includes('/pages/admin/');

const deferredImports = [
    { load: () => import('./behavior-tracking.js') },
    { load: () => import('./csv-export.js') },
    { load: () => import('./realtime-notifications.js') },
    { load: () => import('./live-tracking.js') },
    { load: () => import('./presence-manager.js') }
];

if (isAdminPage) {
    deferredImports.push(
        { load: () => import('./branding-manager.js'), requiresBackend: true },
        { load: () => import('./admin-layout.js') },
        { load: () => import('./invoice-qr.js') }
    );
} else {
    deferredImports.push(
        { load: () => import('./invoice-qr.js') }
    );
}
deferredImports.push({ load: () => import('./security-page.js') });

const resolveBackendReady = async () => {
    if (!isLocalHost) return true;
    if (window.newketBackendReady === true) return true;
    if (window.newketBackendReady === false) return false;
    if (window.ApiClient?.isLocalBackendReady) {
        const ready = await window.ApiClient.isLocalBackendReady(1200);
        window.newketBackendReady = ready;
        return ready;
    }
    return true;
};

const scheduleDeferredImports = async () => {
    console.log('[App] scheduleDeferredImports started');
    try {
        const backendReady = await resolveBackendReady();
        console.log('[App] backendReady:', backendReady);
        const tasks = deferredImports
            .filter((entry) => backendReady || !entry.requiresBackend)
            .map((entry) => {
                console.log('[App] Loading deferred import...', entry);
                return entry.load().catch(err => {
                    console.error('[App] Failed to load deferred module:', err);
                });
            });
        await Promise.allSettled(tasks);
        console.log('[App] scheduleDeferredImports finished');
    } catch (err) {
        console.error('[App] scheduleDeferredImports crashed:', err);
    }
};

if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(scheduleDeferredImports, { timeout: 1500 });
} else {
    window.setTimeout(scheduleDeferredImports, 1000);
}

// Global fallback for broken images
window.addEventListener('error', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        const fallbackUrl = 'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572380/newket_assets/frontend/src/assets/Images/default.jpg';
        const finalUrl = typeof window.resolvePath === 'function' ? window.resolvePath(fallbackUrl) : fallbackUrl;
        
        // Prevent infinite loops if the fallback itself fails
        if (e.target.src !== finalUrl && !e.target.hasAttribute('data-global-fallback-applied')) {
            e.target.setAttribute('data-global-fallback-applied', 'true');
            e.target.removeAttribute('srcset');
            e.target.removeAttribute('sizes');
            e.target.src = finalUrl;
        }
    }
}, true); // Use capture phase to catch the error event
import './lens.js';

// Global Deep Link Handler for iOS / Android Widgets & Shortcuts (newket://)
const setupDeepLinkRouter = async () => {
    try {
        const CapApp = window.Capacitor?.Plugins?.App;
        if (!CapApp) return;

        CapApp.addListener('appUrlOpen', (data) => {
            const rawUrl = data?.url || '';
            console.info('[NewKet] Deep link reçu :', rawUrl);
            if (!rawUrl.startsWith('newket://')) return;

            const route = rawUrl.replace('newket://', '').toLowerCase().split('?')[0].split('#')[0].replace(/^\/+/, '');
            if (route === 'shops' || route === 'shop' || route === 'boutique' || route === 'boutiques') {
                window.location.href = '/src/pages/shops.html';
            } else if (route === 'notifications' || route === 'notif' || route === 'notifs') {
                window.location.href = '/src/pages/notifications.html';
            } else if (route === 'favorites' || route === 'fav' || route === 'favoris') {
                window.location.href = '/src/pages/favorites.html';
            } else if (route === 'achat' || route === 'cart' || route === 'panier') {
                window.location.href = '/src/pages/achat.html';
            }
        });
    } catch (_) {}
};
setupDeepLinkRouter();

// ─────────────────────────────────────────────────────────────────────────────
// Pilule flottante "Appel en cours" sur toutes les pages
// Quand un appel WebRTC est actif sur le dashboard, une pilule s'affiche
// partout pour que l'utilisateur puisse y retourner facilement.
// ─────────────────────────────────────────────────────────────────────────────
(function initCallBanner() {
    const STORAGE_KEY = 'newket_active_call';
    const BANNER_ID   = 'nk-global-call-pill';
    const DASH_PAGES  = [
        '/src/pages/customer-dashboard.html',
        '/src/pages/vendor-dashboard.html'
    ];

    // Ne pas afficher la pilule sur les dashboards (ils ont leur propre UI d'appel)
    const currentPath = window.location.pathname;
    const isOnDashboard = DASH_PAGES.some(p => currentPath.endsWith(p.split('/').pop()));
    if (isOnDashboard) return;

    function _renderPill(data) {
        let pill = document.getElementById(BANNER_ID);
        if (data.state === 'idle' || !data.state) {
            if (pill) pill.remove();
            return;
        }
        if (!pill) {
            pill = document.createElement('div');
            pill.id = BANNER_ID;
            pill.style.cssText = [
                'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
                'z-index:99999', 'display:flex', 'align-items:center', 'gap:10px',
                'padding:10px 18px', 'border-radius:999px',
                'background:linear-gradient(135deg,#111827 0%,#1f2937 100%)',
                'border:1px solid rgba(52,211,153,0.35)', 'box-shadow:0 8px 30px rgba(0,0,0,0.45)',
                'cursor:pointer', 'user-select:none',
                'animation:nk-pill-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both'
            ].join(';');

            // Injecter l'animation si elle n'existe pas
            if (!document.getElementById('nk-pill-style')) {
                const s = document.createElement('style');
                s.id = 'nk-pill-style';
                s.textContent = `
                    @keyframes nk-pill-in {
                        from { opacity:0; transform:translateX(-50%) translateY(16px) scale(0.9); }
                        to   { opacity:1; transform:translateX(-50%) translateY(0)   scale(1); }
                    }
                    #${BANNER_ID}:active { transform:translateX(-50%) scale(0.97); }
                `;
                document.head.appendChild(s);
            }
            document.body.appendChild(pill);
        }

        const peerName  = data.peerName || (data.role === 'vendor' ? 'Client' : 'Vendeur');
        const avatarUrl = data.peerAvatar || '';
        const dashUrl   = data.dashboardUrl || (data.role === 'vendor' ? '/src/pages/vendor-dashboard.html' : '/src/pages/customer-dashboard.html');
        const stateLabel = data.state === 'connected' ? '📞 En communication' :
                           data.state === 'incoming'  ? '📲 Appel entrant'     :
                                                         '📞 Appel en cours';

        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid rgba(52,211,153,0.6);flex-shrink:0;">`
            : `<div style="width:28px;height:28px;border-radius:50%;background:#374151;border:2px solid rgba(52,211,153,0.6);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:700;color:#6ee7b7;">${(peerName[0]||'?').toUpperCase()}</div>`;

        pill.innerHTML = `
            ${avatarHtml}
            <div style="display:flex;flex-direction:column;min-width:0;">
                <span style="font-size:11px;font-weight:700;color:#6ee7b7;letter-spacing:0.05em;white-space:nowrap;">${stateLabel}</span>
                <span style="font-size:12px;font-weight:600;color:#f9fafb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${peerName}</span>
            </div>
            <div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex-shrink:0;animation:nk-pulse 1.4s ease-in-out infinite;"></div>
        `;

        // Ajouter le style de pulsation si manquant
        if (!document.querySelector('#nk-pill-style')?.textContent?.includes('nk-pulse')) {
            const existStyle = document.getElementById('nk-pill-style');
            if (existStyle) existStyle.textContent += `@keyframes nk-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`;
        }

        pill.onclick = () => { window.location.href = dashUrl; };
    }

    // Lire l'état initial depuis sessionStorage (cas navigation entre pages)
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            // Afficher la pilule une fois le DOM prêt
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => _renderPill(data));
            } else {
                _renderPill(data);
            }
        }
    } catch (_) {}

    // Écouter les mises à jour en temps réel depuis l'onglet du dashboard
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('newket-call-state');
            bc.onmessage = (evt) => {
                const d = evt.data || {};
                _renderPill(d);
            };
        } catch (_) {}
    }
})();
