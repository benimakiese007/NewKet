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

const router = Router();

// Routes publiques / optionnelles
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProductById);

// Routes sécurisées
router.post('/', requireAuth, createProduct);
router.put('/:id', requireAuth, updateProduct);
router.delete('/:id', requireAuth, deleteProduct);

// Actions groupées
router.post('/bulk-delete', requireAuth, deleteBulkProducts);
router.post('/bulk-category', requireAuth, updateBulkCategory);

export default router;
