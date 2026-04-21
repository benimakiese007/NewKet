import express from 'express';
import { createDispute, updateDispute, resolveDispute, getDisputes } from '../controllers/dispute.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', requireAuth, getDisputes);
router.post('/', requireAuth, createDispute);
router.put('/:id', requireAuth, updateDispute);
// SÉCURITÉ : Résolution de litige réservée aux administrateurs (double couche : route + contrôleur)
router.patch('/:id/resolve', requireAuth, requireAdmin, resolveDispute);

export default router;
