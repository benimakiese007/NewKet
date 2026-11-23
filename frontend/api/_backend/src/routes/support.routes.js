import express from 'express';
import * as supportController from '../controllers/support.controller.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middlewares/auth.js';
import { supportRateLimit } from '../middlewares/rate-limits.js';

const router = express.Router();

// SÉCURITÉ : Toutes les routes sont protégées.
// - POST / : open (les visiteurs et clients peuvent créer des tickets)
// - GET / : requireAuth + requireAdmin (seul l'admin voit tous les tickets)
// - PATCH/DELETE : requireAuth + requireAdmin (seul l'admin gère les tickets)
router.get('/', requireAuth, requireAdmin, supportController.getTickets);
router.post('/', supportRateLimit, optionalAuth, supportController.createTicket);
router.patch('/:id/status', requireAuth, requireAdmin, supportController.updateTicketStatus);
router.delete('/:id', requireAuth, requireAdmin, supportController.deleteTicket);

export default router;
