import { get, set, del, clear } from 'idb-keyval';

/**
 * CacheManager - Gère le stockage persistant IndexedDB pour le mode hors ligne.
 * Il inclut un système de TTL (Time To Live) basé sur le plan PLAN_CACHE_OFFLINE.md.
 */
class CacheManager {
    constructor() {
        this.DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours par défaut
        this.STATIC_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours pour le statique
    }

    /**
     * Enregistre des données dans IndexedDB avec un timestamp.
     * @param {string} key - La clé de cache (ex: 'cache_home_feed')
     * @param {any} data - Les données à sauvegarder
     */
    async setCache(key, data) {
        try {
            const payload = {
                data: data,
                timestamp: Date.now()
            };
            await set(key, payload);
            console.log(`[CacheManager] Données sauvegardées pour : ${key}`);
        } catch (error) {
            console.warn(`[CacheManager] Erreur lors de la sauvegarde de ${key} :`, error);
        }
    }

    /**
     * Récupère des données depuis IndexedDB. Vérifie la péremption.
     * @param {string} key - La clé de cache
     * @param {number} customTtlMs - Durée de validité personnalisée en MS (optionnel)
     * @returns {any|null} - Les données, ou null si périmées/inexistantes
     */
    async getCache(key, customTtlMs = null) {
        try {
            const payload = await get(key);
            if (!payload) return null;

            const ttl = customTtlMs || (key.includes('static') ? this.STATIC_TTL_MS : this.DEFAULT_TTL_MS);
            const isExpired = (Date.now() - payload.timestamp) > ttl;

            if (isExpired) {
                console.log(`[CacheManager] Cache périmé pour : ${key}. Suppression.`);
                await this.clearCache(key);
                return null;
            }

            console.log(`[CacheManager] Cache chargé pour : ${key} (Âge: ${Math.round((Date.now() - payload.timestamp)/60000)} min)`);
            return payload.data;
        } catch (error) {
            console.warn(`[CacheManager] Erreur lors de la lecture de ${key} :`, error);
            return null;
        }
    }

    /**
     * Supprime une clé spécifique.
     */
    async clearCache(key) {
        try {
            await del(key);
        } catch (e) {
            console.error(`[CacheManager] Erreur suppression ${key}`, e);
        }
    }

    /**
     * Vide intégralement le cache (A appeler lors du Logout pour la sécurité).
     */
    async clearAllCache() {
        try {
            await clear();
            console.log(`[CacheManager] IndexedDB vidé intégralement (Sécurité).`);
        } catch (e) {
            console.error(`[CacheManager] Erreur clearAll`, e);
        }
    }

    /**
     * Vérifie si l'utilisateur est hors ligne.
     */
    isOffline() {
        return !navigator.onLine;
    }

    /**
     * Ajoute un produit récent à l'historique (limite 20).
     */
    async addRecentProduct(product) {
        try {
            const key = 'cache_recent_products';
            let recents = await this.getCache(key) || [];
            
            // Remove if already exists to put it at the beginning
            recents = recents.filter(p => p.id !== product.id);
            
            // Add to the beginning
            recents.unshift(product);
            
            // Limit to 20
            if (recents.length > 20) {
                recents = recents.slice(0, 20);
            }
            
            await this.setCache(key, recents);
        } catch (error) {
            console.warn('[CacheManager] Erreur addRecentProduct:', error);
        }
    }
}

// Expose une instance globale (singleton) pour faciliter l'usage partout
window.CacheManager = new CacheManager();
export default window.CacheManager;
