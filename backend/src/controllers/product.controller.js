import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { flushCache } from '../middlewares/cache.js';
import { auditProductImageNow } from '../services/product-image-watchdog.service.js';

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

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const isAdminUser = (req) => req?.user?.app_metadata?.role === 'admin';

async function getActorRole(user) {
    if (user?.app_metadata?.role === 'admin') return 'admin';
    if (!user?.id) return null;

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (error) throw error;
    return data?.role || null;
}

async function assertSupplierActor(req, res) {
    const role = await getActorRole(req.user);
    if (role === 'supplier') return true;

    return res.status(403).json({
        error: role === 'admin'
            ? 'Un administrateur ne peut pas vendre de produits.'
            : 'Seuls les comptes vendeur peuvent gérer des produits.'
    });
}

const assertProductOwnership = async (req, id) => {
    const { data: product, error } = await supabaseAdmin
        .from('products')
        .select('id, user_id, supplier_email')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;

    if (!product) {
        return {
            ok: false,
            status: 404,
            error: 'Produit non trouvé'
        };
    }

    const requestUserId = req?.user?.id || null;
    const requestUserEmail = normalizeEmail(req?.user?.email);
    const productUserId = product.user_id || null;
    const productEmail = normalizeEmail(product.supplier_email);

    const isOwner = isAdminUser(req)
        || (requestUserId && productUserId && requestUserId === productUserId)
        || (requestUserEmail && productEmail && requestUserEmail === productEmail);

    if (!isOwner) {
        return {
            ok: false,
            status: 403,
            error: 'Accès refusé à ce produit.'
        };
    }

    return { ok: true, product };
};


export const getProducts = async (req, res, next) => {
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
                'supplier_email, user_id, is_new, is_promo, promo_expires_at, pinned, rating, reviews, stock, created_at, custom_exchange_rate, ' +
                'users ( id, name, company_name, avatar, shop_slug )',
                { count: 'estimated' }
            )
            .eq('is_archived', false)
            .gt('stock', 0)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (category) {
            query = query.eq('category', category);
        }

        const { data, error, count } = await query;

        if (error) throw error;
        
        const now = new Date();
        const processedData = data?.map(product => {
            if (product.is_promo && product.promo_expires_at && new Date(product.promo_expires_at) < now) {
                return { 
                    ...product, 
                    price: product.old_price || product.price,
                    is_promo: false, 
                    old_price: null 
                };
            }
            return product;
        }) || [];

        res.json({ data: processedData, count, page });
    } catch (err) {
        console.error('❌ getProducts error:', err);
        next(err);
    }
};

export const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const supabase = getScopedClient(req);

        const { data, error } = await supabase
            .from('products')
            .select(
                'id, name, price, old_price, image, category, description, ' +
                'supplier_email, user_id, is_new, is_promo, promo_expires_at, pinned, rating, reviews, stock, created_at, custom_exchange_rate, ' +
                'users ( id, name, company_name, avatar, shop_slug )'
            )
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Produit non trouvé' });

        const now = new Date();
        if (data.is_promo && data.promo_expires_at && new Date(data.promo_expires_at) < now) {
            data.price = data.old_price || data.price;
            data.is_promo = false;
            data.old_price = null;
        }

        res.json(data);
    } catch (err) {
        console.error('❌ getProductById error:', err);
        next(err);
    }
};

export const createProduct = async (req, res, next) => {
    try {
        if (!await assertSupplierActor(req, res)) return;

        // SÉCURITÉ KYC : Vérifier si le vendeur est approuvé avant de le laisser publier
        const { data: vendorInfo } = await supabaseAdmin
            .from('users')
            .select('business_verification_status')
            .eq('id', req.user.id)
            .single();

        if (vendorInfo?.business_verification_status !== 'approved') {
            return res.status(403).json({
                error: 'Votre compte vendeur doit être approuvé (documents vérifiés) pour publier des produits.'
            });
        }

        // SÉCURITÉ : Ne récupérer que les champs autorisés (Sanitization)
        const allowedFields = [
            'name', 'price', 'old_price', 'image', 'category', 
            'description', 'is_new', 'is_promo', 'promo_expires_at', 'pinned', 'stock', 'custom_exchange_rate', 'escrow_timer_hours'
        ];
        
        const productData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                productData[field] = req.body[field];
            }
        }
        
        // Génération d'un UUID côté serveur pour garantir la non-nullité de `id`
        // même si la colonne n'a pas de DEFAULT dans la DB (défense en profondeur).
        productData.id = randomUUID();

        // On s'assure d'assigner l'ID de l'utilisateur authentifié
        productData.user_id = req.user.id;
        // On force l'émail fournisseur s'il est dispo, sinon on va le chercher dans la table users
        if (req.user.email) {
            productData.supplier_email = req.user.email;
        } else {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('email')
                .eq('id', req.user.id)
                .single();
            if (userData && userData.email) {
                productData.supplier_email = userData.email;
            }
        }

        // ─── Vérification : le vendeur a-t-il un compte de réception ? ───
        const { count: payoutCount, error: payoutCheckError } = await supabaseAdmin
            .from('vendor_payout_methods')
            .select('id', { count: 'exact', head: true })
            .eq('vendor_id', req.user.id);

        if (!payoutCheckError && (payoutCount === 0 || payoutCount === null)) {
            return res.status(403).json({
                error: 'Compte de réception manquant',
                message: 'Veuillez configurer votre compte de réception (Mobile Money) dans vos paramètres de paiement avant de publier un produit.'
            });
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

        void auditProductImageNow(data).catch((watchError) => {
            console.warn('[ProductImageWatchdog] Immediate audit failed after create:', watchError.message);
        });

        // 🧠 Google Lens : Génération du vecteur d'image en arrière-plan
        void (async () => {
            try {
                if (!data.image) return;
                const { default: embeddingService } = await import('../services/embedding.service.js');
                // Extraire la première image valide (gère les galeries)
                const imageUrl = data.image.split(',')[0].split('||').pop().trim();
                const embedding = await embeddingService.generateImageEmbedding(imageUrl);
                if (embedding) {
                    const { error: vectorError } = await supabaseAdmin
                        .from('products')
                        .update({ image_embedding: embedding })
                        .eq('id', data.id);
                    if (vectorError) console.error('[GoogleLens] Erreur update DB:', vectorError);
                    else console.log(`[GoogleLens] Vecteur généré et sauvegardé pour le produit ${data.id}`);
                }
            } catch (e) {
                console.error('[GoogleLens] Erreur asynchrone:', e.message);
            }
        })();

        res.status(201).json(data);
    } catch (err) {
        console.error('❌ createProduct error:', err);
        next(err);
    }
};

export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!await assertSupplierActor(req, res)) return;
        
        // SÉCURITÉ : Ne récupérer que les champs autorisés (Sanitization)
        const allowedFields = [
            'name', 'price', 'old_price', 'image', 'category', 
            'description', 'is_new', 'is_promo', 'promo_expires_at', 'pinned', 'stock', 'custom_exchange_rate', 'escrow_timer_hours', 'is_archived'
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

        const ownership = await assertProductOwnership(req, id);
        if (!ownership.ok) {
            return res.status(ownership.status).json({ error: ownership.error });
        }

        const { data, error } = await supabaseAdmin
            .from('products')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Invalider le cache après mise à jour
        flushCache('/api/products');

        void auditProductImageNow(data).catch((watchError) => {
            console.warn('[ProductImageWatchdog] Immediate audit failed after update:', watchError.message);
        });

        // 🧠 Google Lens : Mise à jour du vecteur si l'image a changé
        if (updateData.image) {
            void (async () => {
                try {
                    const { default: embeddingService } = await import('../services/embedding.service.js');
                    const imageUrl = data.image.split(',')[0].split('||').pop().trim();
                    const embedding = await embeddingService.generateImageEmbedding(imageUrl);
                    if (embedding) {
                        const { error: vectorError } = await supabaseAdmin
                            .from('products')
                            .update({ image_embedding: embedding })
                            .eq('id', data.id);
                        if (vectorError) console.error('[GoogleLens] Erreur update DB:', vectorError);
                        else console.log(`[GoogleLens] Vecteur mis à jour pour le produit ${data.id}`);
                    }
                } catch (e) {
                    console.error('[GoogleLens] Erreur asynchrone update:', e.message);
                }
            })();
        }

        res.json(data);
    } catch (err) {
        console.error('❌ updateProduct error:', err);
        next(err);
    }
};

export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!await assertSupplierActor(req, res)) return;
        const ownership = await assertProductOwnership(req, id);
        if (!ownership.ok) {
            return res.status(ownership.status).json({ error: ownership.error });
        }

        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Invalider le cache après suppression
        flushCache('/api/products');

        res.json({ success: true, message: 'Produit supprimé avec succès' });
    } catch (err) {
        console.error('❌ deleteProduct error:', err);
        next(err);
    }
};

export const archiveProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!await assertSupplierActor(req, res)) return;
        const ownership = await assertProductOwnership(req, id);
        if (!ownership.ok) {
            return res.status(ownership.status).json({ error: ownership.error });
        }

        const { error } = await supabaseAdmin
            .from('products')
            .update({ is_archived: true })
            .eq('id', id);

        if (error) throw error;

        flushCache('/api/products');
        res.json({ success: true, message: 'Produit archivé avec succès' });
    } catch (err) {
        console.error('❌ archiveProduct error:', err);
        next(err);
    }
};

export const restoreProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!await assertSupplierActor(req, res)) return;
        const ownership = await assertProductOwnership(req, id);
        if (!ownership.ok) {
            return res.status(ownership.status).json({ error: ownership.error });
        }

        const { error } = await supabaseAdmin
            .from('products')
            .update({ is_archived: false })
            .eq('id', id);

        if (error) throw error;

        flushCache('/api/products');
        res.json({ success: true, message: 'Produit restauré avec succès' });
    } catch (err) {
        console.error('❌ restoreProduct error:', err);
        next(err);
    }
};

export const getVendorArchivedProducts = async (req, res, next) => {
    try {
        if (!await assertSupplierActor(req, res)) return;
        const userId = req.user.id;
        const userEmail = normalizeEmail(req.user.email);

        const supabase = getScopedClient(req);

        let byEmail = [];
        if (userEmail) {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, price, old_price, image, category, stock, created_at, is_archived, supplier_email, user_id')
                .eq('supplier_email', userEmail)
                .eq('is_archived', true)
                .order('created_at', { ascending: false });
            if (error) throw error;
            byEmail = data || [];
        }

        let byUser = [];
        if (userId) {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, price, old_price, image, category, stock, created_at, is_archived, supplier_email, user_id')
                .eq('user_id', userId)
                .eq('is_archived', true)
                .order('created_at', { ascending: false });
            if (error) throw error;
            byUser = data || [];
        }

        // Deduplicate
        const seen = new Set();
        const allArchived = [...byEmail, ...byUser].filter(p => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
        });

        res.json({ data: allArchived, count: allArchived.length });
    } catch (err) {
        console.error('❌ getVendorArchivedProducts error:', err);
        next(err);
    }
};

export const deleteBulkProducts = async (req, res, next) => {
    try {
        if (!await assertSupplierActor(req, res)) return;
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
        next(err);
    }
};

export const updateBulkCategory = async (req, res, next) => {
    try {
        if (!await assertSupplierActor(req, res)) return;
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
        next(err);
    }
};

export const getRankedCategories = async (req, res, next) => {
    try {
        const supabase = getScopedClient(req);
        
        // Try to fetch from the view created by the migration
        let { data, error } = await supabase
            .from('ranked_categories')
            .select('*')
            .limit(8);
            
        if (error || !data || data.length === 0) {
            // Fallback if view doesn't exist yet or is empty: get distinct categories directly
            if (error) console.warn('⚠️ ranked_categories view error, falling back to products query', error);
            else console.info('ℹ️ ranked_categories view is empty, falling back to products query');

            const { data: rawData, error: rawError } = await supabase
                .from('products')
                .select('category')
                .not('category', 'is', null)
                .neq('category', '');
                
            if (rawError) throw rawError;
            
            // In-memory grouping as fallback
            const counts = {};
            (rawData || []).forEach(p => {
                if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
            });
            
            data = Object.keys(counts)
                .map(c => ({ category: c, product_count: counts[c], total_views: 0 }))
                .sort((a, b) => b.product_count - a.product_count)
                .slice(0, 8);
        }

        res.json({ success: true, categories: data || [] });
    } catch (err) {
        console.error('❌ getRankedCategories error:', err);
        next(err);
    }
};

// ============================================================================
// 🧠 GOOGLE LENS : RECHERCHE PAR IMAGE
// ============================================================================
export const searchByImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucune image fournie pour la recherche.' });
        }

        // 1. L'image de recherche a été uploadée temporairement via le middleware
        const searchImageUrl = req.file.path;
        const cloudinaryId = req.file.filename; // Pour le nettoyage

        // 2. L'IA analyse l'image et génère son vecteur (signature mathématique)
        const { default: embeddingService } = await import('../services/embedding.service.js');
        const queryEmbedding = await embeddingService.generateImageEmbedding(searchImageUrl);

        if (!queryEmbedding) {
            return res.status(500).json({ error: 'Échec de l\'analyse de l\'image.' });
        }

        // 3. Interroger Supabase avec notre fonction RPC pour trouver les produits similaires
        const supabase = getScopedClient(req);
        const { data: matchedProducts, error } = await supabase.rpc('search_products_by_image', {
            query_embedding: queryEmbedding,
            match_threshold: 0.65, // Ajustable : 65% de similarité minimum
            match_count: 20 // Retourne les 20 meilleurs résultats max
        });

        if (error) throw error;

        // 4. Nettoyage : On supprime l'image de recherche de Cloudinary (tâche de fond)
        // Pas besoin d'attendre que ce soit fini pour répondre à l'utilisateur
        void (async () => {
            try {
                const { v2: cloudinary } = await import('cloudinary');
                await cloudinary.uploader.destroy(cloudinaryId);
            } catch (e) {
                console.error('[GoogleLens] Erreur nettoyage image de recherche:', e.message);
            }
        })();

        // 5. Renvoyer les produits trouvés !
        res.json({ data: matchedProducts || [], count: matchedProducts?.length || 0 });

    } catch (err) {
        console.error('❌ searchByImage error:', err);
        next(err);
    }
};

