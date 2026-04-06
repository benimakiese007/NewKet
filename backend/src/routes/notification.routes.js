import { Router } from 'express';
import { getNotifications, addNotification, markAsRead } from '../controllers/notification.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.post('/', requireAuth, addNotification);
router.put('/:id/read', requireAuth, markAsRead);

export default router;
