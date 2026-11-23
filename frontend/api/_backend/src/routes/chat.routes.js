import express from 'express';
import { handleChat, uploadChatAudio } from '../controllers/chat.controller.js';
import { chatRateLimit, chatAudioRateLimit } from '../middlewares/rate-limits.js';
import { uploadAudioMiddleware } from '../middlewares/upload.middleware.js';

const router = express.Router();

/**
 * POST /api/chat
 * Proxy sécurisé vers l'API Gemini pour le chatbot de support.
 * La clé API Gemini est lue depuis process.env.GEMINI_API_KEY (jamais exposée au client).
 *
 * Rate limit : 20 requêtes / 15 minutes par IP (défini dans rate-limits.js)
 */
router.post('/', chatRateLimit, handleChat);

/**
 * POST /api/chat/upload-audio
 * Upload d'une note vocale vers Cloudinary pour le chat en direct (livraison).
 * Rate limit : 60 audios / 15 minutes par IP
 */
router.post('/upload-audio', chatAudioRateLimit, uploadAudioMiddleware.single('audio'), uploadChatAudio);

export default router;
