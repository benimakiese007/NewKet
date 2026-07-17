import express from 'express';
import EmailService from '../services/emailService.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Endpoint to send vendor approval email
 * POST /api/emails/vendor-approval
 */
router.post('/vendor-approval', requireAuth, requireAdmin, async (req, res) => {
    const { email, name } = req.body;
    
    if (!email || !name) {
        return res.status(400).json({ error: 'Email and Name are required.' });
    }

    const result = await EmailService.sendVendorApproval(email, name);
    if (result.success) {
        res.json({ success: true, message: 'Approval email sent.' });
    } else {
        res.status(500).json({ error: 'Failed to send approval email.', details: result.error });
    }
});

import { sendNewsletter } from '../controllers/newsletter.controller.js';

/**
 * Endpoint to notify vendor of a new lead
 * POST /api/emails/lead-notification
 */
router.post('/lead-notification', requireAuth, async (req, res) => {
    const { vendorEmail, vendorName, productName, customerName, customerPhone } = req.body;
    
    if (!vendorEmail || !vendorName || !productName) {
        return res.status(400).json({ error: 'Missing required lead information.' });
    }

    const result = await EmailService.sendLeadNotification({
        vendorEmail,
        vendorName,
        productName,
        customerName,
        customerPhone
    });

    if (result.success) {
        res.json({ success: true, message: 'Lead notification email sent.' });
    } else {
        res.status(500).json({ error: 'Failed to send lead email.', details: result.error });
    }
});

/**
 * Endpoint to send newsletter
 * POST /api/emails/newsletter
 */
router.post('/newsletter', requireAuth, requireAdmin, sendNewsletter);

export default router;
