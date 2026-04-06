import { Router } from 'express';
import { getMyProfile, updateMyProfile } from '../controllers/profile.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, updateMyProfile);

export default router;
