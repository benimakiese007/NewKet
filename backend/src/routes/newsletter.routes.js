import { Router } from 'express';
import {
    deleteNewsletterSubscriber,
    resubscribeNewsletterSubscriber,
    subscribeNewsletter,
    syncNewsletterBackfill,
    unsubscribeNewsletterSubscriber
} from '../controllers/newsletter.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = Router();

/**
 * Public newsletter subscription endpoint.
 * POST /api/newsletter/subscribe
 */
router.post('/subscribe', subscribeNewsletter);

router.post('/sync', requireAuth, requireAdmin, syncNewsletterBackfill);
router.post('/subscribers/:id/unsubscribe', requireAuth, requireAdmin, unsubscribeNewsletterSubscriber);
router.post('/subscribers/:id/resubscribe', requireAuth, requireAdmin, resubscribeNewsletterSubscriber);
router.delete('/subscribers/:id', requireAuth, requireAdmin, deleteNewsletterSubscriber);

export default router;
