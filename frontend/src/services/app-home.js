import { inject } from '@vercel/analytics';
import './supabase-client.js';
import './supabase-adapter.js';
import './api-client.js';
import './sanitize.js';

import './config-manager.js';
import './branding-manager.js';
import './security-page.js';

import './auth.js';
import './profile-manager.js';
import './currency.js';
import './favorites.js';
import './products.js';

import './ui-helpers.js';
import './ui.js';
import './search.js';
import './components-loader.js';
import './main.js';

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

function runIdle(callback) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout: 2500 });
        return;
    }

    window.setTimeout(callback, 1200);
}

runIdle(async () => {
    try {
        await import('./pull-to-refresh.js');
        await import('./presence-manager.js');
        await import('./behavior-tracking.js');

        if (window.PresenceManager?.init) {
            window.PresenceManager.init().catch((err) => {
                console.warn('[NewKet Home] PresenceManager init failed:', err?.message || err);
            });
        }

        if (window.BehaviorTracking?.init) {
            window.BehaviorTracking.init();
        }
    } catch (err) {
        console.warn('[NewKet Home] Deferred home modules failed:', err?.message || err);
    }
});
