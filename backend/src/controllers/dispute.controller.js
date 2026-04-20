import { supabaseAdmin } from '../config/supabase.js';

export const createDispute = async (req, res) => {
    try {
        const { order_id, reason_category, description, proof_urls } = req.body;
        const customer_id = req.user.id;

        // Validation basique
        if (!order_id || !reason_category || !description) {
            return res.status(400).json({ success: false, message: 'Veuillez fournir order_id, reason_category, et description.' });
        }

        // Vérification des preuves: min 1 vidéo ou 2 photos
        if (!proof_urls || !Array.isArray(proof_urls)) {
            return res.status(400).json({ success: false, message: 'Vous devez fournir des preuves (2 photos ou 1 vidéo).' });
        }
        
        let validProofs = false;
        const videos = proof_urls.filter(url => url.match(/\.(mp4|mov|avi|wmv)$/i));
        const images = proof_urls.filter(url => url.match(/\.(jpeg|jpg|gif|png)$/i));

        if (videos.length >= 1 || images.length >= 2) {
            validProofs = true;
        }

        if (!validProofs) {
            return res.status(400).json({ success: false, message: 'Preuves insuffisantes: veuillez fournir au moins 1 vidéo ou 2 photos.' });
        }

        // Fetch Order info
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, store_id, status')
            .eq('id', order_id)
            .eq('customer_id', customer_id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ success: false, message: 'Commande introuvable ou accès refusé.' });
        }

        // Seules les commandes PAID_HELD ou DELIVERED ou SHIPPED peuvent être disputées
        const allowedStatuses = ['PAID_HELD', 'DELIVERED', 'SHIPPED'];
        if (!allowedStatuses.includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Vous ne pouvez pas ouvrir de litige pour une commande avec le statut : ' + order.status });
        }

        // Créer l'entrée dispute
        const { data: dispute, error: disputeError } = await supabaseAdmin
            .from('disputes')
            .insert({
                order_id: order.id,
                customer_id: customer_id,
                vendor_id: order.store_id, // assuming store_id maps to vendor_id
                reason_category,
                description,
                proof_urls,
                status: 'OPEN'
            })
            .select()
            .single();

        if (disputeError) {
            console.error('Erreur Supabase création litige:', disputeError);
            return res.status(500).json({ success: false, message: 'Erreur lors de la création du litige.' });
        }

        // Mettre à jour la commande en FROZEN
        await supabaseAdmin
            .from('orders')
            .update({ status: 'FROZEN' })
            .eq('id', order.id);

        return res.status(201).json({
            success: true,
            message: 'Litige ouvert avec succès, la commande a été gelée.',
            data: dispute
        });
    } catch (error) {
        console.error('Erreur createDispute:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const updateDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { description_update, new_proof_urls } = req.body;
        const user_id = req.user.id; // Customer or Vendor

        const { data: dispute, error: fetchError } = await supabaseAdmin
            .from('disputes')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !dispute) {
            return res.status(404).json({ success: false, message: 'Litige introuvable.' });
        }

        if (dispute.customer_id !== user_id && dispute.vendor_id !== user_id) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        if (dispute.status === 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Ce litige est déjà résolu.' });
        }

        let updatedProofs = dispute.proof_urls || [];
        if (new_proof_urls && Array.isArray(new_proof_urls)) {
            updatedProofs = [...updatedProofs, ...new_proof_urls];
        }

        const updatedDesc = description_update ? dispute.description + '\n\nMAJ: ' + description_update : dispute.description;

        const { data: updatedDispute, error: updateError } = await supabaseAdmin
            .from('disputes')
            .update({ description: updatedDesc, proof_urls: updatedProofs })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
        }

        return res.status(200).json({
            success: true,
            data: updatedDispute
        });
    } catch (error) {
        console.error('Erreur updateDispute:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

export const resolveDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution_decision, refund_amount, action_for_order } = req.body;
        
        // Ensure admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
        }

        // action_for_order = 'REFUNDED' or 'RELEASED'
        
        const { data: dispute, error: fetchError } = await supabaseAdmin
            .from('disputes')
            .update({
                status: 'RESOLVED',
                resolution_decision,
                refund_amount: refund_amount || 0
            })
            .eq('id', id)
            .select()
            .single();

        if (fetchError || !dispute) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la résolution du litige.' });
        }

        // Update the actual order based on admin decision
        if (action_for_order) {
            await supabaseAdmin
                .from('orders')
                .update({ status: action_for_order })
                .eq('id', dispute.order_id);
        }

        return res.status(200).json({
            success: true,
            message: 'Litige résolu avec succès.',
            data: dispute
        });
    } catch (error) {
        console.error('Erreur resolveDispute:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};
