import { Router } from 'express';
import { getOrders, updateOrderStatus } from '../controllers/order.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = Router();

router.get('/', requireAuth, getOrders);
router.put('/:id/status', 
    requireAuth, 
    [
        body('status').trim().notEmpty().withMessage('Le statut est requis')
    ],
    validate, 
    updateOrderStatus
);

export default router;
