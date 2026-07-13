// app.js - Centralized entry point for NewKet services
// This file aggregates all the main modules to optimize loading and maintainability (Phases 5 & 6)

import { inject } from '@vercel/analytics';
import { initGoogleAnalytics } from './google-analytics.js';
import './supabase-client.js';
import './supabase-adapter.js';
import './api-client.js';
import './sanitize.js';

import './config-manager.js';
import './branding-manager.js';
import './security-page.js';

import './auth.js';
import './profile-manager.js';
import './user-manager.js';
import './presence-manager.js';
import './behavior-tracking.js';
import './products.js';
import './orders.js';
import './favorites.js';
import './currency.js';
import './invoice-qr.js';
import './managers.js';

import './ui-helpers.js';
import './csv-export.js';
import './ui.js';
import './pull-to-refresh.js';
import './search.js';
import './components-loader.js';
import './realtime-notifications.js';
import './admin-layout.js';

// main.js is usually the last one as it depends on initialized UI
import './main.js';

// Initialize Vercel Analytics only in production contexts.
// This avoids local 403/noise when debug script is blocked by browser policies/ad blockers.
const isLocalHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

if (!isLocalHost) {
    try {
        inject();
    } catch (err) {
        console.warn('[NewKet] Vercel Analytics disabled:', err?.message || err);
    }
}

try {
    initGoogleAnalytics();
} catch (err) {
    console.warn('[NewKet] Google Analytics disabled:', err?.message || err);
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
