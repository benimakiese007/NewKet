import { supabase } from '../config/supabase.js';

function decodeJwtPayload(token) {
    try {
        const parts = String(token || '').split('.');
        if (parts.length < 2) return null;
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
        const json = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function getSupabaseRefFromUrl(url) {
    try {
        const host = new URL(url).host || '';
        const match = host.match(/^([a-z0-9-]+)\\.supabase\\.co$/i);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Middleware pour valider le token JWT envoyé par le frontend.
 * Il s'assure que l'utilisateur est bien authentifié via Supabase.
 */
export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Non autorisé: Token manquant ou format invalide.' });
        }

        const token = authHeader.split(' ')[1];

        // Vérifier le token avec Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error('Erreur authentification:', error);
            // Dev diagnostics: help spot project-ref mismatch without logging the token itself.
            try {
                const isLocal = /^(localhost|127\\.0\\.0\\.1)$/i.test(req.hostname || '');
                if (isLocal) {
                    const payload = decodeJwtPayload(token);
                    const tokenRef = payload?.ref || null;
                    const expectedRef = getSupabaseRefFromUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
                    if (tokenRef || expectedRef) {
                        console.warn('[Auth Debug] tokenRef=', tokenRef, 'expectedRef=', expectedRef);
                    }
                }
            } catch {
            }
            return res.status(401).json({ error: 'Non autorisé: Token invalide ou expiré.' });
        }

        // Attacher l'utilisateur à la requête
        req.user = user;
        
        // Comme on effectuera les requêtes suivantes vers Supabase au nom de l'utilisateur,
        // on peut également stocker le token dans req.token si on en a besoin pour passer le header Authorization 
        // lors des prochaines requêtes au sein de l'API.
        req.token = token;

        next();
    } catch (err) {
        console.error('❌ Erreur middleware auth:', err);
        res.status(500).json({ error: 'Erreur interne lors de la vérification de l\'authentification' });
    }
};

/**
 * Middleware optionnel : Récupère l'utilisateur s'il est connecté,
 * mais ne bloque pas la requête s'il ne l'est pas.
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                req.user = user;
                req.token = token;
            }
        }
    } catch (err) {
        // Ignorer silencieusement, l'utilisateur restera undefined
    } finally {
        next();
    }
};

let adminEmailCache = {
    emails: [],
    lastFetched: 0
};

/**
 * Helper to fetch admin emails from the database with caching
 */
const getAdminEmails = async () => {
    const now = Date.now();
    // Cache for 5 minutes
    if (adminEmailCache.emails.length > 0 && (now - adminEmailCache.lastFetched) < 5 * 60 * 1000) {
        return adminEmailCache.emails;
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('email')
            .eq('role', 'admin');

        if (error) throw error;

        adminEmailCache = {
            emails: Array.isArray(data) ? data.map(u => u.email?.toLowerCase()).filter(Boolean) : [],
            lastFetched: now
        };
        return adminEmailCache.emails;
    } catch (err) {
        console.error('Error fetching admin emails from DB:', err);
        return []; // Fallback empty to prevent unauthorized access
    }
};

/**
 * Middleware pour exiger les droits administrateur.
 * Doit être utilisé APRÈS requireAuth.
 */
export const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Non autorisé: Utilisateur introuvable.' });
        }

        // 1. Vérification rapide via les métadonnées JWT (App Metadata uniquement)
        // Les user_metadata sont modifiables par l'utilisateur via le client, on ne doit pas leur faire confiance pour les rôles.
        const isAdminMetadata = req.user.app_metadata?.role === 'admin';
        
        if (isAdminMetadata) {
            return next();
        }

        // 2. Fallback: Vérification via la liste des emails admins (mise en cache)
        const adminEmails = await getAdminEmails();
        const userEmail = req.user.email?.toLowerCase();
        
        if (adminEmails.includes(userEmail)) {
            return next();
        }
        
        // Si aucune condition n'est remplie
        return res.status(403).json({ error: 'Accès refusé: droits administrateur requis.' });

    } catch (err) {
        console.error('❌ Erreur middleware requireAdmin:', err);
        res.status(500).json({ error: 'Erreur interne lors de la vérification des droits' });
    }
};
