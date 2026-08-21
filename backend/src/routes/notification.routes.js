import express from 'express';
import { getNotifications, addNotification, markAsRead, deleteNotification, clearNotifications } from '../controllers/notification.controller.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', optionalAuth, getNotifications);
// SÉCURITÉ : Seul l'admin peut créer des notifications (broadcast ou ciblées)
router.post('/', requireAuth, requireAdmin, addNotification);
router.put('/:id/read', requireAuth, markAsRead);
router.delete('/:id', requireAuth, deleteNotification);
router.delete('/', requireAuth, clearNotifications);

export default router;
