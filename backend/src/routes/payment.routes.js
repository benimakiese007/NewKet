import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Route pour initialiser un paiement depuis le frontend - Protégée
router.post('/initiate', requireAuth, paymentController.initiatePayment);

// Webhook / Notify URL appelée par CinetPay
router.post('/notify', paymentController.cinetpayWebhook);

export default router;
