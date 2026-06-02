import { Router } from 'express';
import { body } from 'express-validator';
import { claimReferral, getMyReferralSummary } from '../controllers/referral.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validation.js';

const router = Router();

router.get('/me', requireAuth, getMyReferralSummary);
router.post(
    '/claim',
    requireAuth,
    [
        body('code').optional().trim().isString(),
        validate
    ],
    claimReferral
);

export default router;
