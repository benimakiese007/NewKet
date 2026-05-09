import { createClient } from '@supabase/supabase-js';
import { flushCache } from '../middlewares/cache.js';

// ─── Singleton Supabase client ─────────────────────────────────────────────
// On réutilise une seule instance pour éviter la fuite de connexions WebSocket
// internes à chaque requête sous charge. On mute uniquement le header Authorization.
const _publicClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

/**
 * Retourne le client Supabase approprié selon le contexte de la requête.
 * - Si req.token est présent : client avec JWT de l'utilisateur (RLS respecté)
 * - Sinon : client public anonyme
 * 
 * IMPORTANT: On crée un client scopé uniquement lorsque le token existe,
 * afin que les politiques RLS de Supabase soient correctement appliquées.
 * Le client public est un singleton réutilisé pour toutes les req non authentifiées.
 */
const getScopedClient = (req) => {
    if (req.token) {
        // Création d'un client léger avec le JWT de l'utilisateur pour RLS.
        // Note: On ne peut pas muter le singleton public car cela créerait une
        // race condition entre requêtes parallèles. On instancie uniquement
        // pour les requêtes authentifiées (moins fréquentes que les GET publics).
        return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            auth: { persistSession: false }, // Pas de gestion de session côté serveur
            global: {
                headers: { Authorization: `Bearer ${req.token}` }
            }
        });
    }
    return _publicClient; // Singleton réutilisé pour toutes les requêtes publiques
};


export const getProducts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(60, parseInt(req.query.limit, 10) || 20));
        const category = req.query.category;
        const offset = (page - 1) * limit;

        const supabase = getScopedClient(req);
        
        // ✅ OPTIMISATION: Sélection de colonnes précises (au lieu de *)
        //    + count: 'estimated' (rapide via stats PostgreSQL, pas un COUNT(*))
        let query = supabase
            .from('products')
            .select(
                'id, name, price, old_price, image, category, description, ' +
                'supplier_email, user_id, is_new, is_promo, pinned, rating, reviews, stock, created_at, custom_exchange_rate',
                { count: 'estimated' }
            )
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({ data, count, page });
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
                'supplier_email, user_id, is_new, is_promo, pinned, rating, reviews, stock, created_at, custom_exchange_rate'
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
        // SÉCURITÉ : Ne récupérer que les champs autorisés (Sanitization)
        const allowedFields = [
            'name', 'price', 'old_price', 'image', 'category', 
            'description', 'is_new', 'is_promo', 'pinned', 'stock', 'custom_exchange_rate'
        ];
        
        const productData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                productData[field] = req.body[field];
            }
        }
        
        // On s'assure d'assigner l'ID de l'utilisateur authentifié
        productData.user_id = req.user.id;
        // On force l'émail fournisseur s'il est dispo
        if (req.user.email) {
            productData.supplier_email = req.user.email;
        }

        const supabase = getScopedClient(req);
        const { data, error } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();

        if (error) throw error;

        // Invalider le cache après création
        flushCache('/api/products');

        res.status(201).json(data);
    } catch (err) {
        console.error('❌ createProduct error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        
        // SÉCURITÉ : Ne récupérer que les champs autorisés (Sanitization)
        const allowedFields = [
            'name', 'price', 'old_price', 'image', 'category', 
            'description', 'is_new', 'is_promo', 'pinned', 'stock', 'custom_exchange_rate'
        ];
        
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Aucune donnée valide à mettre à jour.' });
        }

        const supabase = getScopedClient(req);

        // La logique RLS de Supabase empêchera la mise à jour si ce n'est pas le propriétaire
        const { data, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Invalider le cache après mise à jour
        flushCache('/api/products');

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

        // Invalider le cache après suppression
        flushCache('/api/products');

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

        // Invalider le cache après suppression groupée
        flushCache('/api/products');

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

        // Invalider le cache après mise à jour groupée
        flushCache('/api/products');

        res.json({ success: true, count: ids.length });
    } catch (err) {
        console.error('❌ updateBulkCategory error:', err);
        res.status(500).json({ error: err.message });
    }
};
