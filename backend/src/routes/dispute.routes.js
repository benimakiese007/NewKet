import express from 'express';
import {
    createDispute,
    updateDispute,
    resolveDispute,
    getDisputes,
    getDisputeByOrder,
    addDisputeMessage,
    getDisputeMessages,
    vendorResolveAmiable,
    vendorRespondToDispute,
    buyerRespondToDispute
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

// SÉCURITÉ : Résolution de litige réservée aux administrateurs (double couche : route + contrôleur)
router.patch('/:id/resolve', requireAuth, requireAdmin, resolveDispute);

export default router;
