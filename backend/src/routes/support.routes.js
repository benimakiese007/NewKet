import express from 'express';
import * as supportController from '../controllers/support.controller.js';

const router = express.Router();

// Routes pour le support
router.get('/', supportController.getTickets);
router.post('/', supportController.createTicket);
router.patch('/:id/status', supportController.updateTicketStatus);
router.delete('/:id', supportController.deleteTicket);

export default router;
