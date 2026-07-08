import { supabaseAdmin, supabase } from '../config/supabase.js';
import {
    calculateVendorPromoPricing,
    getVendorPromoWithProducts,
    isAdminUser,
    isVendorUser,
    listVendorPromosWithStats,
    normalizePromoCode
} from '../services/vendor-promo.service.js';
import { getOrderCustomerId } from '../services/order-workflow.js';

const client = supabaseAdmin || supabase;

function parseNullableNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function toPromoPayload(body, vendorId) {
    return {
        vendor_id: vendorId,
        code: normalizePromoCode(body.code),
        name: String(body.name || '').trim() || null,
        discount_type: body.discount_type,
        discount_value: Number(body.discount_value || 0),
        min_order_amount: Number(body.min_order_amount || 0),
        starts_at: parseNullableDate(body.starts_at),
        ends_at: parseNullableDate(body.ends_at),
        max_uses: parseNullableNumber(body.max_uses),
        max_uses_per_customer: parseNullableNumber(body.max_uses_per_customer),
        is_active: body.is_active !== false,
        scope_type: body.scope_type === 'products' ? 'products' : 'shop',
        updated_at: new Date().toISOString()
    };
}

function validatePromoPayload(payload) {
    if (!payload.code) return 'Le code promo est requis.';
    if (!['percent', 'fixed'].includes(payload.discount_type)) return 'Le type de remise est invalide.';
    if (!Number.isFinite(payload.discount_value) || payload.discount_value <= 0) return 'La valeur de remise est invalide.';
    if (payload.discount_type === 'percent' && payload.discount_value > 100) return 'Le pourcentage ne peut pas dépasser 100.';
    if (payload.min_order_amount !== null && payload.min_order_amount < 0) return 'Le montant minimum est invalide.';
    if (payload.max_uses !== null && payload.max_uses < 0) return 'La limite totale est invalide.';
    if (payload.max_uses_per_customer !== null && payload.max_uses_per_customer < 0) return 'La limite par client est invalide.';
    if (payload.starts_at && payload.ends_at && new Date(payload.starts_at) > new Date(payload.ends_at)) return 'La période du code promo est invalide.';
    return null;
}

async function syncPromoProducts(promoId, productIds = []) {
    await client
        .from('vendor_promo_products')
        .delete()
        .eq('promo_id', promoId);

    if (!Array.isArray(productIds) || productIds.length === 0) return;

    const rows = [...new Set(productIds.filter(Boolean))].map((productId) => ({
        promo_id: promoId,
        product_id: productId
    }));

    const { error } = await client
        .from('vendor_promo_products')
        .insert(rows);

    if (error) throw error;
}

async function assertVendorOwnsProducts(productIds = [], vendorId) {
    if (!Array.isArray(productIds) || productIds.length === 0) return true;

    const uniqueIds = [...new Set(productIds.filter(Boolean))];
    const { data, error } = await client
        .from('products')
        .select('id')
        .eq('user_id', vendorId)
        .in('id', uniqueIds);

    if (error) throw error;
    return (data || []).length === uniqueIds.length;
}

async function assertVendorPromoOwnershipOrFail(promoId, user, res) {
    const promo = await getVendorPromoWithProducts(promoId, client);
    if (!promo) {
        res.status(404).json({ error: 'Code promo introuvable.' });
        return null;
    }

    if (!isAdminUser(user) && promo.vendor_id !== user.id) {
        res.status(403).json({ error: 'Accès refusé à ce code promo.' });
        return null;
    }

    return promo;
}

export const getPromos = async (req, res) => {
    try {
        const { data, error } = await client
            .from('promos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Erreur getPromos:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des promotions.' });
    }
};

export const applyPromo = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code requis.' });

        const { data, error } = await client.rpc('apply_promo_secure', { promo_code: code });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Erreur applyPromo:', err);
        res.status(500).json({ error: err.message || 'Erreur lors de l\'application du code promo.' });
    }
};

export const getVendorPromos = async (req, res) => {
    try {
        if (!isVendorUser(req.user)) {
            return res.status(403).json({ error: 'Seuls les vendeurs peuvent gérer des codes promo.' });
        }

        const payload = await listVendorPromosWithStats(req.user.id, client);
        return res.status(200).json(payload);
    } catch (error) {
        console.error('Erreur getVendorPromos:', error);
        return res.status(500).json({ error: 'Impossible de charger vos codes promo.' });
    }
};

export const createVendorPromo = async (req, res) => {
    try {
        if (!isVendorUser(req.user)) {
            return res.status(403).json({ error: 'Seuls les vendeurs peuvent créer des codes promo.' });
        }

        const payload = toPromoPayload(req.body, req.user.id);
        const validationError = validatePromoPayload(payload);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const productIds = Array.isArray(req.body.product_ids) ? req.body.product_ids : [];
        if (payload.scope_type === 'products' && productIds.length === 0) {
            return res.status(400).json({ error: 'Sélectionnez au moins un produit pour une promo ciblée.' });
        }
        if (!(await assertVendorOwnsProducts(productIds, req.user.id))) {
            return res.status(400).json({ error: 'Un ou plusieurs produits sélectionnés ne vous appartiennent pas.' });
        }

        const { data: promo, error } = await client
            .from('vendor_promos')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;

        await syncPromoProducts(promo.id, payload.scope_type === 'products' ? productIds : []);
        const hydratedPromo = await getVendorPromoWithProducts(promo.id, client);
        return res.status(201).json({ success: true, promo: hydratedPromo });
    } catch (error) {
        console.error('Erreur createVendorPromo:', error);
        return res.status(500).json({ error: error.message || 'Impossible de créer le code promo.' });
    }
};

export const updateVendorPromo = async (req, res) => {
    try {
        const currentPromo = await assertVendorPromoOwnershipOrFail(req.params.id, req.user, res);
        if (!currentPromo) return;

        const payload = toPromoPayload(req.body, currentPromo.vendor_id);
        const validationError = validatePromoPayload(payload);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const productIds = Array.isArray(req.body.product_ids) ? req.body.product_ids : [];
        if (payload.scope_type === 'products' && productIds.length === 0) {
            return res.status(400).json({ error: 'Sélectionnez au moins un produit pour une promo ciblée.' });
        }
        if (!(await assertVendorOwnsProducts(productIds, currentPromo.vendor_id))) {
            return res.status(400).json({ error: 'Un ou plusieurs produits sélectionnés ne vous appartiennent pas.' });
        }

        const { error } = await client
            .from('vendor_promos')
            .update(payload)
            .eq('id', currentPromo.id);

        if (error) throw error;

        await syncPromoProducts(currentPromo.id, payload.scope_type === 'products' ? productIds : []);
        const hydratedPromo = await getVendorPromoWithProducts(currentPromo.id, client);
        return res.status(200).json({ success: true, promo: hydratedPromo });
    } catch (error) {
        console.error('Erreur updateVendorPromo:', error);
        return res.status(500).json({ error: error.message || 'Impossible de modifier le code promo.' });
    }
};

export const toggleVendorPromo = async (req, res) => {
    try {
        const currentPromo = await assertVendorPromoOwnershipOrFail(req.params.id, req.user, res);
        if (!currentPromo) return;

        const nextStatus = req.body?.is_active === undefined
            ? !currentPromo.is_active
            : Boolean(req.body.is_active);

        const { error } = await client
            .from('vendor_promos')
            .update({
                is_active: nextStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentPromo.id);

        if (error) throw error;

        const hydratedPromo = await getVendorPromoWithProducts(currentPromo.id, client);
        return res.status(200).json({ success: true, promo: hydratedPromo });
    } catch (error) {
        console.error('Erreur toggleVendorPromo:', error);
        return res.status(500).json({ error: error.message || 'Impossible de changer le statut du code promo.' });
    }
};

export const deleteVendorPromo = async (req, res) => {
    try {
        const currentPromo = await assertVendorPromoOwnershipOrFail(req.params.id, req.user, res);
        if (!currentPromo) return;

        const { error } = await client
            .from('vendor_promos')
            .delete()
            .eq('id', currentPromo.id);

        if (error) throw error;
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erreur deleteVendorPromo:', error);
        return res.status(500).json({ error: error.message || 'Impossible de supprimer le code promo.' });
    }
};

export const validateVendorPromo = async (req, res) => {
    try {
        const promoCode = normalizePromoCode(req.body?.promo_code || req.body?.code);
        const orderId = String(req.body?.order_id || '').trim();
        const productId = String(req.body?.product_id || '').trim();
        const vendorId = req.body?.vendor_id || null;
        const quantity = Math.max(1, Number(req.body?.quantity || 1));

        if (!promoCode) {
            return res.status(400).json({ error: 'Le code promo est requis.' });
        }

        let order = null;
        let product = null;

        if (orderId) {
            const { data: existingOrder, error } = await client
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (error || !existingOrder) {
                return res.status(404).json({ error: 'Commande introuvable.' });
            }

            if (getOrderCustomerId(existingOrder) !== req.user?.id && !isAdminUser(req.user)) {
                return res.status(403).json({ error: 'Accès refusé à cette commande.' });
            }

            order = existingOrder;
        } else {
            if (!productId || !vendorId) {
                return res.status(400).json({ error: 'order_id ou bien product_id et vendor_id sont requis.' });
            }

            const { data, error } = await client
                .from('products')
                .select('id, price, user_id, is_promo, promo_expires_at, old_price')
                .eq('id', productId)
                .single();

            if (error || !data) {
                return res.status(404).json({ error: 'Produit introuvable.' });
            }
            
            // Apply expiration logic
            if (data.is_promo && data.promo_expires_at && new Date(data.promo_expires_at) < new Date()) {
                data.price = data.old_price || data.price;
                data.is_promo = false;
                data.old_price = null;
            }

            product = data;
        }

        const result = await calculateVendorPromoPricing({
            promoCode,
            order,
            product,
            quantity,
            vendorId,
            customerId: req.user?.id || null,
            dbClient: client
        });

        if (!result.valid) {
            return res.status(400).json({ error: result.message });
        }

        return res.status(200).json({
            success: true,
            promo: result.promo,
            pricing: result.pricing
        });
    } catch (error) {
        console.error('Erreur validateVendorPromo:', error);
        return res.status(500).json({ error: error.message || 'Impossible de valider ce code promo.' });
    }
};
