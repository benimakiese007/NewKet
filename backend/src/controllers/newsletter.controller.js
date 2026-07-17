import { supabaseAdmin, supabase } from '../config/supabase.js';
import EmailService from '../services/emailService.js';

export const sendNewsletter = async (req, res) => {
    try {
        const { target, subject, content } = req.body;

        if (!subject || !content) {
            return res.status(400).json({ error: 'Subject and Content are required.' });
        }

        const client = supabaseAdmin || supabase;
        let query = client.from('users').select('email').neq('email', null);

        // Si le target n'est pas "all", on filtre par rôle
        if (target && target !== 'all') {
            query = query.eq('role', target);
        }

        const { data: users, error } = await query;

        if (error) throw error;

        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'No users found for this target.' });
        }

        const emails = users.map(user => user.email).filter(Boolean);

        const result = await EmailService.sendNewsletter({
            emails,
            subject,
            content
        });

        if (result.success) {
            return res.status(200).json({ 
                success: true, 
                message: 'Newsletter dispatched successfully.',
                totalSent: result.totalSent 
            });
        } else {
            return res.status(500).json({ error: 'Failed to send newsletter.', details: result.error });
        }
    } catch (err) {
        console.error('❌ Erreur sendNewsletter:', err.message);
        return res.status(500).json({ error: 'Internal server error while sending newsletter.' });
    }
};
