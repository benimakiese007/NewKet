import { supabase, supabaseAdmin } from '../config/supabase.js';

const normalizeSocialUrl = (value, network) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const handle = raw.replace(/^@/, '');
    if (network === 'instagram') return `https://www.instagram.com/${handle}`;
    if (network === 'facebook') return `https://www.facebook.com/${handle}`;
    if (network === 'x') return `https://x.com/${handle}`;
    if (network === 'linkedin') return `https://www.linkedin.com/in/${handle}`;
    return `https://${raw}`;
};

const getSocialLinks = (row = {}) => {
    const links = row.socialLinks || {};
    const x = links.x || links.twitter || row.twitter_link || row.twitter || row.x || '';
    return {
        instagram: normalizeSocialUrl(links.instagram || row.instagram_link || row.instagram, 'instagram'),
        facebook: normalizeSocialUrl(links.facebook || row.facebook_link || row.facebook, 'facebook'),
        x: normalizeSocialUrl(x, 'x'),
        twitter: normalizeSocialUrl(x, 'x'),
        linkedin: normalizeSocialUrl(links.linkedin || row.linkedin_link || row.linkedin, 'linkedin')
    };
};

const mapSettingsRow = (row) => {
    const usesCamelSchema = ('shopName' in row) || ('socialLinks' in row);

    if (usesCamelSchema) {
        return {
            id: row.id,
            shopName: row.shopName,
            email: row.email,
            supportPhone: row.supportPhone,
            exchangeRate: row.exchangeRate,
            currencySymbol: row.currencySymbol,
            targetAOV: row.targetAOV,
            shippingFee: row.shippingFee,
            freeShippingThreshold: row.freeShippingThreshold,
            maintenanceMode: row.maintenanceMode,
            socialLinks: getSocialLinks(row)
        };
    }

    return {
        id: row.id,
        shopName: row.shop_name,
        email: row.contact_email,
        supportPhone: row.support_phone,
        exchangeRate: row.exchange_rate,
        currencySymbol: row.currency_symbol,
        targetAOV: row.target_aov,
        shippingFee: row.shipping_fee,
        freeShippingThreshold: row.free_shipping_threshold,
        maintenanceMode: row.maintenance_mode,
        socialLinks: getSocialLinks(row)
    };
};

export const getSettings = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*');

        if (error) throw error;

        const mappedData = (data || []).map(mapSettingsRow);

        res.json(mappedData);
    } catch (err) {
        console.error('Erreur getSettings:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des paramètres.' });
    }
};

export const saveSettings = async (req, res) => {
    try {
        const config = req.body;
        
        const { data: existingRows, error: fetchError } = await supabaseAdmin
            .from('settings')
            .select('*')
            .limit(1);
        if (fetchError) throw fetchError;

        const existingRow = existingRows?.[0] || null;
        const existingId = config.id || existingRow?.id || 'global-settings';
        const usesCamelSchema = !existingRow || ('shopName' in existingRow) || ('socialLinks' in existingRow);
        const socialLinks = getSocialLinks(config);

        const payload = usesCamelSchema ? {
            id: existingId,
            shopName: config.shopName,
            email: config.email,
            supportPhone: config.supportPhone,
            exchangeRate: config.exchangeRate,
            currencySymbol: config.currencySymbol,
            maintenanceMode: config.maintenanceMode,
            socialLinks,
            shippingFee: config.shippingFee,
            freeShippingThreshold: config.freeShippingThreshold,
            sellerCommission: config.sellerCommission,
            targetAOV: config.targetAOV,
            primaryColor: config.primaryColor
        } : {
            id: existingId,
            shop_name: config.shopName,
            contact_email: config.email,
            support_phone: config.supportPhone,
            exchange_rate: config.exchangeRate,
            currency_symbol: config.currencySymbol,
            target_aov: config.targetAOV,
            maintenance_mode: config.maintenanceMode,
            instagram_link: socialLinks.instagram,
            facebook_link: socialLinks.facebook,
            twitter_link: socialLinks.x,
            linkedin_link: socialLinks.linkedin
        };

        if (!usesCamelSchema) {
            if (config.shippingFee !== undefined) payload.shipping_fee = config.shippingFee;
            if (config.freeShippingThreshold !== undefined) payload.free_shipping_threshold = config.freeShippingThreshold;
        }

        const { data, error } = await supabaseAdmin
            .from('settings')
            .upsert(payload)
            .select()
            .single();

        if (error) {
            console.error('Erreur Supabase dans saveSettings:', error);
            throw error;
        }
        res.json({ success: true, data });
    } catch (err) {
        console.error('Erreur saveSettings:', err);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde des paramètres.' });
    }
};

// Store OTPs in memory for simplicity (in a real app, use Redis or DB with TTL)
const otpStore = new Map();

export const requestTransactionResetOTP = async (req, res) => {
    try {
        const { data: settings, error: fetchError } = await supabaseAdmin
            .from('settings')
            .select('*')
            .limit(1);

        if (fetchError) throw fetchError;
        const existingRow = settings?.[0] || {};
        
        // Ensure email exists to send OTP to
        const adminEmail = existingRow.contact_email || existingRow.email;
        if (!adminEmail) {
            return res.status(400).json({ error: 'Aucun email administrateur configuré pour recevoir le code.' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP with 5 mins expiration and 0 attempts
        const adminId = req.user?.id || 'admin';
        otpStore.set(adminId, {
            code: otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        });

        // Send Email
        const { default: EmailService } = await import('../services/emailService.js');
        const emailResult = await EmailService.sendAdminOTP(adminEmail, otp);
        
        if (!emailResult.success) {
            return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
        }

        res.json({ success: true, message: 'Code envoyé à l\'adresse email de l\'administration.' });
    } catch (error) {
        console.error('Erreur requestTransactionResetOTP:', error);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

export const verifyTransactionResetOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const adminId = req.user?.id || 'admin';

        if (!otp) {
            return res.status(400).json({ error: 'Le code OTP est requis.' });
        }

        const storedData = otpStore.get(adminId);
        if (!storedData) {
            return res.status(400).json({ error: 'Aucun code OTP demandé ou le code a expiré.' });
        }

        // Check expiration
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(adminId);
            return res.status(400).json({ error: 'Le code OTP a expiré. Veuillez en demander un nouveau.' });
        }

        // Check attempts
        if (storedData.code !== otp) {
            storedData.attempts += 1;
            
            if (storedData.attempts >= 3) {
                otpStore.delete(adminId);
                // Return 401 to trigger logout on frontend
                return res.status(401).json({ error: 'Trop de tentatives échouées. Déconnexion par sécurité.' });
            }
            
            return res.status(400).json({ error: 'Code OTP invalide.' });
        }

        // Valid OTP! Execute deletion
        otpStore.delete(adminId);

        // Delete transactional data
        const tables = [
            'vendor_payouts',
            'disputes',
            'order_items',
            'orders',
            'payments'
        ];

        // Supabase REST API does not have a TRUNCATE. We must delete by ID > 0 or not null.
        for (const table of tables) {
            // Delete all rows safely
            const { error: delError } = await supabaseAdmin
                .from(table)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // hack to delete all

            if (delError) {
                console.error(`Erreur suppression table ${table}:`, delError);
            }
        }

        res.json({ success: true, message: 'Toutes les données de transaction ont été supprimées avec succès.' });

    } catch (error) {
        console.error('Erreur verifyTransactionResetOTP:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification.' });
    }
};
