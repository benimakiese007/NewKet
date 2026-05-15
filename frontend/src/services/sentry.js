/**
 * Sentry — Monitoring & Error Tracking (Frontend)
 *
 * Initialise le SDK Sentry pour le navigateur.
 * À appeler au tout début (dans `main.js`).
 */

import * as Sentry from '@sentry/browser';

function isSentryEnabled() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const env = import.meta.env.VITE_APP_ENV || 'development';
    const allowInDev = import.meta.env.VITE_ENABLE_SENTRY_DEV === 'true';

    return Boolean(dsn) && (env !== 'development' || allowInDev);
}

export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const env = import.meta.env.VITE_APP_ENV || 'development';

    // Pas de bruit console en production si DSN absent.
    if (!dsn) {
        if (env === 'development') {
            console.info('[Sentry] VITE_SENTRY_DSN non configuré — tracking désactivé.');
        }
        return;
    }

    if (!isSentryEnabled()) {
        if (env === 'development') {
            console.info(`[Sentry] Monitoring disabled in ${env}. Set VITE_ENABLE_SENTRY_DEV=true to enable it locally.`);
        }
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: env,
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration(),
            ],
            tracesSampleRate: env === 'production' ? 0.2 : 1.0,
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,
            initialScope: {
                tags: { service: 'newket-frontend' }
            }
        });

        if (env === 'development') {
            console.log(`[Sentry] ✅ Monitoring activé (env: ${env})`);
        }
    } catch (err) {
        console.error('[Sentry] Erreur lors de l\'initialisation:', err);
    }
}

export function setSentryUser(user) {
    if (!isSentryEnabled() || !user) return;

    Sentry.setUser({
        id: user.id || user.user_id,
        email: user.email,
        role: user.role
    });
}

export function clearSentryUser() {
    if (!isSentryEnabled()) return;
    Sentry.setUser(null);
}

export function captureError(error, context = {}) {
    if (!isSentryEnabled()) return;

    Sentry.withScope((scope) => {
        if (context.endpoint) scope.setTag('endpoint', context.endpoint);
        if (context.action) scope.setTag('action', context.action);

        Object.entries(context).forEach(([key, value]) => {
            if (key !== 'endpoint' && key !== 'action') scope.setExtra(key, value);
        });

        if (typeof error === 'string') {
            Sentry.captureMessage(error, 'error');
        } else {
            Sentry.captureException(error);
        }
    });
}

window.SentryManager = {
    initSentry,
    setSentryUser,
    clearSentryUser,
    captureError
};

