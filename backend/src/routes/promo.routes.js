import { Router } from 'express';
import {
    applyPromo,
    createVendorPromo,
    deleteVendorPromo,
    getPromos,
    getVendorPromos,
    toggleVendorPromo,
    updateVendorPromo,
    validateVendorPromo
} from '../controllers/promo.controller.js';
import { requireAuth, optionalAuth, requireAdmin } from '../middlewares/auth.js';
import { promoRateLimit } from '../middlewares/rate-limits.js';

import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, getPromos);
router.get('/vendor', requireAuth, getVendorPromos);
router.post('/vendor', requireAuth, createVendorPromo);
router.put('/vendor/:id', requireAuth, updateVendorPromo);
router.patch('/vendor/:id/toggle', requireAuth, toggleVendorPromo);
router.delete('/vendor/:id', requireAuth, deleteVendorPromo);
router.post('/validate',
    promoRateLimit,
    requireAuth,
    [
        body('promo_code').optional().trim().isString(),
        body('code').optional().trim().isString(),
        validate
    ],
    validateVendorPromo
);
router.post('/apply', 
    promoRateLimit,
    requireAuth, 
    [
        body('code').notEmpty().trim().isString(),
        validate
    ],
    applyPromo
);

export default router;
