import { Router } from 'express';
import {
    createOrder,
    getOrders,
    updateOrderStatus,
    createDeliveryQuote,
    respondToDeliveryQuote,
    markOrderInDelivery,
    verifyDelivery,
    confirmOrderCompletion,
    releaseEscrow
} from '../controllers/order.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';
import { otpRateLimit } from '../middlewares/otp-rate-limit.js';

const router = Router();

router.post('/', requireAuth, createOrder);
router.get('/', requireAuth, requireAdmin, getOrders);
router.post('/:id/quote', requireAuth, createDeliveryQuote);
router.post('/:id/quote/respond', requireAuth, respondToDeliveryQuote);
router.put('/:id/status', 
    requireAuth, 
    requireAdmin, 
    [
        body('status').trim().notEmpty().withMessage('Le statut est requis')
    ],
    validate, 
    updateOrderStatus
);

router.post('/:id/start-delivery', requireAuth, markOrderInDelivery);
// SÉCURITÉ : Rate limit strict sur la vérification OTP (5 tentatives / 15 min par IP + commande)
router.post('/:id/verify-delivery', requireAuth, otpRateLimit, verifyDelivery);
router.post('/:id/confirm-completion', requireAuth, confirmOrderCompletion);
router.post('/:id/release-escrow', requireAuth, requireAdmin, releaseEscrow);

export default router;
