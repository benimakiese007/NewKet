import express from 'express';
import { createDispute, updateDispute, resolveDispute } from '../controllers/dispute.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/', requireAuth, createDispute);
router.put('/:id', requireAuth, updateDispute);
router.patch('/:id/resolve', requireAuth, resolveDispute);

export default router;
