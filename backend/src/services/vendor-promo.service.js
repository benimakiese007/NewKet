import { supabaseAdmin, supabase } from '../config/supabase.js';

const client = supabaseAdmin || supabase;

export function normalizePromoCode(code) {
    return String(code || '').trim().toUpperCase();
}

export function isVendorUser(user) {
    const role = user?.app_metadata?.role || user?.user_metadata?.role || '';
    return role === 'supplier' || role === 'admin';
}

export function isAdminUser(user) {
    const role = user?.app_metadata?.role || user?.user_metadata?.role || '';
    return role === 'admin';
}

export async function fetchVendorPromoProductIds(promoIds = [], dbClient = client) {
    if (!Array.isArray(promoIds) || promoIds.length === 0) {
        return new Map();
    }

    const { data, error } = await dbClient
        .from('vendor_promo_products')
        .select('promo_id, product_id')
        .in('promo_id', promoIds);

    if (error) throw error;

    const map = new Map();
    for (const row of data || []) {
        if (!map.has(row.promo_id)) {
            map.set(row.promo_id, []);
        }
        map.get(row.promo_id).push(row.product_id);
    }
    return map;
}

export async function getVendorPromoWithProducts(promoId, dbClient = client) {
    const { data: promo, error } = await dbClient
        .from('vendor_promos')
        .select('*')
        .eq('id', promoId)
        .maybeSingle();

    if (error) throw error;
    if (!promo) return null;

    const productIdsMap = await fetchVendorPromoProductIds([promo.id], dbClient);
    return {
        ...promo,
        product_ids: productIdsMap.get(promo.id) || []
    };
}

export async function listVendorPromosWithStats(vendorId, dbClient = client) {
    const { data: promos, error } = await dbClient
        .from('vendor_promos')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    const promoIds = (promos || []).map((promo) => promo.id);
    const productIdsMap = await fetchVendorPromoProductIds(promoIds, dbClient);

    let usageRows = [];
    if (promoIds.length > 0) {
        const { data, error: usageError } = await dbClient
            .from('vendor_promo_usages')
            .select('promo_id, discount_amount')
            .in('promo_id', promoIds);

        if (usageError) throw usageError;
        usageRows = data || [];
    }

    const usageTotals = new Map();
    for (const row of usageRows) {
        if (!usageTotals.has(row.promo_id)) {
            usageTotals.set(row.promo_id, { usage_count: 0, total_discount_amount: 0 });
        }
        const current = usageTotals.get(row.promo_id);
        current.usage_count += 1;
        current.total_discount_amount += Number(row.discount_amount || 0);
    }

    const hydratedPromos = (promos || []).map((promo) => ({
        ...promo,
        product_ids: productIdsMap.get(promo.id) || [],
        usage_count: usageTotals.get(promo.id)?.usage_count || 0,
        total_discount_amount: usageTotals.get(promo.id)?.total_discount_amount || 0
    }));

    const stats = hydratedPromos.reduce((acc, promo) => {
        acc.total += 1;
        if (promo.is_active) acc.active += 1;
        acc.usage_count += Number(promo.usage_count || 0);
        acc.total_discount_amount += Number(promo.total_discount_amount || 0);
        return acc;
    }, {
        total: 0,
        active: 0,
        usage_count: 0,
        total_discount_amount: 0
    });

    return { promos: hydratedPromos, stats };
}

export async function calculateVendorPromoPricing({
    promoCode,
    order = null,
    product = null,
    quantity = 1,
    vendorId = null,
    customerId = null,
    dbClient = client
}) {
    const normalizedCode = normalizePromoCode(promoCode);
    const subtotalAmount = Number(
        order?.merchandise_amount
        ?? order?.subtotal_amount
        ?? (product ? Number(product.price || 0) * Number(quantity || 1) : 0)
    );
    const deliveryFeeAmount = Number(order?.delivery_fee_amount || 0);
    const resolvedVendorId = order?.vendor_id || product?.user_id || vendorId || null;
    const productIds = Array.isArray(order?.items)
        ? order.items.map((item) => item?.product_id).filter(Boolean)
        : (product?.id ? [product.id] : []);

    if (!normalizedCode) {
        return {
            valid: true,
            promo: null,
            pricing: {
                subtotal_amount: subtotalAmount,
                delivery_fee_amount: deliveryFeeAmount,
                promo_discount_amount: 0,
                total_amount: subtotalAmount + deliveryFeeAmount
            }
        };
    }

    if (!resolvedVendorId) {
        return { valid: false, message: 'Boutique introuvable pour ce code promo.' };
    }

    const { data: promo, error } = await dbClient
        .from('vendor_promos')
        .select('*')
        .eq('vendor_id', resolvedVendorId)
        .eq('code', normalizedCode)
        .maybeSingle();

    if (error) throw error;

    if (!promo) {
        return { valid: false, message: 'Ce code promo est introuvable pour cette boutique.' };
    }

    if (!promo.is_active) {
        return { valid: false, message: 'Ce code promo est désactivé.' };
    }

    const now = new Date();
    
    // Allow a margin to avoid strict timezone issues (comparing dates)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (promo.starts_at && new Date(promo.starts_at) > todayEnd) {
        return { valid: false, message: 'Ce code promo n’est pas encore actif.' };
    }

    if (promo.ends_at && new Date(promo.ends_at) < todayStart) {
        return { valid: false, message: 'Ce code promo a expiré.' };
    }

    if (promo.max_uses !== null && Number(promo.current_uses || 0) >= Number(promo.max_uses)) {
        return { valid: false, message: 'Ce code promo a atteint sa limite totale d’utilisation.' };
    }

    if (subtotalAmount < Number(promo.min_order_amount || 0)) {
        return {
            valid: false,
            message: `Le montant minimum pour ce code promo est de ${Number(promo.min_order_amount || 0)}.`
        };
    }

    if (promo.scope_type === 'products') {
        const { data: scopedRows, error: scopedError } = await dbClient
            .from('vendor_promo_products')
            .select('product_id')
            .eq('promo_id', promo.id);

        if (scopedError) throw scopedError;

        const scopedProductIds = (scopedRows || []).map((row) => row.product_id);
        const appliesToAnyProduct = productIds.some((productId) => scopedProductIds.includes(productId));
        if (!appliesToAnyProduct) {
            return { valid: false, message: 'Ce code promo ne s’applique pas à ce produit.' };
        }
    }

    if (customerId && promo.max_uses_per_customer !== null) {
        const { count, error: countError } = await dbClient
            .from('vendor_promo_usages')
            .select('id', { count: 'exact', head: true })
            .eq('promo_id', promo.id)
            .eq('customer_id', customerId);

        if (countError) throw countError;

        if (Number(count || 0) >= Number(promo.max_uses_per_customer)) {
            return { valid: false, message: 'Vous avez déjà atteint la limite d’utilisation pour ce code promo.' };
        }
    }

    let discountAmount = 0;
    if (promo.discount_type === 'percent') {
        discountAmount = subtotalAmount * (Number(promo.discount_value || 0) / 100);
    } else {
        discountAmount = Number(promo.discount_value || 0);
    }

    discountAmount = Math.max(0, Math.min(subtotalAmount, Number(discountAmount.toFixed(2))));
    const totalAmount = Math.max(0, Number((subtotalAmount + deliveryFeeAmount - discountAmount).toFixed(2)));

    return {
        valid: true,
        promo: {
            id: promo.id,
            code: promo.code,
            name: promo.name,
            discount_type: promo.discount_type,
            discount_value: Number(promo.discount_value || 0),
            scope_type: promo.scope_type
        },
        pricing: {
            subtotal_amount: subtotalAmount,
            delivery_fee_amount: deliveryFeeAmount,
            promo_discount_amount: discountAmount,
            total_amount: totalAmount
        }
    };
}

export async function recordVendorPromoUsage({
    promoId,
    orderId,
    customerId,
    discountAmount,
    dbClient = client
}) {
    if (!promoId || !orderId || !discountAmount) return;

    const { data: existingUsage, error: existingUsageError } = await dbClient
        .from('vendor_promo_usages')
        .select('id')
        .eq('promo_id', promoId)
        .eq('order_id', orderId)
        .maybeSingle();

    if (existingUsageError) throw existingUsageError;
    if (existingUsage?.id) return;

    const { error: usageError } = await dbClient
        .from('vendor_promo_usages')
        .insert({
            promo_id: promoId,
            order_id: orderId,
            customer_id: customerId || null,
            discount_amount: Number(discountAmount || 0)
        });

    if (usageError) throw usageError;

    const { error: updateError } = await dbClient.rpc('increment_vendor_promo_usage', {
        target_promo_id: promoId
    });

    if (updateError) throw updateError;
}
