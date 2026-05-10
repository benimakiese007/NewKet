import { Router } from 'express';
import { getPublicUserStats, getUsers, updateStatus, deleteUser } from '../controllers/user.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = Router();

router.get('/public-stats', getPublicUserStats);
router.get('/', requireAuth, requireAdmin, getUsers);
router.put('/:id/status', 
    requireAuth, 
    requireAdmin, 
    [
        body('status').trim().notEmpty().isIn(['pending', 'approved', 'rejected']).withMessage('Statut invalide')
    ],
    validate, 
    updateStatus
);
router.delete('/:id', requireAuth, requireAdmin, deleteUser);

export default router;
