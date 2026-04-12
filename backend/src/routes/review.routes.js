import express from 'express';
import * as reviewController from '../controllers/review.controller.js';

const router = express.Router();

// Routes admin pour les avis
router.get('/', reviewController.getReviews);
router.delete('/:id', reviewController.deleteReview);

export default router;
