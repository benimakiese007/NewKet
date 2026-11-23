import { validationResult } from 'express-validator';

/**
 * Middleware to handle validation results.
 * If errors are found, it returns a 400 response with the error details.
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            error: 'Données invalides. Veuillez vérifier les champs.',
            details: errors.array() 
        });
    }
    next();
};
