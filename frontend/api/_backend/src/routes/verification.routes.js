/**
 * verification.routes.js
 * Routes pour la certification Vendeur Pro (badge RCCM vérifié).
 *
 * Endpoints :
 *   POST   /api/verification/submit       → vendeur soumet RCCM + doc
 *   GET    /api/verification/my-status    → vendeur voit son statut actuel
 *   GET    /api/verification/pending      → admin liste les demandes pending
 *   PUT    /api/verification/:id/approve  → admin approuve
 *   PUT    /api/verification/:id/reject   → admin refuse
 */

import { Router } from 'express';
import {
    submitVerification,
    uploadRccmDoc,
    getPendingVerifications,
    approveVerification,
    rejectVerification,
    getMyVerificationStatus
} from '../controllers/verification.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = Router();

// ── Routes Vendeur (authentifié requis) ─────────────────────────────────────

// Récupérer son propre statut de vérification
router.get(
    '/my-status',
    requireAuth,
    getMyVerificationStatus
);

// Soumettre une demande de certification Pro
// On utilise multer AVANT les autres middlewares pour parser le multipart/form-data
router.post(
    '/submit',
    requireAuth,
    uploadRccmDoc, // multer middleware (parse le fichier)
    [
        body('rccm_number')
            .trim()
            .notEmpty()
            .withMessage('Le numéro RCCM est obligatoire.')
            .isLength({ min: 3, max: 50 })
            .withMessage('Le numéro RCCM doit comporter entre 3 et 50 caractères.'),
        body('company_name')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Le nom de l\'entreprise ne peut dépasser 100 caractères.')
    ],
    validate,
    submitVerification
);

// ── Routes Admin (admin requis) ──────────────────────────────────────────────

// Lister les demandes en attente
router.get(
    '/pending',
    requireAuth,
    requireAdmin,
    getPendingVerifications
);

// Approuver une demande
router.put(
    '/:id/approve',
    requireAuth,
    requireAdmin,
    approveVerification
);

// Refuser une demande
router.put(
    '/:id/reject',
    requireAuth,
    requireAdmin,
    [
        body('reason')
            .trim()
            .notEmpty()
            .withMessage('Le motif de refus est obligatoire.')
            .isLength({ max: 500 })
            .withMessage('Le motif ne peut dépasser 500 caractères.')
    ],
    validate,
    rejectVerification
);

export default router;
