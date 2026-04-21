import { Router } from 'express';
import { getOrders, updateOrderStatus, verifyDelivery, releaseEscrow } from '../controllers/order.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';
import { otpRateLimit } from '../middlewares/otp-rate-limit.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, getOrders);
router.put('/:id/status', 
    requireAuth, 
    requireAdmin, 
    [
        body('status').trim().notEmpty().withMessage('Le statut est requis')
    ],
    validate, 
    updateOrderStatus
);

// SÉCURITÉ : Rate limit strict sur la vérification OTP (5 tentatives / 15 min par IP + commande)
router.post('/:id/verify-delivery', requireAuth, otpRateLimit, verifyDelivery);
router.post('/:id/release-escrow', requireAuth, requireAdmin, releaseEscrow);

export default router;
