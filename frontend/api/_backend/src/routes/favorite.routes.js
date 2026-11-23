import { Router } from 'express';
import { syncFromSupabase, syncToSupabase } from '../controllers/favorite.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireAuth, syncFromSupabase);
router.post('/', requireAuth, syncToSupabase);

export default router;
