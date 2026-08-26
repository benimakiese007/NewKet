import { Router } from 'express';
import { supabaseAdmin, hasServiceRoleKey, supabase } from '../config/supabase.js';
import { createHash } from 'crypto';

const router = Router();

/**
 * POST /api/consent
 * Enregistre un consentement utilisateur (Art. 7 RGPD).
 * Route publique : peut être appelée sans être connecté (bannière cookie).
 */
router.post('/', async (req, res) => {
    try {
        const { consent_given, consent_type, consent_version, session_id } = req.body;

        if (typeof consent_given !== 'boolean') {
            return res.status(400).json({ error: 'consent_given doit être un booléen.' });
        }
        if (!consent_type || typeof consent_type !== 'string') {
            return res.status(400).json({ error: 'consent_type est requis.' });
        }
        if (!consent_version || typeof consent_version !== 'string') {
            return res.status(400).json({ error: 'consent_version est requis.' });
        }
        if (session_id != null && (typeof session_id !== 'string' || session_id.length > 128)) {
            return res.status(400).json({ error: 'session_id invalide.' });
        }

        const ALLOWED_TYPES = ['analytics', 'marketing', 'functional', 'all', 'none'];
        if (!ALLOWED_TYPES.includes(consent_type)) {
            return res.status(400).json({ error: 'consent_type invalide.' });
        }

        // Hash de l'IP (on ne stocke jamais l'IP brute — principe de minimisation RGPD)
        const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
        const ipHash = createHash('sha256')
            .update(rawIp + (process.env.CONSENT_IP_SALT || 'newket-salt'))
            .digest('hex')
            .slice(0, 16);

        // L'utilisateur peut être connecté ou non
        const userId = req.user?.id || null;

        const sb = hasServiceRoleKey ? supabaseAdmin : supabase;

        const { error } = await sb
            .from('consent_log')
            .insert({
                user_id: userId,
                session_id: session_id || null,
                consent_given,
                consent_type,
                consent_version,
                ip_hash: ipHash,
                user_agent: (req.headers['user-agent'] || '').slice(0, 255),
            });

        if (error) {
            // Si la table n'existe pas encore, on ne bloque pas l'utilisateur
            if (error.code === '42P01') {
                console.warn('[Consent] Table consent_log inexistante — migration 03_consent_log.sql à appliquer.');
                return res.json({ success: true, warning: 'Consentement non enregistré : migration DB requise.' });
            }
            throw error;
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('[Consent] Erreur enregistrement:', err.message);
        // On ne bloque jamais l'utilisateur pour un échec de journalisation de consentement
        return res.status(500).json({ error: 'Erreur lors de l\'enregistrement du consentement.' });
    }
});

export default router;
