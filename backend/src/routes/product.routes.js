import { Router } from 'express';
import { 
    getProducts, 
    getProductById, 
    createProduct, 
    updateProduct, 
    deleteProduct,
    deleteBulkProducts,
    updateBulkCategory
} from '../controllers/product.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = Router();

// Routes publiques / optionnelles
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProductById);

// Routes sécurisées
router.post('/', 
    requireAuth, 
    [
        body('name').trim().notEmpty().withMessage('Le nom est requis'),
        body('price').isNumeric().withMessage('Le prix doit être un nombre'),
        body('category').trim().notEmpty().withMessage('La catégorie est requise'),
        body('is_new').isBoolean().withMessage('L\'état de l\'objet est requis')
    ],
    validate, 
    createProduct
);

router.put('/:id', 
    requireAuth, 
    [
        body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide'),
        body('price').optional().isNumeric().withMessage('Le prix doit être un nombre'),
        body('category').optional().trim().notEmpty().withMessage('La catégorie ne peut pas être vide'),
        body('is_new').optional().isBoolean().withMessage('L\'état doit être un booléen')
    ],
    validate, 
    updateProduct
);

router.delete('/:id', requireAuth, deleteProduct);

// Actions groupées
router.post('/bulk-delete', 
    requireAuth, 
    [
        body('ids').isArray({ min: 1 }).withMessage('Une liste d\'IDs est requise')
    ],
    validate, 
    deleteBulkProducts
);

router.post('/bulk-category', 
    requireAuth, 
    [
        body('ids').isArray({ min: 1 }).withMessage('Une liste d\'IDs est requise'),
        body('category').trim().notEmpty().withMessage('La catégorie est requise')
    ],
    validate, 
    updateBulkCategory
);

export default router;
