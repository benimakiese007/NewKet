import { createClient } from '@supabase/supabase-js';

// Fonction utilitaire pour créer un client Supabase avec le contexte de l'utilisateur courant
const getScopedClient = (req) => {
    // Si la requête est authentifiée, on crée un client qui embarque son JWT 
    // pour que les politiques RLS (Row Level Security) de Supabase soient respectées.
    if (req.token) {
        return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: `Bearer ${req.token}`
                }
            }
        });
    }
    // Sinon on retourne un client public
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
};

export const getProducts = async (req, res) => {
    try {
        const { page = 1, limit = 20, category } = req.query;
        const offset = (page - 1) * limit;

        const supabase = getScopedClient(req);
        
        // ✅ OPTIMISATION: Sélection de colonnes précises (au lieu de *)
        //    + count: 'estimated' (rapide via stats PostgreSQL, pas un COUNT(*))
        let query = supabase
            .from('products')
            .select(
                'id, name, price, old_price, image, category, description, ' +
                'supplier_email, user_id, is_new, is_promo, stock, ' +
                'whatsapp, phone, city, created_at',
                { count: 'estimated' }
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({ data, count, page: parseInt(page) });
    } catch (err) {
        console.error('❌ getProducts error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getScopedClient(req);

        const { data, error } = await supabase
            .from('products')
            .select(
                'id, name, price, old_price, image, category, description, ' +
                'supplier_email, user_id, is_new, is_promo, stock, ' +
                'whatsapp, phone, city, created_at'
            )
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Produit non trouvé' });

        res.json(data);
    } catch (err) {
        console.error('❌ getProductById error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const createProduct = async (req, res) => {
    try {
        const productData = req.body;
        // On s'assure d'assigner l'ID de l'utilisateur authentifié
        productData.user_id = req.user.id;

        const supabase = getScopedClient(req);
        const { data, error } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (err) {
        console.error('❌ createProduct error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const supabase = getScopedClient(req);

        // La logique RLS de Supabase empêchera la mise à jour si ce n'est pas le propriétaire
        const { data, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error('❌ updateProduct error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getScopedClient(req);

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Produit supprimé avec succès' });
    } catch (err) {
        console.error('❌ deleteProduct error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const deleteBulkProducts = async (req, res) => {
    try {
        const { ids } = req.body; // Array of IDs
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'IDs invalides' });
        }

        const supabase = getScopedClient(req);
        
        const { error } = await supabase
            .from('products')
            .delete()
            .in('id', ids);

        if (error) throw error;

        res.json({ success: true, count: ids.length });
    } catch (err) {
        console.error('❌ deleteBulkProducts error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const updateBulkCategory = async (req, res) => {
    try {
        const { ids, category } = req.body;
        if (!ids || !Array.isArray(ids) || !category) {
            return res.status(400).json({ error: 'Paramètres invalides' });
        }

        const supabase = getScopedClient(req);
        
        const { error } = await supabase
            .from('products')
            .update({ category })
            .in('id', ids);

        if (error) throw error;

        res.json({ success: true, count: ids.length });
    } catch (err) {
        console.error('❌ updateBulkCategory error:', err);
        res.status(500).json({ error: err.message });
    }
};
