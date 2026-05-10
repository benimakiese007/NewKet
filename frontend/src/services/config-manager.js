/**
 * ConfigManager - NewKet EMarket
 * Centralized settings management (Exchange Rate, Shop Metadata, etc.)
 */
const ConfigManager = {
    config: {
        shopName: 'NewKet EMarket',
        email: 'contact@newket.com',
        supportPhone: '+243 000 000 000',
        exchangeRate: 2800,
        currencySymbol: 'CDF',
        shippingFee: 5,
        freeShippingThreshold: 50,
        maintenanceMode: false,
        socialLinks: {
            instagram: '',
            facebook: '',
            x: '',
            twitter: '',
            linkedin: ''
        }
    },

    _normalizeRemoteSettingsRow(row) {
        if (!row || typeof row !== 'object') return null;

        // Accept both snake_case (DB) and camelCase (legacy/local) inputs.
        const shopName = row.shopName ?? row.shop_name;
        const email = row.email ?? row.contact_email;
        const supportPhone = row.supportPhone ?? row.support_phone;
        const exchangeRate = row.exchangeRate ?? row.exchange_rate;
        const currencySymbol = row.currencySymbol ?? row.currency_symbol;
        const shippingFee = row.shippingFee ?? row.shipping_fee;
        const freeShippingThreshold = row.freeShippingThreshold ?? row.free_shipping_threshold;
        const maintenanceMode = row.maintenanceMode ?? row.maintenance_mode;

        const instagram = row?.socialLinks?.instagram ?? row.instagram_link ?? row.instagram;
        const facebook = row?.socialLinks?.facebook ?? row.facebook_link ?? row.facebook;
        const x = row?.socialLinks?.x ?? row?.socialLinks?.twitter ?? row.twitter_link ?? row.twitter ?? row.x;
        const linkedin = row?.socialLinks?.linkedin ?? row.linkedin_link ?? row.linkedin;

        return {
            ...(row.id ? { id: row.id } : {}),
            ...(shopName !== undefined ? { shopName } : {}),
            ...(email !== undefined ? { email } : {}),
            ...(supportPhone !== undefined ? { supportPhone } : {}),
            ...(exchangeRate !== undefined ? { exchangeRate } : {}),
            ...(currencySymbol !== undefined ? { currencySymbol } : {}),
            ...(shippingFee !== undefined ? { shippingFee } : {}),
            ...(freeShippingThreshold !== undefined ? { freeShippingThreshold } : {}),
            ...(maintenanceMode !== undefined ? { maintenanceMode: !!maintenanceMode } : {}),
            ...(instagram !== undefined || facebook !== undefined || x !== undefined || linkedin !== undefined
                ? {
                    socialLinks: {
                        instagram: instagram || '',
                        facebook: facebook || '',
                        x: x || '',
                        twitter: x || '',
                        linkedin: linkedin || ''
                    }
                }
                : {})
        };
    },

    _normalizeSocialUrl(value, network) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        const handle = raw.replace(/^@/, '');
        if (network === 'instagram') return `https://www.instagram.com/${handle}`;
        if (network === 'facebook') return `https://www.facebook.com/${handle}`;
        if (network === 'x') return `https://x.com/${handle}`;
        if (network === 'linkedin') return `https://www.linkedin.com/in/${handle}`;
        return `https://${raw}`;
    },

    _getSocialLinks(config) {
        const links = config?.socialLinks || {};
        const x = links.x || links.twitter || '';
        return {
            instagram: this._normalizeSocialUrl(links.instagram, 'instagram'),
            facebook: this._normalizeSocialUrl(links.facebook, 'facebook'),
            x: this._normalizeSocialUrl(x, 'x'),
            twitter: this._normalizeSocialUrl(x, 'x'),
            linkedin: this._normalizeSocialUrl(links.linkedin, 'linkedin')
        };
    },

    _toRemoteSettingsPayload(config, existingRow = null) {
        const socialLinks = this._getSocialLinks(config);
        const usesCamelSchema = !existingRow || ('shopName' in existingRow) || ('socialLinks' in existingRow);

        if (usesCamelSchema) {
            return {
                id: config.id || existingRow?.id || 'global-settings',
                shopName: config.shopName,
                email: config.email,
                supportPhone: config.supportPhone,
                exchangeRate: config.exchangeRate,
                currencySymbol: config.currencySymbol,
                shippingFee: config.shippingFee,
                freeShippingThreshold: config.freeShippingThreshold,
                maintenanceMode: !!config.maintenanceMode,
                socialLinks,
                sellerCommission: config.sellerCommission,
                targetAOV: config.targetAOV,
                primaryColor: config.primaryColor
            };
        }

        return {
            id: config.id || existingRow?.id || 'global-settings',
            shop_name: config.shopName,
            contact_email: config.email,
            support_phone: config.supportPhone,
            exchange_rate: config.exchangeRate,
            currency_symbol: config.currencySymbol,
            shipping_fee: config.shippingFee,
            free_shipping_threshold: config.freeShippingThreshold,
            maintenance_mode: !!config.maintenanceMode,
            instagram_link: socialLinks.instagram,
            facebook_link: socialLinks.facebook,
            twitter_link: socialLinks.x,
            linkedin_link: socialLinks.linkedin
        };
    },
 
    async init() {
        const saved = localStorage.getItem('newket_global_config');
        const fetchTime = localStorage.getItem('newket_global_config_time');
        const now = Date.now();
        const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

        if (saved) {
            try {
                this.config = { ...this.config, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('[NewKet] Failed to parse local config, using defaults.');
            }
        }

        // Try to fetch from backend if cache is expired or missing.
        // Also force-refresh when maintenance is ON to avoid "stuck maintenance" from stale cache.
        const cacheExpired = !fetchTime || now - parseInt(fetchTime) > CACHE_DURATION;
        const forceRefresh = this.config.maintenanceMode === true;
        const socialLinksIncomplete = !this.config.socialLinks?.x || !this.config.socialLinks?.linkedin;
        if (window.SupabaseAdapter && (cacheExpired || forceRefresh || socialLinksIncomplete)) {
            // Check if we are already fetching to prevent duplicate calls from multiple managers
            if (this._fetchPromise) {
                await this._fetchPromise;
                return;
            }
            
            this._fetchPromise = (async () => {
                try {
                    const remoteConfig = await window.SupabaseAdapter.fetch('settings');
                    if (remoteConfig && remoteConfig.length > 0) {
                        const normalized = this._normalizeRemoteSettingsRow(remoteConfig[0]);
                        if (normalized) this.config = { ...this.config, ...normalized };
                        this.saveLocal();
                        window.dispatchEvent(new CustomEvent('configUpdated', { detail: this.config }));
                        localStorage.setItem('newket_global_config_time', now.toString());
                    }
                } catch (err) {
                    console.warn('[NewKet] Failed to fetch settings from Supabase:', err);
                }
            })();
            
            await this._fetchPromise;
            this._fetchPromise = null;
        }

        // Global export for legacy code
        window.newketConfig = this.config;
    },

    getConfig() {
        return this.config;
    },

    getExchangeRate() {
        return this.config.exchangeRate || 2800;
    },

    async saveConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.config.socialLinks = this._getSocialLinks(this.config);
        this.saveLocal();

        if (window.SupabaseAdapter) {
            try {
                // Ensure local cache timestamp is fresh after a write.
                localStorage.setItem('newket_global_config_time', Date.now().toString());

                // If a row exists, update it; otherwise insert with deterministic id.
                const rows = await window.SupabaseAdapter.fetch('settings');
                const existingRow = rows && rows.length > 0 ? rows[0] : null;
                const payload = this._toRemoteSettingsPayload(this.config, existingRow);
                if (rows && rows.length > 0) {
                    await window.SupabaseAdapter.update('settings', rows[0].id, payload);
                } else {
                    await window.SupabaseAdapter.insert('settings', payload);
                }
            } catch (err) {
                console.error('[NewKet] Error saving remote settings to Supabase:', err);
            }
        }
        
        window.dispatchEvent(new CustomEvent('configUpdated', { detail: this.config }));
    },

    saveLocal() {
        localStorage.setItem('newket_global_config', JSON.stringify(this.config));
        window.newketConfig = this.config;
    }
};

window.ConfigManager = ConfigManager;
ConfigManager.init();
