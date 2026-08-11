/**
 * Service de calcul des frais FlexPay et des commissions
 */

export const getOperatorFees = async (client, currency, payoutOperator) => {
    // FIXME: Mettre en place la vraie requête sur la table des frais
    return {
        payout_rate: 0.02 // Exemple: 2%
    };
};

export const getMaxPayinRate = async (client, currency) => {
    // FIXME: Mettre en place la vraie logique
    return { 
        rate: 0.05 // Exemple: 5% max
    };
};

export const computeVendorPayout = (totalAmount, commissionRate, payoutFeeRate) => {
    const commissionAmount = totalAmount * commissionRate;
    const payoutFeeAmount = totalAmount * payoutFeeRate;
    const vendorPayout = totalAmount - commissionAmount - payoutFeeAmount;
    
    return {
        commissionAmount,
        payoutFeeAmount,
        vendorPayout
    };
};
