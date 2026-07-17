import { Router } from 'express';
import { getSettings, saveSettings, requestTransactionResetOTP, verifyTransactionResetOTP } from '../controllers/settings.controller.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middlewares/auth.js';

import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = Router();

// Les paramètres globaux (ex: taux de change) peuvent être lus publiquement
router.get('/', optionalAuth, getSettings);

// Seul l'admin peut modifier
router.put('/', 
    requireAuth, 
        requireAdmin, 
        [
            body('exchangeRate').optional().isNumeric(),
            body('adminEmails').optional().isArray(),
            body('admin_emails').optional().isArray(),
            body('adminEmails.*').optional().isEmail().withMessage('Email invalide'),
            body('admin_emails.*').optional().isEmail().withMessage('Email invalide'),
            validate
        ],
        saveSettings
);

// Danger Zone: Transaction Reset
router.post('/reset-transactions/request-otp', requireAuth, requireAdmin, requestTransactionResetOTP);
router.post('/reset-transactions/verify', requireAuth, requireAdmin, verifyTransactionResetOTP);

export default router;
