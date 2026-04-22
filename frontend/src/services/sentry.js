/**
 * ─── Sentry — Monitoring & Error Tracking (Frontend) ──────────────────────────
 *
 * Ce module initialise le SDK Sentry pour le navigateur.
 * Il doit être appelé au tout début du cycle de vie de l'application (dans main.js).
 */

import * as Sentry from '@sentry/browser';

function isSentryEnabled() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const env = import.meta.env.VITE_APP_ENV || 'development';
    const allowInDev = import.meta.env.VITE_ENABLE_SENTRY_DEV === 'true';

    return Boolean(dsn) && (env !== 'development' || allowInDev);
}

/**
 * Initialise Sentry pour le frontend.
 */
export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    const env = import.meta.env.VITE_APP_ENV || 'development';
    
    if (!dsn) {
        console.warn('[Sentry] ⚠️ VITE_SENTRY_DSN non configuré — tracking désactivé.');
        return;
    }

    if (!isSentryEnabled()) {
        console.info(`[Sentry] Monitoring disabled in ${env}. Set VITE_ENABLE_SENTRY_DEV=true to enable it locally.`);
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: env,
            
            // On capture 100% des erreurs non gérées
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration(),
            ],
            
            // Performances
            tracesSampleRate: import.meta.env.VITE_APP_ENV === 'production' ? 0.2 : 1.0,
            
            // Session Replay
            replaysSessionSampleRate: 0.1, // 10% des sessions normales
            replaysOnErrorSampleRate: 1.0, // 100% des sessions avec erreur
            
            initialScope: {
                tags: {
                    service: 'newket-frontend',
                }
            }
        });
        
        console.log(`[Sentry] ✅ Monitoring activé (env: ${import.meta.env.VITE_APP_ENV || 'development'})`);
    } catch (err) {
        console.error('[Sentry] Erreur lors de l\'initialisation:', err);
    }
}

/**
 * Attribue l'utilisateur actuel au scope Sentry.
 * Utile pour savoir QUI a rencontré un problème.
 * 
 * @param {object} user - Infos de l'utilisateur (id, email, etc.)
 */
export function setSentryUser(user) {
    if (!isSentryEnabled() || !user) return;
    
    Sentry.setUser({
        id: user.id || user.user_id,
        email: user.email,
        role: user.role
    });
}

/**
 * Efface les infos utilisateur du scope Sentry (ex: à la déconnexion).
 */
export function clearSentryUser() {
    if (!isSentryEnabled()) return;
    Sentry.setUser(null);
}

/**
 * Capture manuellement une erreur et l'envoie à Sentry, en y ajoutant du contexte.
 * Très utile dans les blocs catch (ex: api-client.js).
 * 
 * @param {Error|string} error - L'erreur à logger
 * @param {object} context - Informations additionnelles pour aider au debug
 */
export function captureError(error, context = {}) {
    if (!isSentryEnabled()) return;

    Sentry.withScope((scope) => {
        // Ajouter le contexte sous forme de "tags" ou "extras"
        if (context.endpoint) scope.setTag('endpoint', context.endpoint);
        if (context.action) scope.setTag('action', context.action);
        
        Object.entries(context).forEach(([key, value]) => {
            if (key !== 'endpoint' && key !== 'action') {
                scope.setExtra(key, value);
            }
        });

        if (typeof error === 'string') {
            Sentry.captureMessage(error, 'error');
        } else {
            Sentry.captureException(error);
        }
    });
}

// Rendre accessible globalement pour les scripts inline/vanilla
window.SentryManager = {
    initSentry,
    setSentryUser,
    clearSentryUser,
    captureError
};
