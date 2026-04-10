import { Router } from 'express';
import { getPromos, applyPromo } from '../controllers/promo.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.js';

import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = Router();

router.get('/', optionalAuth, getPromos);
router.post('/apply', 
    requireAuth, 
    [
        body('code').notEmpty().trim().isString(),
        validate
    ],
    applyPromo
);

export default router;
