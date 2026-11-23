import express from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// Routes pour les avis
router.get('/', reviewController.getReviews);
router.delete('/:id', requireAuth, reviewController.deleteReview);

export default router;
