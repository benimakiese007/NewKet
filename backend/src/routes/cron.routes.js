import express from 'express';
import { requireCronAuth } from '../middlewares/cronAuth.js';
import { releaseDueEscrowsJob } from '../services/order-workflow.js';
import { processDueDisputesJob } from '../controllers/dispute.controller.js';

const router = express.Router();

// Vercel Cron Jobs can only do GET requests. We secure with ?token=... or Bearer token.
router.get('/escrows/release-due', requireCronAuth, async (req, res) => {
  try {
    const result = await releaseDueEscrowsJob();
    res.json({ ok: true, job: 'releaseDueEscrowsJob', ...result, ran_at: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ ok: false, job: 'releaseDueEscrowsJob', error: error.message });
  }
});

router.get('/disputes/process-due', requireCronAuth, async (req, res) => {
  try {
    const result = await processDueDisputesJob();
    res.json({ ok: true, job: 'processDueDisputesJob', ...result, ran_at: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ ok: false, job: 'processDueDisputesJob', error: error.message });
  }
});

export default router;

