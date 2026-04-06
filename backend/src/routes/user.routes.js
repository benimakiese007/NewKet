import { Router } from 'express';
import { getUsers, updateStatus, deleteUser } from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, getUsers);
router.put('/:id/status', requireAuth, updateStatus);
router.delete('/:id', requireAuth, deleteUser);

export default router;
