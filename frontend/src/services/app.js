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
// Système de notification d'appel entrant global (toutes les pages)
// ─────────────────────────────────────────────────────────────────────────────
(function initGlobalCallNotifier() {
    const TOAST_ID   = 'nk-incoming-call-toast';
    const PILL_ID    = 'nk-global-call-pill';
    const DASH_PAGES = ['customer-dashboard.html', 'vendor-dashboard.html'];
    const currentPath = window.location.pathname;
    const isOnDashboard = DASH_PAGES.some(p => currentPath.endsWith(p));

    // ── Styles communs ────────────────────────────────────────────────────────
    function _injectStyles() {
        if (document.getElementById('nk-call-notif-style')) return;
        const s = document.createElement('style');
        s.id = 'nk-call-notif-style';
        s.textContent = `
            @keyframes nk-slide-up   { from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
            @keyframes nk-pulse-dot  { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)} }
            @keyframes nk-ring-shake { 0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)} }
        `;
        document.head.appendChild(s);
    }

    // ── Toast appel entrant ───────────────────────────────────────────────────
    function _showIncomingCallToast(data) {
        // Ne pas dupliquer
        if (document.getElementById(TOAST_ID)) return;
        _injectStyles();

        const callerName   = data.callerName || (data.role === 'vendor' ? 'Vendeur' : 'Client');
        const callerAvatar = data.callerAvatar || '';
        const orderId      = data.orderId || '';
        // L'appelé navigue vers SON propre dashboard (opposé du rôle de l'appelant)
        const myDash = data.role === 'vendor'
            ? '/src/pages/customer-dashboard.html'
            : '/src/pages/vendor-dashboard.html';
        const dashUrl = orderId ? `${myDash}?order=${orderId}` : myDash;

        const avatarHtml = callerAvatar
            ? `<img src="${callerAvatar}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2.5px solid #34d399;flex-shrink:0;">`
            : `<div style="width:48px;height:48px;border-radius:50%;background:#1f2937;border:2.5px solid #34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;font-weight:800;color:#6ee7b7;">${(callerName[0]||'?').toUpperCase()}</div>`;

        const toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.style.cssText = [
            'position:fixed', 'bottom:90px', 'left:50%', 'transform:translateX(-50%)',
            'z-index:999999', 'width:min(340px,90vw)',
            'background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
            'border:1px solid rgba(52,211,153,0.4)', 'border-radius:20px',
            'box-shadow:0 16px 48px rgba(0,0,0,0.6)',
            'padding:16px', 'display:flex', 'flex-direction:column', 'gap:14px',
            'animation:nk-slide-up .3s cubic-bezier(0.34,1.56,0.64,1) both'
        ].join(';');

        toast.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="position:relative;flex-shrink:0;">
                    ${avatarHtml}
                    <div style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:50%;background:#22c55e;border:2px solid #0f172a;animation:nk-pulse-dot 1s ease infinite;"></div>
                </div>
                <div style="min-width:0;flex:1;">
                    <p style="font-size:11px;font-weight:700;color:#6ee7b7;letter-spacing:.06em;text-transform:uppercase;margin:0 0 2px;">📲 Appel entrant</p>
                    <p style="font-size:15px;font-weight:800;color:#f8fafc;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${callerName}</p>
                    <p style="font-size:11px;color:#94a3b8;margin:2px 0 0;">Appel vocal chiffré In-App</p>
                </div>
                <div style="font-size:22px;animation:nk-ring-shake .5s ease infinite;">📞</div>
            </div>
            <div style="display:flex;gap:8px;">
                <button id="nk-call-decline" style="flex:1;padding:11px 0;border-radius:12px;background:#dc2626;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.02em;">
                    ✕ Refuser
                </button>
                <button id="nk-call-accept" style="flex:2;padding:11px 0;border-radius:12px;background:#16a34a;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.02em;">
                    📞 Décrocher
                </button>
            </div>
        `;

        document.body.appendChild(toast);

        // Auto-dismiss après 30 secondes si pas de réponse
        const autoTimer = setTimeout(() => _dismissToast(), 30000);

        toast.querySelector('#nk-call-accept').addEventListener('click', () => {
            clearTimeout(autoTimer);
            _dismissToast();
            window.location.href = dashUrl;
        });
        toast.querySelector('#nk-call-decline').addEventListener('click', () => {
            clearTimeout(autoTimer);
            _dismissToast();
        });

        // Sonnerie via Web Audio API
        _playRingTone();
    }

    function _dismissToast() {
        const t = document.getElementById(TOAST_ID);
        if (t) t.remove();
        _stopRingTone();
    }

    // ── Pilule "appel en cours" (navigation depuis dashboard) ─────────────────
    function _renderPill(data) {
        let pill = document.getElementById(PILL_ID);
        if (!data || data.state === 'idle' || !data.state) {
            if (pill) pill.remove();
            return;
        }
        _injectStyles();
        if (!pill) {
            pill = document.createElement('div');
            pill.id = PILL_ID;
            pill.style.cssText = [
                'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
                'z-index:99999', 'display:flex', 'align-items:center', 'gap:10px',
                'padding:10px 18px', 'border-radius:999px',
                'background:linear-gradient(135deg,#111827 0%,#1f2937 100%)',
                'border:1px solid rgba(52,211,153,0.35)', 'box-shadow:0 8px 30px rgba(0,0,0,0.45)',
                'cursor:pointer', 'user-select:none',
                'animation:nk-slide-up .28s cubic-bezier(0.34,1.56,0.64,1) both'
            ].join(';');
            document.body.appendChild(pill);
        }
        const peerName  = data.peerName || (data.role === 'vendor' ? 'Client' : 'Vendeur');
        const avatarUrl = data.peerAvatar || '';
        const dashUrl   = data.dashboardUrl || (data.role === 'vendor' ? '/src/pages/vendor-dashboard.html' : '/src/pages/customer-dashboard.html');
        const label = data.state === 'connected' ? '📞 En communication' : '📞 Appel en cours';
        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;border:2px solid #34d399;flex-shrink:0;">`
            : `<div style="width:26px;height:26px;border-radius:50%;background:#374151;border:2px solid #34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:#6ee7b7;">${(peerName[0]||'?').toUpperCase()}</div>`;
        pill.innerHTML = `${avatarHtml}<div style="display:flex;flex-direction:column;"><span style="font-size:10px;font-weight:700;color:#6ee7b7;">${label}</span><span style="font-size:12px;font-weight:600;color:#f9fafb;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${peerName}</span></div><div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex-shrink:0;animation:nk-pulse-dot 1.4s ease infinite;"></div>`;
        pill.onclick = () => { window.location.href = dashUrl; };
    }

    // ── Sonnerie ──────────────────────────────────────────────────────────────
    let _ringCtx = null;
    let _ringInterval = null;
    function _playRingTone() {
        try {
            _ringCtx = new (window.AudioContext || window.webkitAudioContext)();
            function _beep() {
                if (!_ringCtx) return;
                const osc = _ringCtx.createOscillator();
                const gain = _ringCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.15, _ringCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, _ringCtx.currentTime + 0.4);
                osc.connect(gain); gain.connect(_ringCtx.destination);
                osc.start(); osc.stop(_ringCtx.currentTime + 0.4);
            }
            _beep();
            _ringInterval = setInterval(_beep, 1200);
        } catch (_) {}
    }
    function _stopRingTone() {
        if (_ringInterval) { clearInterval(_ringInterval); _ringInterval = null; }
        if (_ringCtx) { try { _ringCtx.close(); } catch (_) {} _ringCtx = null; }
    }

    // ── Init : abonnement Supabase user-ring + BroadcastChannel ──────────────
    async function _init() {
        // ① Pilule depuis sessionStorage (navigation depuis le dashboard)
        if (!isOnDashboard) {
            try {
                const saved = sessionStorage.getItem('newket_active_call');
                if (saved) {
                    const data = JSON.parse(saved);
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => _renderPill(data));
                    } else {
                        _renderPill(data);
                    }
                }
            } catch (_) {}

            // BroadcastChannel : pilule mise à jour depuis l'onglet dashboard
            if (typeof BroadcastChannel !== 'undefined') {
                try {
                    const bc = new BroadcastChannel('newket-call-state');
                    bc.onmessage = (evt) => _renderPill(evt.data || {});
                } catch (_) {}
            }
        }

        // ② Canal Supabase user-ring : appel entrant quelle que soit la page
        // Attendre que supabaseClient soit disponible + session active
        const waitForSupabase = () => new Promise((resolve) => {
            const check = () => {
                const client = window.supabaseClient || (window.Supabase && window.Supabase.client);
                if (client) return resolve(client);
                setTimeout(check, 300);
            };
            check();
        });

        try {
            const client = await waitForSupabase();
            const sessionData = await client.auth.getSession();
            const userId = sessionData?.data?.session?.user?.id;
            if (!userId) return;

            const channelName = `user-ring:${userId}`;
            const ch = client.channel(channelName);
            ch.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
                // Ne pas afficher le toast si on est déjà sur le dashboard (il gère lui-même)
                if (isOnDashboard) return;
                _showIncomingCallToast(payload || {});
            }).subscribe();

            // Nettoyer à la fermeture de la page
            window.addEventListener('pagehide', () => {
                try { client.removeChannel(ch); } catch (_) {}
            });
        } catch (_) {}
    }

    // Lancer après le chargement pour ne pas bloquer le rendu
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }
})();
