/**
 * rate-limits.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralization de tous les rate limiters spécialisés du projet NewKet.
 *
 * Un rate limit global (200 req/15 min) est déjà appliqué sur /api dans server.js.
 * Ce fichier définit des limiters PLUS STRICTS pour les routes sensibles :
 *
 *  • authSensitiveRateLimit   → Actions sensibles sur le profil/compte (10/15min)
 *  • signupRateLimit          → Inscription newsletter publique (5/1h)
 *  • emailRateLimit           → Envoi d'emails via API (10/1h)
 *  • uploadRateLimit          → Upload de fichiers/images (20/15min)
 *  • paymentRateLimit         → Initiation de paiements (15/15min)
 *  • supportRateLimit         → Création de tickets support (10/1h)
 *  • promoRateLimit           → Application/validation de codes promo (10/15min)
 *
 * SÉCURITÉ :
 *  - Les messages d'erreur sont volontairement vagues (pas d'info sur les seuils).
 *  - Les headers standardisés (RateLimit-*) sont activés pour les clients légitimes.
 *  - En développement (NODE_ENV=development), tous les limiters sont désactivés.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import rateLimit from 'express-rate-limit';

const isDev = () => process.env.NODE_ENV === 'development';

/**
 * Options communes partagées par tous les limiters.
 * Le keyGenerator utilise l'IP réelle derrière un proxy (Vercel, Nginx...).
 */
const commonOptions = {
    standardHeaders: true,   // Envoie les headers RateLimit-* (RFC 6585)
    legacyHeaders: false,     // Désactive les anciens headers X-RateLimit-*
    validate: { xForwardedForHeader: false }, // On gère manuellement la confiance au proxy
    skip: isDev,              // Désactivé en développement pour ne pas bloquer les tests
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH / COMPTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit pour les actions sensibles liées au compte/profil.
 * Protège contre le brute-force de comptes et les tentatives de modification
 * répétées non autorisées.
 *
 * Règle : 10 requêtes / 15 minutes par IP
 */
export const authSensitiveRateLimit = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        error: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.'
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// INSCRIPTION / NEWSLETTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit pour l'inscription à la newsletter (endpoint public).
 * Protège contre le remplissage de la base d'abonnés avec des emails factices.
 *
 * Règle : 5 inscriptions / 1 heure par IP
 */
export const signupRateLimit = rateLimit({
    ...commonOptions,
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 5,
    message: {
        success: false,
        error: 'Trop de tentatives d\'inscription. Veuillez réessayer plus tard.'
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMAILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit pour les endpoints d'envoi d'emails transactionnels.
 * Protège contre l'utilisation abusive de l'API email (spam, coûts SMTP).
 *
 * Règle : 10 emails / 1 heure par IP
 */
export const emailRateLimit = rateLimit({
    ...commonOptions,
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 10,
    message: {
        success: false,
        error: 'Limite d\'envoi d\'emails atteinte. Veuillez réessayer plus tard.'
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// UPLOADS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit pour les uploads de fichiers/images (Cloudinary, etc.).
 * Protège contre l'abus de stockage et les coûts liés aux uploads excessifs.
 *
 * Règle : 20 uploads / 15 minutes par IP
 */
export const uploadRateLimit = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: {
        success: false,
        error: 'Trop d\'uploads en peu de temps. Veuillez patienter quelques minutes.'
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PAIEMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit pour les endpoints de paiement.
 * Protège contre la fraude par initiation répétée de paiements et le testing
 * de numéros de carte/comptes.
 *
 * Règle : 15 requêtes / 15 minutes par IP
 */
export const paymentRateLimit = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    message: {
        success: false,
        error: 'Trop de tentatives de paiement. Veuillez réessayer dans quelques minutes.'
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit pour la création de tickets de support.
 * Protège contre le spam de tickets et la saturation de la file de support.
 *
 * Règle : 10 tickets / 1 heure par IP
 */
export const supportRateLimit = rateLimit({
    ...commonOptions,
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 10,
    message: {
        success: false,
        error: 'Trop de tickets créés. Veuillez patienter avant d\'en soumettre un nouveau.'
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// CODES PROMO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit pour l'application et la validation de codes promo.
 * Protège contre le brute-force de codes promotionnels.
 *
 * Règle : 10 tentatives / 15 minutes par IP
 */
export const promoRateLimit = rateLimit({
    ...commonOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        error: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.'
    },
});
