import { Router } from 'express';
import { getPublicUserStats, getUsers, getUserReferralSummary, updateStatus, updateSellerType, deleteUser, registerSession } from '../controllers/user.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';


const router = Router();

router.get('/public-stats', getPublicUserStats);
router.post('/session', requireAuth, registerSession);

router.get('/', requireAuth, requireAdmin, getUsers);
router.get('/:id/referral-summary', requireAuth, requireAdmin, getUserReferralSummary);
router.put('/:id/status', 
    requireAuth, 
    requireAdmin, 
    [
        body('status').trim().notEmpty().isIn(['pending', 'approved', 'rejected']).withMessage('Statut invalide')
    ],
    validate, 
    updateStatus
);
router.put('/:id/seller-type',
    requireAuth,
    requireAdmin,
    [
        body('seller_type')
            .trim()
            .notEmpty()
            .equals('certified')
            .withMessage('Seller type invalide')
    ],
    validate,
    updateSellerType
);
router.delete('/:id', requireAuth, requireAdmin, deleteUser);

export default router;
