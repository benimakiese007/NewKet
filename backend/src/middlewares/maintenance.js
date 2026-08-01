import { hasServiceRoleKey, supabase, supabaseAdmin } from '../config/supabase.js';

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

  // Schéma actuel côté production: camelCase. Support legacy snake_case.
  const camel = await query('maintenanceMode');
  if (!camel.error) return { value: !!camel.data?.maintenanceMode, error: null };

  if (camel.error?.code === '42703') {
    const snake = await query('maintenance_mode');
    if (!snake.error) return { value: !!snake.data?.maintenance_mode, error: null };
    return { value: false, error: snake.error };
  }

  return { value: false, error: camel.error };
}

/**
 * Vérifie si la requête est exemptée du mode maintenance.
 * Sont exemptés : 
 * - les requêtes d'authentification pour permettre à l'admin de se connecter
 * - les requêtes de l'API auth
 * - les requêtes PWA et webhooks
 * - l'API settings (pour permettre à l'admin de réactiver le site)
 */
function isMaintenanceExemptRequest(req) {
  const method = String(req.method || '').toUpperCase();
  const path = String(req.path || req.originalUrl || '');

  const exemptPaths = [
      '/api/auth',
      '/auth',
      '/api/settings', // ← AJOUT : Permet au PUT settings de passer pour désactiver la maintenance
      '/api/webhooks',
      '/manifest.json',
      '/service-worker.js',
      '/.well-known',
      '/images',
      '/icons'
  ];
  if (exemptPaths.some(p => path.startsWith(p))) {
    return true;
  }

  if (method === 'OPTIONS') {
    return true;
  }

  if (path === '/api/health') {
    return true;
  }


  if (method === 'GET' && path === '/api/manifest') {
    return true;
  }

  if (method === 'POST' && path === '/api/payments/notify') {
    return true;
  }

  if (path.startsWith('/api/cron/')) {
    return true;
  }

  return false;
}

/**
 * Middleware de Maintenance
 * Bloque les opérations non-admin si le mode maintenance est actif.
 */
export const maintenanceMiddleware = async (req, res, next) => {
  // 1) Autoriser les admins et quelques endpoints techniques indispensables.
  if ((req.user && req.user.role === 'admin') || isMaintenanceExemptRequest(req)) {
    return next();
  }

  try {
  // 2) Lire le flag à chaque requête non-admin pour rendre la bascule immédiate.
  const { value, error } = await readMaintenanceFlag();

  if (error) {
    console.error('❌ Erreur vérification maintenance:', error);
    // En cas d'erreur de vérification, on bloque côté public pour éviter un faux "open".
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Retry-After', '300');
    return res.status(503).json({
      error: 'Service en maintenance',
      message:
        "Le site est actuellement en cours de mise à jour. Les transactions et modifications sont temporairement désactivées.",
      retryAfter: 300,
    });
  }

    // 3) Appliquer le blocage
    if (value === true) {
      console.log(`🚧 Blocage maintenance pour: ${req.method} ${req.path}`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Retry-After', '300');
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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Retry-After', '300');
    res.status(503).json({
      error: 'Service en maintenance',
      message:
        "Le site est actuellement en cours de mise à jour. Les transactions et modifications sont temporairement désactivées.",
      retryAfter: 300,
    });
  }
};
