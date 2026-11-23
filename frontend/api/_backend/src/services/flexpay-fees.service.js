/**
 * Service de calcul des frais FlexPay et des commissions
 */

export const getOperatorFees = async (client, currency, payoutOperator) => {
    try {
        const { data } = await client
            .from('kpay_operator_fees')
            .select('payout_rate, payin_rate')
            .eq('currency', currency)
            .eq('operator', payoutOperator)
            .eq('is_active', true)
            .single();
        
        if (data) {
            return {
                payout_rate: parseFloat(data.payout_rate) / 100,
                payin_rate: parseFloat(data.payin_rate) / 100
            };
        }
    } catch (e) {
        console.error('Error fetching operator fees:', e.message);
    }
    
    // Fallback if not found
    return {
        payout_rate: 0.02,
        payin_rate: 0.025
    };
};

export const getMaxPayinRate = async (client, currency) => {
    try {
        const { data } = await client
            .from('kpay_operator_fees')
            .select('payin_rate')
            .eq('currency', currency)
            .eq('is_active', true)
            .order('payin_rate', { ascending: false })
            .limit(1)
            .single();
            
        if (data) {
            return {
                rate: parseFloat(data.payin_rate) / 100
            };
        }
    } catch (e) {
        console.error('Error fetching max payin rate:', e.message);
    }
    
    // Fallback if not found
    return { 
        rate: 0.025
    };
};

export const computeVendorPayout = (totalAmount, commissionRate, payoutFeeRate) => {
    // Arrondir à 2 décimales
    const commissionAmount = Math.round(totalAmount * commissionRate * 100) / 100;
    const payoutFeeAmount = Math.round(totalAmount * payoutFeeRate * 100) / 100;
    const vendorPayout = Math.round((totalAmount - commissionAmount - payoutFeeAmount) * 100) / 100;
    
    return {
        commissionAmount,
        payoutFeeAmount,
        vendorPayout
    };
};
