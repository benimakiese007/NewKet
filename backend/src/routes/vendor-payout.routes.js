import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
    requestPayoutOtp,
    verifyPayoutOtp,
    getVendorPayoutMethods,
    addVendorPayoutMethod,
    removeVendorPayoutMethod,
    updateEscrowTimer,
    getEscrowTimer
} from '../services/vendor-payout.service.js';

const router = express.Router();

// ─── Toutes les routes nécessitent une authentification ───
router.use(requireAuth);

/**
 * POST /api/vendor-payouts/request-otp
 * Envoie un code OTP par email pour sécuriser l'ajout/modification d'un compte
 */
router.post('/request-otp', async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'Email utilisateur introuvable' });
        }

        const action = req.body.action || 'ADD_PAYOUT_METHOD';
        await requestPayoutOtp(userId, userEmail, action);

        return res.status(200).json({
            success: true,
            message: 'Code de sécurité envoyé par email'
        });
    } catch (error) {
        console.error('[VendorPayout] request-otp error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/vendor-payouts/add
 * Ajoute un compte de réception après vérification OTP
 * Body: { otp_code, provider, account_id, account_name, is_default }
 */
router.post('/add', async (req, res) => {
    try {
        const userId = req.user.id;
        const { otp_code, provider, account_id, account_name, is_default } = req.body;

        if (!otp_code || !provider || !account_id) {
            return res.status(400).json({
                success: false,
                message: 'Champs requis : otp_code, provider, account_id'
            });
        }

        // Vérification OTP
        const isValid = await verifyPayoutOtp(userId, 'ADD_PAYOUT_METHOD', otp_code);
        if (!isValid) {
            return res.status(403).json({
                success: false,
                message: 'Code de sécurité invalide ou expiré'
            });
        }

        const method = await addVendorPayoutMethod(
            userId,
            provider,
            account_id,
            account_name || null,
            is_default || false
        );

        return res.status(201).json({
            success: true,
            message: 'Compte de réception ajouté avec succès',
            data: method
        });
    } catch (error) {
        console.error('[VendorPayout] add error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/vendor-payouts/methods
 * Liste les comptes de réception du vendeur connecté
 */
router.get('/methods', async (req, res) => {
    try {
        const userId = req.user.id;
        const methods = await getVendorPayoutMethods(userId);

        return res.status(200).json({
            success: true,
            data: methods
        });
    } catch (error) {
        console.error('[VendorPayout] list error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * DELETE /api/vendor-payouts/methods/:id
 * Supprime un compte de réception (requiert OTP)
 * Body: { otp_code }
 */
router.delete('/methods/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const methodId = req.params.id;
        const { otp_code } = req.body;

        if (!otp_code) {
            return res.status(400).json({
                success: false,
                message: 'Code de sécurité requis pour supprimer un compte'
            });
        }

        const isValid = await verifyPayoutOtp(userId, 'ADD_PAYOUT_METHOD', otp_code);
        if (!isValid) {
            return res.status(403).json({
                success: false,
                message: 'Code de sécurité invalide ou expiré'
            });
        }

        await removeVendorPayoutMethod(userId, methodId);

        return res.status(200).json({
            success: true,
            message: 'Compte de réception supprimé'
        });
    } catch (error) {
        console.error('[VendorPayout] delete error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/vendor-payouts/escrow-timer
 * Récupère le délai d'escrow du vendeur
 */
router.get('/escrow-timer', async (req, res) => {
    try {
        const hours = await getEscrowTimer(req.user.id);
        return res.status(200).json({ success: true, escrow_timer_hours: hours });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/vendor-payouts/escrow-timer
 * Met à jour le délai d'escrow (entre 24 et 72h)
 * Body: { hours: 24 | 48 | 72 }
 */
router.put('/escrow-timer', async (req, res) => {
    try {
        const { hours } = req.body;
        await updateEscrowTimer(req.user.id, hours);

        return res.status(200).json({
            success: true,
            message: `Délai de sécurité mis à jour à ${hours}h`
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

export default router;
