import express from 'express';
import { getKPIs, getCharts, exportCSV } from '../controllers/accounting.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication (controller will verify if user is admin)
router.use(requireAuth);

router.get('/kpis', getKPIs);
router.get('/charts', getCharts);
router.get('/export', exportCSV);

export default router;
