import express from 'express';
import { getPushPublicKey, subscribeToPush, unsubscribeFromPush, sendCallRing, sendChatMessage } from '../controllers/push.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/public-key', getPushPublicKey);
router.post('/subscribe', requireAuth, subscribeToPush);
router.delete('/subscribe', requireAuth, unsubscribeFromPush);
router.post('/call-ring', requireAuth, sendCallRing);
router.post('/chat-message', requireAuth, sendChatMessage);

export default router;

