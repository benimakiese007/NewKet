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
        if (saved) {
            try {
                this.config = { ...this.config, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('[NewKet] Failed to parse local config, using defaults.');
            }
        }

        // Try to fetch from backend if possible
        if (window.ApiClient) {
            try {
                const remoteConfig = await window.ApiClient.get('/settings');
                if (remoteConfig && remoteConfig.length > 0) {
                    // Assuming settings is a table with key/value pairs or a single row
                    // If it's a single row:
                    const settings = remoteConfig[0];
                    this.config = { ...this.config, ...settings };
                    this.saveLocal();
                }
            } catch (err) {
                console.warn('[NewKet] Failed to fetch settings from backend:', err);
            }
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

        if (window.ApiClient) {
            try {
                await window.ApiClient.put('/settings', newConfig);
            } catch (err) {
                console.error('[NewKet] Error saving remote settings:', err);
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
