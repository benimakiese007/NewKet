import { Router } from 'express';
import { getPromos, applyPromo } from '../controllers/promo.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', optionalAuth, getPromos);
router.post('/apply', requireAuth, applyPromo);

export default router;
