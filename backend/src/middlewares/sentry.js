/**
 * ─── Sentry — Monitoring & Error Tracking (Backend) ───────────────────────────
 *
 * Ce module initialise Sentry pour le backend Express.
 * Il doit être importé EN PREMIER dans server.js, avant Express lui-même.
 *
 * Fonctionnalités :
 *  - Capture automatique de toutes les exceptions non gérées
 *  - Tracing des routes Express (performance monitoring)
 *  - Enrichissement des erreurs avec le contexte HTTP
 *  - Désactivation propre si le DSN n'est pas configuré
 */

import * as Sentry from '@sentry/node';

/**
 * Initialise Sentry.
 * À appeler UNE SEULE FOIS, avant la création de l'instance Express.
 */
export function initSentry() {
    const dsn = process.env.SENTRY_DSN_BACKEND;

    if (!dsn) {
        console.warn('[Sentry] ⚠️  SENTRY_DSN_BACKEND non configuré — monitoring désactivé.');
        console.warn('[Sentry]    → Ajoutez votre DSN dans backend/.env pour activer le tracking.');
        return;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: `newket-backend@${process.env.npm_package_version || '1.0.0'}`,

        // Tracing des performances (transactions HTTP)
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

        // Ignorer certaines erreurs non critiques
        ignoreErrors: [
            'ECONNRESET',
            'ECONNREFUSED',
            'AbortError',
        ],

        // Métadonnées supplémentaires attachées à chaque événement
        initialScope: {
            tags: {
                service: 'newket-backend',
                platform: 'express',
            },
        },
    });

    console.log(`[Sentry] ✅ Monitoring activé (env: ${process.env.NODE_ENV || 'development'})`);
}

/**
 * Middleware Express à brancher APRÈS toutes les routes.
 * Capture automatiquement toutes les erreurs non gérées et les envoie à Sentry.
 *
 * Usage dans server.js :
 *   app.use(sentryErrorHandler);
 *   app.use(globalErrorHandler); // votre handler custom ensuite
 */
export const sentryErrorHandler = Sentry.expressErrorHandler({
    // Ne capturer que les erreurs 5xx (pas les 4xx client)
    shouldHandleError(error) {
        if (error.status && error.status < 500) return false;
        return true;
    },
});

/**
 * Utilitaire pour capturer manuellement une exception depuis n'importe quel controller.
 *
 * @param {Error} err - L'erreur à capturer
 * @param {object} [context] - Données supplémentaires (ex: { userId, endpoint })
 */
export function captureException(err, context = {}) {
    if (!process.env.SENTRY_DSN_BACKEND) return;

    Sentry.withScope((scope) => {
        if (context.userId) scope.setUser({ id: context.userId });
        if (context.endpoint) scope.setTag('endpoint', context.endpoint);
        Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
        });
        Sentry.captureException(err);
    });
}
