import { hasServiceRoleKey, supabase, supabaseAdmin } from '../config/supabase.js';

let isMaintenanceCached = null;
let lastCheck = 0;
const CACHE_DURATION = 30000; // 30 secondes

async function readMaintenanceFlag() {
  // En prod, on veut pouvoir lire le flag même si la table est protégée par RLS.
  // Donc on privilégie le service-role quand il est présent.
  const client = hasServiceRoleKey ? supabaseAdmin : supabase;

  const query = async (columns) => {
    const { data, error } = await client
      .from('settings')
      .select(columns)
      .eq('id', 'global-settings')
      .maybeSingle();
    return { data, error };
  };

  // Schéma actuel: snake_case. Support legacy camelCase.
  const snake = await query('maintenance_mode');
  if (!snake.error) return { value: !!snake.data?.maintenance_mode, error: null };

  if (snake.error?.code === '42703') {
    const camel = await query('maintenanceMode');
    if (!camel.error) return { value: !!camel.data?.maintenanceMode, error: null };
    return { value: false, error: camel.error };
  }

  return { value: false, error: snake.error };
}

/**
 * Middleware de Maintenance
 * Bloque les opérations d'écriture (POST, PUT, DELETE) si le mode maintenance est actif,
 * sauf pour les administrateurs.
 */
export const maintenanceMiddleware = async (req, res, next) => {
  // 1) Autoriser la lecture, et autoriser les admins au-delà de la maintenance
  if (req.method === 'GET' || (req.user && req.user.role === 'admin')) {
    return next();
  }

  try {
    const now = Date.now();

    // 2) Vérifier le cache pour éviter de surcharger Supabase
    if (isMaintenanceCached === null || now - lastCheck > CACHE_DURATION) {
      const { value, error } = await readMaintenanceFlag();

      // Mettre à jour le cache même en cas d'erreur pour éviter le spam (logs + DB).
      lastCheck = now;

      if (!error) {
        isMaintenanceCached = value;
      } else {
        console.error('❌ Erreur vérification maintenance:', error);
        // En cas d'erreur de vérification, on laisse passer pour ne pas bloquer le site indéfiniment.
        isMaintenanceCached = false;
      }
    }

    // 3) Appliquer le blocage
    if (isMaintenanceCached === true) {
      console.log(`🚧 Blocage maintenance pour: ${req.method} ${req.path}`);
      return res.status(503).json({
        error: 'Service en maintenance',
        message:
          "Le site est actuellement en cours de mise à jour. Les transactions et modifications sont temporairement désactivées.",
        retryAfter: 300,
      });
    }

    next();
  } catch (err) {
    console.error('❌ Erreur MaintenanceMiddleware:', err);
    // En cas d'erreur de vérification, on laisse passer pour ne pas bloquer le site indéfiniment
    next();
  }
};

