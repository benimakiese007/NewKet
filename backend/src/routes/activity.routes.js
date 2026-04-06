import { Router } from 'express';
import { getActivities, logActivity } from '../controllers/activity.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, getActivities);
router.post('/', requireAuth, logActivity);

export default router;
