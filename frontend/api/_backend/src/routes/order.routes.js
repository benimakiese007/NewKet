import { Router } from 'express';
import {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    createDeliveryQuote,
    respondToDeliveryQuote,
    markOrderInDelivery,
    verifyDelivery,
    confirmOrderCompletion,
    releaseEscrow,
    reportClientNoShow
} from '../controllers/order.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';
import { otpRateLimit } from '../middlewares/otp-rate-limit.js';

const router = Router();

router.post('/',
    requireAuth,
    [
        body('product_id').trim().notEmpty().withMessage('Le produit est requis'),
        body('quantity').optional().isInt({ min: 1 }).withMessage('La quantite doit etre un entier positif')
    ],
    validate,
    createOrder
);
router.get('/', requireAuth, getOrders);
router.get('/:id', requireAuth, getOrderById);
router.post('/:id/quote', requireAuth, createDeliveryQuote);
router.post('/:id/quote/respond', requireAuth, respondToDeliveryQuote);
router.put('/:id/status', 
    requireAuth, 
    [
        body('status').trim().notEmpty().withMessage('Le statut est requis')
    ],
    validate, 
    updateOrderStatus
);

router.post('/:id/start-delivery', requireAuth, markOrderInDelivery);
// SÉCURITÉ : Rate limit strict sur la vérification OTP (5 tentatives / 15 min par IP + commande)
router.post('/:id/verify-delivery', requireAuth, otpRateLimit, verifyDelivery);
router.post('/:id/report-no-show', requireAuth, reportClientNoShow);
router.post('/:id/confirm-completion', requireAuth, confirmOrderCompletion);
router.post('/:id/release-escrow', requireAuth, requireAdmin, releaseEscrow);

export default router;
