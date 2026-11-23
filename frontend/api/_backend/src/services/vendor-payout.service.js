import { supabaseAdmin } from '../config/supabase.js';
import EmailService from './emailService.js';

/**
 * Génère un code OTP aléatoire à 6 chiffres
 */
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Demande un OTP pour une action sensible (ex: ajouter un compte de paiement)
 */
export const requestPayoutOtp = async (userId, userEmail, action = 'ADD_PAYOUT_METHOD') => {
    // ─── Rate Limit : max 3 OTPs par heure ───
    const oneHourAgo = new Date(Date.now() - 60 * 60000).toISOString();
    const { count, error: countError } = await supabaseAdmin
        .from('otp_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo);

    if (!countError && count >= 3) {
        throw new Error('Trop de demandes de code. Réessayez dans 1 heure.');
    }

    const otpCode = generateOtp();
    // Expiration dans 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    const { error } = await supabaseAdmin
        .from('otp_verifications')
        .insert({
            user_id: userId,
            action,
            otp_code: otpCode,
            expires_at: expiresAt,
            is_used: false
        });

    if (error) {
        console.error('Erreur lors de la génération OTP:', error);
        throw new Error('Impossible de générer l\'OTP');
    }

    // Envoi par email via EmailService existant
    const result = await EmailService.sendMail({
        to: userEmail,
        subject: '🔒 Code de sécurité - NewKet',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1a1a2e; margin-bottom: 8px;">Code de sécurité NewKet</h2>
                <p style="color: #555; line-height: 1.6;">
                    Vous avez demandé à modifier vos informations de paiement.
                    Voici votre code de vérification :
                </p>
                <div style="background: #f0f4f8; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${otpCode}</span>
                </div>
                <p style="color: #888; font-size: 13px;">
                    Ce code expire dans <strong>15 minutes</strong>.<br>
                    Si vous n'avez pas fait cette demande, ignorez cet email.
                </p>
            </div>
        `
    });

    if (!result.success) {
        throw new Error('Erreur lors de l\'envoi de l\'email contenant le code');
    }

    return true;
};

/**
 * Vérifie un code OTP
 */
export const verifyPayoutOtp = async (userId, action, otpCode) => {
    const now = new Date().toISOString();

    // On cherche un OTP valide, non expiré et non utilisé pour cet user et cette action
    const { data: otps, error } = await supabaseAdmin
        .from('otp_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('action', action)
        .eq('is_used', false)
        .gte('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !otps || otps.length === 0) {
        return false;
    }

    const otpRecord = otps[0];

    if (otpRecord.otp_code !== otpCode) {
        return false;
    }

    // Marquer l'OTP comme utilisé
    await supabaseAdmin
        .from('otp_verifications')
        .update({ is_used: true })
        .eq('id', otpRecord.id);

    return true;
};

/**
 * Récupère les méthodes de paiement du vendeur
 */
export const getVendorPayoutMethods = async (vendorId) => {
    let { data, error } = await supabaseAdmin
        .from('vendor_payout_methods')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error('Erreur de lecture des comptes');
    }

    if (!data || data.length === 0) {
        // Auto-heal: Check if vendor has onboarding payout info in public.users
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('preferred_payout_method, payout_account_id, company_name, name')
            .eq('id', vendorId)
            .maybeSingle();

        if (user && user.preferred_payout_method && user.payout_account_id) {
            const { data: newMethod } = await supabaseAdmin
                .from('vendor_payout_methods')
                .insert({
                    vendor_id: vendorId,
                    provider: user.preferred_payout_method,
                    operator: user.preferred_payout_method,
                    account_id: user.payout_account_id,
                    account_name: user.company_name || user.name || '',
                    is_default: true
                })
                .select();
            if (newMethod && newMethod.length > 0) {
                data = newMethod;
            }
        }
    }

    return data || [];
};

/**
 * Ajout d'une méthode de paiement après validation OTP.
 * @param {string} vendorId
 * @param {string} provider (ex: flexpaie)
 * @param {string} operator (ex: vodacom_mpesa, airtel)
 * @param {string} accountId
 * @param {string} accountName
 * @param {boolean} isDefault
 */
export const addVendorPayoutMethod = async (vendorId, provider, operator, accountId, accountName, isDefault = true) => {
    // Règle métier : 1 seul compte MoMo par vendeur.
    // On supprime tous les anciens comptes avant d'ajouter le nouveau.
    await supabaseAdmin
        .from('vendor_payout_methods')
        .delete()
        .eq('vendor_id', vendorId);

    const { data, error } = await supabaseAdmin
        .from('vendor_payout_methods')
        .insert({
            vendor_id: vendorId,
            provider,
            operator,
            account_id: accountId,
            account_name: accountName,
            is_default: isDefault
        })
        .select()
        .single();

    if (error) {
        throw new Error('Impossible d\'ajouter la méthode de paiement');
    }

    return data;
};

/**
 * Supprime une méthode de paiement (avec vérification OTP préalable)
 */
export const removeVendorPayoutMethod = async (vendorId, methodId) => {
    const { error } = await supabaseAdmin
        .from('vendor_payout_methods')
        .delete()
        .eq('id', methodId)
        .eq('vendor_id', vendorId);

    if (error) {
        throw new Error('Impossible de supprimer la méthode de paiement');
    }

    return true;
};
