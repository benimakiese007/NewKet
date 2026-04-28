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
            facebook: ''
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
            ...(instagram !== undefined || facebook !== undefined
                ? { socialLinks: { instagram: instagram || '', facebook: facebook || '' } }
                : {})
        };
    },

    _toRemoteSettingsPayload(config) {
        // Database columns are snake_case.
        return {
            id: config.id || 'global-settings',
            shop_name: config.shopName,
            contact_email: config.email,
            support_phone: config.supportPhone,
            exchange_rate: config.exchangeRate,
            currency_symbol: config.currencySymbol,
            shipping_fee: config.shippingFee,
            free_shipping_threshold: config.freeShippingThreshold,
            maintenance_mode: !!config.maintenanceMode,
            instagram_link: config?.socialLinks?.instagram || '',
            facebook_link: config?.socialLinks?.facebook || ''
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
        if (window.SupabaseAdapter && (cacheExpired || forceRefresh)) {
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
        this.saveLocal();

        if (window.SupabaseAdapter) {
            try {
                const payload = this._toRemoteSettingsPayload(this.config);
                // Ensure local cache timestamp is fresh after a write.
                localStorage.setItem('newket_global_config_time', Date.now().toString());

                // If a row exists, update it; otherwise insert with deterministic id.
                const rows = await window.SupabaseAdapter.fetch('settings');
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
