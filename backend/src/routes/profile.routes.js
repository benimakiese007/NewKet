import { Router } from 'express';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../controllers/profile.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, updateMyProfile);
router.post('/me/avatar', requireAuth, uploadMyAvatar);

export default router;
