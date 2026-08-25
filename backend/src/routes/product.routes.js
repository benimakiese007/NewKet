import { Router } from 'express';
import { 
    getProducts, 
    getProductById, 
    createProduct, 
    updateProduct, 
    deleteProduct,
    deleteBulkProducts,
    updateBulkCategory,
    getRankedCategories,
    archiveProduct,
    restoreProduct,
    getVendorArchivedProducts
} from '../controllers/product.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.js';
import { cacheMiddleware } from '../middlewares/cache.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Hot path protection (accueil / catalogue): limit read bursts per IP.
const productsReadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 req/minute
    standardHeaders: true,
    legacyHeaders: false
});

// Routes publiques / optionnelles
// Les produits sont publiés et modifiés en direct : ne jamais afficher une boutique
// ou un catalogue périmé pendant la durée d'un cache navigateur/CDN.
router.get('/', productsReadLimiter, optionalAuth, cacheMiddleware(0), getProducts);
router.get('/categories/ranked', productsReadLimiter, cacheMiddleware(300), getRankedCategories);
router.get('/:id', productsReadLimiter, optionalAuth, cacheMiddleware(0), getProductById);

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
router.patch('/:id/archive', requireAuth, archiveProduct);
router.patch('/:id/restore', requireAuth, restoreProduct);
router.get('/vendor/archived', requireAuth, getVendorArchivedProducts);

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
