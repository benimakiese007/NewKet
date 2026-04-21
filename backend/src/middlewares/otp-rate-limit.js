import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter spécifique pour la vérification OTP de livraison.
 * 
 * SÉCURITÉ : Un code OTP à 6 chiffres n'a que 1 000 000 de combinaisons.
 * Sans rate limiting, un attaquant pourrait bruteforcer le code en quelques minutes.
 * 
 * Règles :
 * - 5 tentatives maximum par IP par fenêtre de 15 minutes.
 * - Après 5 échecs, l'IP est bloquée pendant 15 minutes.
 * - Le message d'erreur est volontairement vague pour ne pas aider l'attaquant.
 */
export const otpRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                    // 5 tentatives max
    message: {
        success: false,
        error: 'Trop de tentatives de vérification. Veuillez réessayer dans 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Clé = IP + orderId pour ne pas bloquer d'autres commandes
    keyGenerator: (req) => {
        const orderId = req.params?.id || 'unknown';
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        return `otp_${ip}_${orderId}`;
    }
});
