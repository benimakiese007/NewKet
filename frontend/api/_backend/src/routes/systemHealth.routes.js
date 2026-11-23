import express from 'express';
import { ackIncident, listIncidents, resolveIncident, runSystemCheck } from '../controllers/systemHealth.controller.js';

const router = express.Router();

router.post('/check', runSystemCheck);
router.get('/incidents', listIncidents);
router.post('/incidents/:id/ack', ackIncident);
router.post('/incidents/:id/resolve', resolveIncident);

export default router;

