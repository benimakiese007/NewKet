import { supabase, supabaseAdmin } from '../config/supabase.js';

export const getSettings = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*');

        if (error) throw error;
        
        // Map database snake_case to frontend expected camelCase
        const mappedData = (data || []).map(row => ({
            id: row.id,
            shopName: row.shop_name,
            email: row.contact_email,
            supportPhone: row.support_phone,
            exchangeRate: row.exchange_rate,
            currencySymbol: row.currency_symbol,
            shippingFee: row.shipping_fee,
            freeShippingThreshold: row.free_shipping_threshold,
            maintenanceMode: row.maintenance_mode,
            socialLinks: {
                instagram: row.instagram_link,
                facebook: row.facebook_link,
                twitter: row.twitter_link
            }
        }));

        res.json(mappedData);
    } catch (err) {
        console.error('Erreur getSettings:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des paramètres.' });
    }
};

export const saveSettings = async (req, res) => {
    try {
        const config = req.body;
        
        let existingId = config.id || 'global-settings';

        // Map frontend camelCase to database snake_case
        const payload = {
            id: existingId,
            shop_name: config.shopName,
            contact_email: config.email,
            support_phone: config.supportPhone,
            exchange_rate: config.exchangeRate,
            currency_symbol: config.currencySymbol,
            maintenance_mode: config.maintenanceMode
        };

        if (config.socialLinks) {
            payload.instagram_link = config.socialLinks.instagram;
            payload.facebook_link = config.socialLinks.facebook;
        }

        if (config.shippingFee !== undefined) payload.shipping_fee = config.shippingFee;
        if (config.freeShippingThreshold !== undefined) payload.free_shipping_threshold = config.freeShippingThreshold;

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
