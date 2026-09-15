import express from 'express';
import { handleChat } from '../controllers/chat.controller.js';
import { chatRateLimit } from '../middlewares/rate-limits.js';

const router = express.Router();

/**
 * POST /api/chat
 * Proxy sécurisé vers l'API Gemini pour le chatbot de support.
 * La clé API Gemini est lue depuis process.env.GEMINI_API_KEY (jamais exposée au client).
 *
 * Rate limit : 20 requêtes / 15 minutes par IP (défini dans rate-limits.js)
 */
router.post('/', chatRateLimit, handleChat);

export default router;
