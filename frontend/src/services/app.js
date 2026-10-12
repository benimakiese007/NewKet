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
