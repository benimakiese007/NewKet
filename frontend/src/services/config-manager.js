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

        // Try to fetch from backend if cache is expired or missing
        if (window.SupabaseAdapter && (!fetchTime || now - parseInt(fetchTime) > CACHE_DURATION)) {
            // Check if we are already fetching to prevent duplicate calls from multiple managers
            if (this._fetchPromise) {
                await this._fetchPromise;
                return;
            }
            
            this._fetchPromise = (async () => {
                try {
                    const remoteConfig = await window.SupabaseAdapter.fetch('settings');
                    if (remoteConfig && remoteConfig.length > 0) {
                        const settings = remoteConfig[0];
                        // Parse JSON fields if necessary, though Supabase returns objects naturally
                        this.config = { ...this.config, ...settings };
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
                // First get the row Id
                const rows = await window.SupabaseAdapter.fetch('settings');
                if (rows && rows.length > 0) {
                    await window.SupabaseAdapter.update('settings', rows[0].id, newConfig);
                } else {
                    await window.SupabaseAdapter.insert('settings', newConfig);
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
