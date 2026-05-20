import { supabase } from '../config/supabase.js';

let isMaintenanceCached = null;
let lastCheck = 0;
const CACHE_DURATION = 30000; // 30 secondes en production

async function readMaintenanceFlag() {
    const query = async (columns) => {
        const { data, error } = await supabase
            .from('settings')
            .select(columns)
            .eq('id', 'global-settings')
            .maybeSingle();
        return { data, error };
    };

    const legacy = await query('maintenance_mode');
    if (!legacy.error) return { value: !!legacy.data?.maintenance_mode, error: null };

    if (legacy.error?.code === '42703') {
        const camel = await query('maintenanceMode');
        if (!camel.error) return { value: !!camel.data?.maintenanceMode, error: null };
        return { value: false, error: camel.error };
    }

    return { value: false, error: legacy.error };
}

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
            let { data, error } = await supabase
                .from('settings')
                .select('maintenance_mode')
                .eq('id', 'global-settings')
                .maybeSingle();

            // If the schema uses camelCase, retry with the alternate column name.
            if (error && error.code === '42703') {
                ({ data, error } = await supabase
                    .from('settings')
                    .select('maintenanceMode')
                    .eq('id', 'global-settings')
                    .maybeSingle());
            }

            if (!error && data) {
                isMaintenanceCached = !!(data.maintenance_mode ?? data.maintenanceMode);
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
