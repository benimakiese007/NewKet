import { supabase } from '../config/supabase.js';

let isMaintenanceCached = null;
let lastCheck = 0;
const CACHE_DURATION = 30000; // 30 secondes en production

/**
 * Middleware de Maintenance
 * Bloque les opérations d'écriture (POST, PUT, DELETE) si le mode maintenance est actif,
 * sauf pour les administrateurs.
 */
export const maintenanceMiddleware = async (req, res, next) => {
    // 1. Autoriser les requêtes GET (Lecture autorisée même en maintenance)
    // Et autoriser les admins au-delà de la maintenance
    if (req.method === 'GET' || (req.user && req.user.role === 'admin')) {
        return next();
    }

    try {
        const now = Date.now();
        
        // 2. Vérifier le cache pour éviter de surcharger Supabase
        if (isMaintenanceCached === null || (now - lastCheck) > CACHE_DURATION) {
            const { data, error } = await supabase
                .from('settings')
                .select('maintenanceMode')
                .eq('id', 'global-settings')
                .maybeSingle();

            if (!error && data) {
                isMaintenanceCached = !!data.maintenanceMode;
                lastCheck = now;
            } else if (error) {
                console.error('❌ Erreur vérification maintenance:', error);
            }
        }

        // 3. Appliquer le blocage
        if (isMaintenanceCached === true) {
            console.log(`🚧 Blocage maintenance pour: ${req.method} ${req.path}`);
            return res.status(503).json({
                error: 'Service en maintenance',
                message: 'Le site est actuellement en cours de mise à jour. Les transactions et modifications sont temporairement désactivées.',
                retryAfter: 300
            });
        }

        next();
    } catch (err) {
        console.error('❌ Erreur MaintenanceMiddleware:', err);
        // En cas d'erreur de vérification, on laisse passer pour ne pas bloquer le site indéfiniment
        next();
    }
};
