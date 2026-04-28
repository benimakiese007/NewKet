import express from 'express';
import { optionalAuth, requireAdmin, requireAuth } from '../middlewares/auth.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Route pour initialiser un paiement depuis le frontend - Protégée
router.post('/initiate', requireAuth, paymentController.initiatePayment);

// Webhook appelé par Flutterwave après chaque paiement
router.post('/notify', paymentController.flutterwaveWebhook);

router.post('/reverify', requireAuth, requireAdmin, paymentController.reverifyFlutterwaveTransaction);

router.get('/status/:tx_ref', optionalAuth, paymentController.getPaymentStatus);

export default router;
