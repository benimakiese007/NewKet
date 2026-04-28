import NodeCache from 'node-cache';
import crypto from 'crypto';

const ENABLE_MEMORY_CACHE = String(process.env.ENABLE_MEMORY_CACHE || '').toLowerCase() === '1';

// Keep cache small-medium: items expire after 60s by default, check every 120s for expired items.
// NOTE: Memory cache is not shared across instances. Keep it opt-in via ENABLE_MEMORY_CACHE=1.
const memoryCache = new NodeCache({ stdTTL: 60, checkperiod: 120, maxKeys: 1000 });

/**
 * Génère une clé de cache unique basée sur l'URL originale et le token (si req.token existe).
 * Cela permet d'isoler le cache public du cache privé.
 */
const generateCacheKey = (req) => {
    const rawKey = req.originalUrl || req.url;
    // Si la requête a un identifiant utilisateur (optionnel), l'ajouter à la clé 
    // pour éviter les fuites de cache entre utilisateurs
    const userInfo = req.token ? `|token:${crypto.createHash('md5').update(req.token).digest('hex')}` : '|public';
    return rawKey + userInfo;
};

/**
 * Middleware de cache générique pour Express.
 * @param {number} duration - Durée de validité du cache en secondes
 */
export const cacheMiddleware = (duration = 60) => {
    return (req, res, next) => {
        // Seulement pour les requêtes GET
        if (req.method !== 'GET') {
            return next();
        }

        // Always send explicit caching headers so CDNs / browsers can help scale reads.
        // Private when token present to avoid cross-user leakage.
        const cacheScope = req.token ? 'private' : 'public';
        res.setHeader('Cache-Control', `${cacheScope}, max-age=${Math.max(0, parseInt(duration, 10) || 0)}`);

        if (!ENABLE_MEMORY_CACHE) {
            res.setHeader('X-Cache', 'BYPASS');
            return next();
        }

        const key = generateCacheKey(req);
        const cachedContent = memoryCache.get(key);

        if (cachedContent) {
            // Optionnel: ajouter un header pour le débogage X-Cache
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cachedContent);
        }

        res.setHeader('X-Cache', 'MISS');

        // Surcharger res.json pour capturer et mettre en cache la réponse générée
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // Ne mettre en cache que les succès (2xx)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                memoryCache.set(key, body, duration);
            }
            return originalJson(body);
        };

        next();
    };
};

/**
 * Utilitaire pour vider le cache par préfixe/pattern (si nécessaire).
 */
export const flushCache = (prefix) => {
    if (!prefix) {
        memoryCache.flushAll();
        return;
    }
    const keys = memoryCache.keys();
    keys.forEach(key => {
        if (key.includes(prefix)) {
            memoryCache.del(key);
        }
    });
};
