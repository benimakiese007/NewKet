import { Router } from 'express';
import { getOrders, updateOrderStatus } from '../controllers/order.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, getOrders);
router.put('/:id/status', requireAuth, updateOrderStatus);

export default router;
