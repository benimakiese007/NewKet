import { Router } from 'express';
import { getUsers, updateStatus, deleteUser } from '../controllers/user.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, getUsers);
router.put('/:id/status', requireAuth, requireAdmin, updateStatus);
router.delete('/:id', requireAuth, requireAdmin, deleteUser);

export default router;
