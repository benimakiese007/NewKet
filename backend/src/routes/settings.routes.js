import { Router } from 'express';
import { getSettings, saveSettings } from '../controllers/settings.controller.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middlewares/auth.js';

const router = Router();

// Les paramètres globaux (ex: taux de change) peuvent être lus publiquement
router.get('/', optionalAuth, getSettings);

// Seul l'admin peut modifier
router.put('/', requireAuth, requireAdmin, saveSettings);

export default router;
