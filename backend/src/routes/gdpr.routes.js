import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { exportMyData, requestAccountDeletion, getConsentHistory } from '../controllers/gdpr.controller.js';

const router = Router();

/**
 * GET /api/gdpr/export
 * Télécharger toutes ses données personnelles (Art. 15 & 20 RGPD)
 */
router.get('/export', requireAuth, exportMyData);

/**
 * POST /api/gdpr/delete-account
 * Demande de suppression de compte (Art. 17 RGPD)
 */
router.post('/delete-account', requireAuth, requestAccountDeletion);

/**
 * GET /api/gdpr/consent-history
 * Historique des consentements (Art. 7(1) RGPD)
 */
router.get('/consent-history', requireAuth, getConsentHistory);

export default router;
