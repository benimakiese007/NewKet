import express from 'express';
import { createDispute, updateDispute, resolveDispute, getDisputes, addDisputeMessage, getDisputeMessages, vendorResolveAmiable } from '../controllers/dispute.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, getDisputes);
router.post('/', requireAuth, createDispute);
router.put('/:id', requireAuth, updateDispute);

// MESSAGERIE
router.get('/:id/messages', requireAuth, getDisputeMessages);
router.post('/:id/messages', requireAuth, addDisputeMessage);

// AUTO-RÉSOLUTION
router.post('/:id/vendor-resolve', requireAuth, vendorResolveAmiable);

// SÉCURITÉ : Résolution de litige réservée aux administrateurs (double couche : route + contrôleur)
router.patch('/:id/resolve', requireAuth, requireAdmin, resolveDispute);

export default router;
