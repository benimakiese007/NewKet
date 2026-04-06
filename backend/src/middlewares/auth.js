import { supabase } from '../config/supabase.js';

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
