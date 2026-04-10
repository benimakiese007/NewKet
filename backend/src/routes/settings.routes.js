import { Router } from 'express';
import { getSettings, saveSettings } from '../controllers/settings.controller.js';
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
        body('exchange_rate').optional().isNumeric(),
        body('admin_emails').optional().isArray(),
        body('admin_emails.*').isEmail().withMessage('Email invalide'),
        validate
    ],
    saveSettings
);

export default router;
