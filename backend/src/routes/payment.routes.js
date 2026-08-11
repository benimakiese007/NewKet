import express from 'express';
import { optionalAuth, requireAuth } from '../middlewares/auth.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Route pour initialiser un paiement depuis le frontend - Protégée
router.post('/initiate', requireAuth, paymentController.initiatePayment);

// Webhook FlexPay
router.post('/notify', paymentController.paymentWebhook);


router.get('/status/:tx_ref', optionalAuth, paymentController.getPaymentStatus);
router.get('/verify/:order_id', paymentController.verifyInvoice);


export default router;
