import { Router } from 'express';
import { getActivities, logActivity } from '../controllers/activity.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, getActivities);
router.post('/', requireAuth, logActivity);

export default router;
