import { supabaseAdmin } from '../config/supabase.js';

// ─── Statuts de tickets support autorisés ────────────────────────────────────
const ALLOWED_TICKET_STATUSES = ['ouvert', 'en_cours', 'resolu', 'ferme'];

export const getTickets = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur getTickets:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des tickets.' });
    }
};

export const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || !status) return res.status(400).json({ error: 'ID et statut requis.' });

        // Validation whitelist des statuts
        if (!ALLOWED_TICKET_STATUSES.includes(status)) {
            return res.status(400).json({ 
                error: `Statut invalide. Valeurs autorisées : ${ALLOWED_TICKET_STATUSES.join(', ')}`
            });
        }

        const { data, error } = await supabaseAdmin
            .from('support_tickets')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erreur updateTicketStatus:', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du ticket.' });
    }
};

export const deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'ID requis.' });

        const { error } = await supabaseAdmin
            .from('support_tickets')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Ticket supprimé avec succès.' });
    } catch (err) {
        console.error('Erreur deleteTicket:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression du ticket.' });
    }
};

// Also add a way to create tickets (for future frontend integration)
export const createTicket = async (req, res) => {
    try {
        const { subject, customer_name, customer_email, message } = req.body;
        
        if (!subject || !customer_name || !message) {
            return res.status(400).json({ error: 'Sujet, nom et message sont requis.' });
        }

        const ticketId = `TKT-${Date.now().toString().slice(-6)}`;

        const { data, error } = await supabaseAdmin
            .from('support_tickets')
            .insert({
                id: ticketId,
                subject,
                customer_name,
                customer_email,
                message,
                status: 'ouvert'
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Erreur createTicket:', err);
        res.status(500).json({ error: 'Erreur lors de la création du ticket.' });
    }
};
