import { hasServiceRoleKey, supabase, supabaseAdmin } from '../config/supabase.js';

let cachedMaintenanceMode = false;
let lastMaintenanceFetch = 0;
const MAINTENANCE_CACHE_TTL_MS = 15000; // 15 secondes de cache

async function fetchFromClient(client, columns) {
  try {
    const { data, error } = await client
      .from('settings')
      .select(columns)
      .eq('id', 'global-settings')
      .maybeSingle();
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function readMaintenanceFlag() {
  const now = Date.now();
  if (now - lastMaintenanceFetch < MAINTENANCE_CACHE_TTL_MS) {
    return { value: cachedMaintenanceMode, error: null };
  }

  // La table settings est publique en SELECT grâce aux RLS.
  // On essaye avec le client anon ou supabaseAdmin avec fallback immédiat.
  const clients = [supabase];
  if (hasServiceRoleKey && supabaseAdmin !== supabase) {
    clients.push(supabaseAdmin);
  }

  let lastError = null;

  for (const client of clients) {
    // 1) Essai camelCase
    let res = await fetchFromClient(client, 'maintenanceMode');
    if (!res.error && res.data) {
      cachedMaintenanceMode = !!res.data.maintenanceMode;
      lastMaintenanceFetch = now;
      return { value: cachedMaintenanceMode, error: null };
    }

    // 2) Essai snake_case si erreur 42703 (colonne non trouvée)
    if (res.error?.code === '42703') {
      res = await fetchFromClient(client, 'maintenance_mode');
      if (!res.error && res.data) {
        cachedMaintenanceMode = !!res.data.maintenance_mode;
        lastMaintenanceFetch = now;
        return { value: cachedMaintenanceMode, error: null };
      }
    }

    if (res.error) {
      lastError = res.error;
    }
  }

  // Si échec de lecture (ex: réseau/clé), on utilise la dernière valeur en cache ou false (fail-open)
  // pour ne jamais bloquer le site complet avec une fausse 503 Maintenance.
  if (lastError) {
    console.warn('⚠️ Impossible de vérifier le mode maintenance, maintien de la dernière valeur connue:', lastError?.message || lastError);
  }

  return { value: cachedMaintenanceMode, error: null };
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
