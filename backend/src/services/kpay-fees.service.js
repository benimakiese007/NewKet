/**
 * kpay-fees.service.js
 * ─────────────────────────────────────────────────────────────
 * Service centralisé pour la gestion des frais KPay par opérateur.
 *
 * LOGIQUE OPTION A :
 *   - Frais payin  → supportés par le CLIENT (ajoutés au prix affiché)
 *   - Frais payout → supportés par le VENDEUR (déduits du payout)
 *   - Commission NewKet → 100% nette, indépendante des frais KPay
 *
 * Devises supportées : CDF, USD
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Récupère les frais d'un opérateur précis depuis la table kpay_operator_fees.
 *
 * @param {Object} client      - Client Supabase
 * @param {string} currency    - 'CDF' ou 'USD'
 * @param {string} operator    - ex: 'vodacom_mpesa', 'airtel', 'orange', 'kpay_default'
 * @returns {Promise<{payin_rate: number, payout_rate: number, label: string}|null>}
 */
export async function getOperatorFees(client, currency, operator) {
    if (!currency || !operator) return null;

    const { data, error } = await client
        .from('kpay_operator_fees')
        .select('payin_rate, payout_rate, label')
        .eq('currency', String(currency).toUpperCase())
        .eq('operator', String(operator).toLowerCase())
        .eq('is_active', true)
        .single();

    if (error || !data) return null;

    return {
        payin_rate:  parseFloat(data.payin_rate)  || 0,
        payout_rate: parseFloat(data.payout_rate) || 0,
        label:       data.label || operator
    };
}

/**
 * Récupère le taux payin maximum pour une devise donnée.
 * Utilisé au checkout quand l'opérateur du client est inconnu.
 * On prend le pire cas pour ne jamais absorber de perte.
 *
 * @param {Object} client   - Client Supabase
 * @param {string} currency - 'CDF' ou 'USD'
 * @returns {Promise<{rate: number, operator: string}>}
 */
export async function getMaxPayinRate(client, currency) {
    const curr = String(currency || 'USD').toUpperCase();

    const { data, error } = await client
        .from('kpay_operator_fees')
        .select('operator, payin_rate')
        .eq('currency', curr)
        .eq('is_active', true)
        .order('payin_rate', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        // Fallback sécurisé : 4% CDF et USD (taux KPay réel)
        return { rate: 4.0, operator: 'unknown' };
    }

    return {
        rate:     parseFloat(data.payin_rate) || 0,
        operator: data.operator
    };
}

/**
 * Calcule le montant total à facturer au client (prix produit + frais payin).
 *
 * @param {number} baseAmount  - Prix produit (ex: 100 000 CDF)
 * @param {number} payinRate   - Taux payin en % (ex: 4.0)
 * @returns {{ baseAmount: number, payinFeeAmount: number, clientTotal: number }}
 */
export function computeClientTotal(baseAmount, payinRate) {
    const base         = parseFloat(baseAmount) || 0;
    const rate         = parseFloat(payinRate)  || 0;
    const payinFeeAmount = Math.round(base * rate) / 100;
    const clientTotal    = Math.round((base + payinFeeAmount) * 100) / 100;

    return { baseAmount: base, payinFeeAmount, clientTotal };
}

/**
 * Calcule le payout net versé au vendeur.
 *
 *   payout_brut    = baseAmount - commission NewKet
 *   payout_fee     = payout_brut × payout_rate  (frais KPay sur le transfert)
 *   vendor_payout  = payout_brut - payout_fee
 *
 * Note : on calcule les frais payout sur le payout_brut (et non sur baseAmount)
 * pour correspondre à ce que KPay prélève réellement sur le montant transféré.
 *
 * @param {number} baseAmount      - Prix produit (total_amount de la commande)
 * @param {number} commissionRate  - Taux commission NewKet en % (ex: 5.0)
 * @param {number} payoutRate      - Taux payout KPay en % (ex: 4.0)
 * @returns {{
 *   baseAmount: number,
 *   commissionAmount: number,
 *   payoutGross: number,
 *   payoutFeeAmount: number,
 *   vendorPayout: number
 * }}
 */
export function computeVendorPayout(baseAmount, commissionRate, payoutRate) {
    const base             = parseFloat(baseAmount)     || 0;
    const commRate         = parseFloat(commissionRate) || 0;
    const payRate          = parseFloat(payoutRate)     || 0;

    const commissionAmount = Math.round(base * commRate) / 100;
    const payoutGross      = Math.round((base - commissionAmount) * 100) / 100;
    const payoutFeeAmount  = Math.round(payoutGross * payRate) / 100;
    const vendorPayout     = Math.round((payoutGross - payoutFeeAmount) * 100) / 100;

    return {
        baseAmount,
        commissionAmount,
        payoutGross,
        payoutFeeAmount,
        vendorPayout
    };
}

/**
 * Récupère tous les opérateurs actifs pour une devise donnée.
 * Utilisé pour afficher la liste au frontend (sélection opérateur au checkout/payout).
 *
 * @param {Object} client   - Client Supabase
 * @param {string} currency - 'CDF' ou 'USD', ou null pour tous
 * @returns {Promise<Array>}
 */
export async function listActiveOperators(client, currency = null) {
    let query = client
        .from('kpay_operator_fees')
        .select('currency, operator, label, payin_rate, payout_rate')
        .eq('is_active', true)
        .order('currency')
        .order('payin_rate');

    if (currency) {
        query = query.eq('currency', String(currency).toUpperCase());
    }

    const { data, error } = await query;
    if (error) return [];
    return data || [];
}
