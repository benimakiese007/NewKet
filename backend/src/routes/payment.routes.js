import express from 'express';
import { optionalAuth, requireAuth } from '../middlewares/auth.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Route pour initialiser un paiement depuis le frontend - Protégée
router.post('/initiate', requireAuth, paymentController.initiatePayment);

// Webhook FlexPaie / KPay
router.post('/notify', paymentController.paymentWebhook);

// Vérification active KPay (fallback quand le webhook ne livre pas, ex: mode test)
router.post('/kpay-verify', requireAuth, paymentController.kpayActiveVerify);

router.get('/status/:tx_ref', optionalAuth, paymentController.getPaymentStatus);
router.get('/verify/:order_id', paymentController.verifyInvoice);


export default router;
