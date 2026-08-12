import express from 'express';
import { requireCronAuth } from '../middlewares/cronAuth.js';
import { releaseDueEscrowsJob } from '../services/order-workflow.js';
import { processDueDisputesJob } from '../controllers/dispute.controller.js';
import { processDuePushNotificationJobsJob } from '../services/push-queue.service.js';
import { processProductImageWatchdogJob } from '../services/product-image-watchdog.service.js';

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

router.get('/push/process-due', requireCronAuth, async (req, res) => {
  try {
    const result = await processDuePushNotificationJobsJob();
    res.json({ ok: true, job: 'processDuePushNotificationJobsJob', ...result });
  } catch (error) {
    res.status(500).json({ ok: false, job: 'processDuePushNotificationJobsJob', error: error.message });
  }
});

router.get('/products/image-watchdog', requireCronAuth, async (req, res) => {
  try {
    const result = await processProductImageWatchdogJob();
    res.json({ ok: true, job: 'processProductImageWatchdogJob', ...result });
  } catch (error) {
    res.status(500).json({ ok: false, job: 'processProductImageWatchdogJob', error: error.message });
  }
});

export default router;
