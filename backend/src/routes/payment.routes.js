import express from 'express';
import * as paymentController from '../controllers/payment.controller.js';

const router = express.Router();

// Route pour initialiser un paiement depuis le frontend
router.post('/initiate', paymentController.initiatePayment);

// Webhook / Notify URL appelée par CinetPay
router.post('/notify', paymentController.cinetpayWebhook);

export default router;
