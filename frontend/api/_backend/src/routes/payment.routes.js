import express from 'express';
import { optionalAuth, requireAuth } from '../middlewares/auth.js';
import * as paymentController from '../controllers/payment.controller.js';
import { paymentRateLimit } from '../middlewares/rate-limits.js';

const router = express.Router();

// Route pour initialiser un paiement depuis le frontend - Protégée
router.post('/initiate', paymentRateLimit, requireAuth, paymentController.initiatePayment);

// Webhook FlexPay (pas de rate limit strict ici : c'est un callback externe)
router.post('/notify', paymentController.paymentWebhook);

router.get('/status/:tx_ref', paymentRateLimit, optionalAuth, paymentController.getPaymentStatus);
router.get('/verify/:order_id', paymentRateLimit, paymentController.verifyInvoice);


export default router;
