import { Router } from 'express';
import { getCategories } from '../controllers/category.controller.js';
import { cacheMiddleware } from '../middlewares/cache.js';
import { optionalAuth } from '../middlewares/auth.js';

const router = Router();

// Cache categories for 5 minutes since they don't change ranking very frequently
router.get('/', optionalAuth, cacheMiddleware(300), getCategories);

export default router;
