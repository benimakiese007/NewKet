import express from 'express';
import {
    createDispute,
    updateDispute,
    resolveDispute,
    rejectDispute,
    getDisputes,
    getDisputeByOrder,
    addDisputeMessage,
    getDisputeMessages,
    vendorResolveAmiable,
    vendorRespondToDispute,
    buyerRespondToDispute,
    escalateToAdmin,
    getReturnOtp,
    confirmReturn
} from '../controllers/dispute.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, getDisputes);
router.get('/by-order/:orderId', requireAuth, getDisputeByOrder);
router.post('/', requireAuth, createDispute);
router.put('/:id', requireAuth, updateDispute);

// MESSAGERIE
router.get('/:id/messages', requireAuth, getDisputeMessages);
router.post('/:id/messages', requireAuth, addDisputeMessage);
router.post('/:id/vendor-action', requireAuth, vendorRespondToDispute);
router.post('/:id/buyer-action', requireAuth, buyerRespondToDispute);

// AUTO-RÉSOLUTION
router.post('/:id/vendor-resolve', requireAuth, vendorResolveAmiable);

// ESCALADE MANUELLE ADMIN
router.post('/:id/escalate', requireAuth, escalateToAdmin);

// RETOUR PRODUIT (OTP)
router.get('/:id/return-otp', requireAuth, getReturnOtp);   // Vendeur/Admin uniquement
router.post('/:id/confirm-return', requireAuth, confirmReturn);

// SÉCURITÉ : Résolution de litige réservée aux administrateurs (double couche : route + contrôleur)
router.patch('/:id/resolve', requireAuth, requireAdmin, resolveDispute);

// SÉCURITÉ : Rejet de litige réservé aux administrateurs (litige abusif/non fondé)
router.patch('/:id/reject', requireAuth, requireAdmin, rejectDispute);

export default router;
