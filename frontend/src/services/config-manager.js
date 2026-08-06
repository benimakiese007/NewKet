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
        targetAOV: 0,
        platformCommissionRate: 5.0,
        shippingFee: 5,
        freeShippingThreshold: 50,
        maintenanceMode: false,

        // Branding / Theme (site-wide)
        primaryColor: '#050505',
        primaryHover: '#1A1A1A',
        secondaryColor: '#121212',
        headerBg: '#013220',
        headerFg: '#ffffff',
        footerBg: '#013220',
        footerFg: '#ffffff',
        themeColor: '#064734',
        fontHeading: "'Poppins', sans-serif",
        fontBody: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
        faviconUrl: '',
        appleTouchIconUrl: '',
        pwaIcon192Url: '',
        pwaIcon512Url: '',
        pwaIcon192MaskableUrl: '',
        pwaIcon512MaskableUrl: '',
        headerLogoUrl: '',
        footerLogoUrl: '',
        socialLinks: {
            instagram: '',
            facebook: '',
            x: '',
            twitter: '',
            linkedin: ''
        }
    },

    _realtimeChannel: null,
    _maintenancePollTimer: null,

    // Save lock: bloque les polls/realtime d'écraser maintenanceMode
    // pendant et juste après un save (évite la race condition toggle).
    _saveLockUntil: 0,

    _maintenanceCheckKey: 'newket_global_config_maintenance_check_time',

    _markMaintenanceCheck(now = Date.now()) {
        localStorage.setItem(this._maintenanceCheckKey, String(now));
    },

    async _fetchRemoteSettings(source = 'fetch') {
        if (!window.ApiClient && !window.SupabaseAdapter) return null;
        if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '') && window.newketBackendReady === false) {
            return null;
        }

        // Ne pas écraser l'état pendant ou juste après un save (évite la race condition)
        if (source === 'poll' && Date.now() < this._saveLockUntil) {
            return null;
        }

        if (this._fetchPromise) {
            return this._fetchPromise;
        }

        this._fetchPromise = (async () => {
            try {
                const remoteConfig = window.ApiClient
                    ? await window.ApiClient.get('/settings', {
                        cacheKey: 'global-settings',
                        cacheTtlMs: 30_000,
                        suppressToast: true
                    })
                    : await window.SupabaseAdapter.fetch('settings');

                const row = Array.isArray(remoteConfig) ? remoteConfig[0] : remoteConfig;
                if (row) {
                    this._applyRemoteSettingsRow(row, source);
                    this._markMaintenanceCheck();
                    return row;
                }
                return null;
            } catch (err) {
                console.warn('[NewKet] Failed to fetch settings from API:', err);
                return null;
            }
        })();

        try {
            return await this._fetchPromise;
        } finally {
            this._fetchPromise = null;
        }
    },

    _startMaintenancePolling() {
        if (this._maintenancePollTimer || !window.SupabaseAdapter) return;
        if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '') && window.newketBackendReady === false) {
            return;
        }

        // 10 s — pour garantir que la bascule maintenance est visible en < 15 s max.
        this._maintenancePollTimer = window.setInterval(() => {
            this._fetchRemoteSettings('poll').catch((err) => {
                console.warn('[NewKet] Maintenance poll failed:', err?.message || err);
            });
        }, 10_000);
    },

    _normalizeRemoteSettingsRow(row) {
        if (!row || typeof row !== 'object') return null;

        // Accept both snake_case (DB) and camelCase (legacy/local) inputs.
        const shopName = row.shopName ?? row.shop_name;
        const email = row.email ?? row.contact_email;
        const supportPhone = row.supportPhone ?? row.support_phone;
        const exchangeRate = row.exchangeRate ?? row.exchange_rate;
        const currencySymbol = row.currencySymbol ?? row.currency_symbol;
        const targetAOV = row.targetAOV ?? row.target_aov;
        const platformCommissionRate = row.platformCommissionRate ?? row.platform_commission_rate;
        const shippingFee = row.shippingFee ?? row.shipping_fee;
        const freeShippingThreshold = row.freeShippingThreshold ?? row.free_shipping_threshold;
        const maintenanceMode = row.maintenanceMode ?? row.maintenance_mode;

        // Branding / Theme (site-wide)
        const primaryColor = row.primaryColor ?? row.primary_color;
        const secondaryColor = row.secondaryColor ?? row.secondary_color;
        const headerBg = row.headerBg ?? row.header_bg;
        const headerFg = row.headerFg ?? row.header_fg;
        const footerBg = row.footerBg ?? row.footer_bg;
        const footerFg = row.footerFg ?? row.footer_fg;
        const themeColor = row.themeColor ?? row.theme_color;
        const fontHeading = row.fontHeading ?? row.font_heading;
        const fontBody = row.fontBody ?? row.font_body;
        const faviconUrl = row.faviconUrl ?? row.favicon_url;
        const appleTouchIconUrl = row.appleTouchIconUrl ?? row.apple_touch_icon_url;
        const pwaIcon192Url = row.pwaIcon192Url ?? row.pwa_icon_192_url;
        const pwaIcon512Url = row.pwaIcon512Url ?? row.pwa_icon_512_url;
        const pwaIcon192MaskableUrl = row.pwaIcon192MaskableUrl ?? row.pwa_icon_192_maskable_url;
        const pwaIcon512MaskableUrl = row.pwaIcon512MaskableUrl ?? row.pwa_icon_512_maskable_url;
        const headerLogoUrl = row.headerLogoUrl ?? row.header_logo_url;
        const footerLogoUrl = row.footerLogoUrl ?? row.footer_logo_url;

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
            ...(targetAOV !== undefined ? { targetAOV } : {}),
            ...(platformCommissionRate !== undefined ? { platformCommissionRate } : {}),
            ...(shippingFee !== undefined ? { shippingFee } : {}),
            ...(freeShippingThreshold !== undefined ? { freeShippingThreshold } : {}),
            ...(maintenanceMode !== undefined ? { maintenanceMode: !!maintenanceMode } : {}),
            ...(primaryColor !== undefined ? { primaryColor } : {}),
            ...(secondaryColor !== undefined ? { secondaryColor } : {}),
            ...(headerBg !== undefined ? { headerBg } : {}),
            ...(headerFg !== undefined ? { headerFg } : {}),
            ...(footerBg !== undefined ? { footerBg } : {}),
            ...(footerFg !== undefined ? { footerFg } : {}),
            ...(themeColor !== undefined ? { themeColor } : {}),
            ...(fontHeading !== undefined ? { fontHeading } : {}),
            ...(fontBody !== undefined ? { fontBody } : {}),
            ...(faviconUrl !== undefined ? { faviconUrl } : {}),
            ...(appleTouchIconUrl !== undefined ? { appleTouchIconUrl } : {}),
            ...(pwaIcon192Url !== undefined ? { pwaIcon192Url } : {}),
            ...(pwaIcon512Url !== undefined ? { pwaIcon512Url } : {}),
            ...(pwaIcon192MaskableUrl !== undefined ? { pwaIcon192MaskableUrl } : {}),
            ...(pwaIcon512MaskableUrl !== undefined ? { pwaIcon512MaskableUrl } : {}),
            ...(headerLogoUrl !== undefined ? { headerLogoUrl } : {}),
            ...(footerLogoUrl !== undefined ? { footerLogoUrl } : {}),
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

    _applyRemoteSettingsRow(row, source = 'remote') {
        const normalized = this._normalizeRemoteSettingsRow(row);
        if (!normalized) return false;

        const previousMaintenanceMode = !!this.config.maintenanceMode;

        // Pendant le save lock, on préserve la valeur locale de maintenanceMode.
        // Ni le polling ni le realtime ne peuvent écraser l'état du toggle cliqué.
        if (Date.now() < this._saveLockUntil && normalized.maintenanceMode !== undefined) {
            normalized.maintenanceMode = previousMaintenanceMode;
        }

        this.config = { ...this.config, ...normalized };
        this.saveLocal();
        this._markMaintenanceCheck();
        window.dispatchEvent(new CustomEvent('configUpdated', { detail: this.config }));

        const nextMaintenanceMode = !!this.config.maintenanceMode;
        if (previousMaintenanceMode !== nextMaintenanceMode) {
            window.dispatchEvent(new CustomEvent('maintenanceModeChanged', {
                detail: { maintenanceMode: nextMaintenanceMode, source }
            }));
        }

        return true;
    },

    _startRealtimeSync() {
        if (this._realtimeChannel) return;
        if (!window.SupabaseAdapter?.getClient) return;
        if (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '') && !this.config.enableLocalRealtime) {
            return;
        }

        const client = window.SupabaseAdapter.getClient();
        if (!client) return;

        this._realtimeChannel = client
            .channel('settings:realtime-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
                const row = payload?.new || payload?.record || null;
                if (!row) return;
                this._applyRemoteSettingsRow(row, 'realtime');
            })
            .subscribe();
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
                primaryColor: config.primaryColor,
                secondaryColor: config.secondaryColor,
                headerBg: config.headerBg,
                headerFg: config.headerFg,
                footerBg: config.footerBg,
                footerFg: config.footerFg,
                themeColor: config.themeColor,
                fontHeading: config.fontHeading,
                fontBody: config.fontBody,
                faviconUrl: config.faviconUrl,
                appleTouchIconUrl: config.appleTouchIconUrl,
                pwaIcon192Url: config.pwaIcon192Url,
                pwaIcon512Url: config.pwaIcon512Url,
                pwaIcon192MaskableUrl: config.pwaIcon192MaskableUrl,
                pwaIcon512MaskableUrl: config.pwaIcon512MaskableUrl,
                headerLogoUrl: config.headerLogoUrl,
                footerLogoUrl: config.footerLogoUrl
            };
        }

        return {
            id: config.id || existingRow?.id || 'global-settings',
            shop_name: config.shopName,
            contact_email: config.email,
            support_phone: config.supportPhone,
            exchange_rate: config.exchangeRate,
            currency_symbol: config.currencySymbol,
            target_aov: config.targetAOV,
            shipping_fee: config.shippingFee,
            free_shipping_threshold: config.freeShippingThreshold,
            maintenance_mode: !!config.maintenanceMode,
            primary_color: config.primaryColor,
            secondary_color: config.secondaryColor,
            header_bg: config.headerBg,
            header_fg: config.headerFg,
            footer_bg: config.footerBg,
            footer_fg: config.footerFg,
            theme_color: config.themeColor,
            font_heading: config.fontHeading,
            font_body: config.fontBody,
            favicon_url: config.faviconUrl,
            apple_touch_icon_url: config.appleTouchIconUrl,
            pwa_icon_192_url: config.pwaIcon192Url,
            pwa_icon_512_url: config.pwaIcon512Url,
            pwa_icon_192_maskable_url: config.pwaIcon192MaskableUrl,
            pwa_icon_512_maskable_url: config.pwaIcon512MaskableUrl,
            header_logo_url: config.headerLogoUrl,
            footer_logo_url: config.footerLogoUrl,
            instagram_link: socialLinks.instagram,
            facebook_link: socialLinks.facebook,
            twitter_link: socialLinks.x,
            linkedin_link: socialLinks.linkedin
        };
    },

    async init() {
        const saved = localStorage.getItem('newket_global_config');
        const fetchTime = localStorage.getItem('newket_global_config_time');
        const maintenanceCheckTime = localStorage.getItem(this._maintenanceCheckKey);
        const now = Date.now();
        const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
        const MAINTENANCE_CHECK_DURATION = 1000 * 60; // 60 seconds
        const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '');

        if (saved) {
            try {
                this.config = { ...this.config, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('[NewKet] Failed to parse local config, using defaults.');
            }
        }

        // Try to fetch from backend if cache is expired or missing.
        const cacheExpired = !fetchTime || now - parseInt(fetchTime) > CACHE_DURATION;
        const socialLinksIncomplete = !this.config.socialLinks?.x || !this.config.socialLinks?.linkedin;
        const maintenanceCheckExpired =
            !maintenanceCheckTime || now - parseInt(maintenanceCheckTime) > MAINTENANCE_CHECK_DURATION;
        const shouldRefreshForMaintenance = !!this.config.maintenanceMode || maintenanceCheckExpired;
        const backendReady = !isLocalHost || !window.ApiClient?.isLocalBackendReady
            ? true
            : await window.ApiClient.isLocalBackendReady(1200);

        window.newketBackendReady = backendReady;

        if (window.SupabaseAdapter && backendReady && (cacheExpired || socialLinksIncomplete || shouldRefreshForMaintenance)) {
            await this._fetchRemoteSettings('fetch');
            localStorage.setItem('newket_global_config_time', now.toString());
            this._markMaintenanceCheck(now);
        } else {
            localStorage.setItem('newket_global_config_time', now.toString());
            this._markMaintenanceCheck(now);
        }

        this._startRealtimeSync();
        this._startMaintenancePolling();

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
        const previousMaintenanceMode = !!this.config.maintenanceMode;

        // Bloquer les polls pendant 3s pour éviter la race condition.
        // Le verrou est levé dès que le save est confirmé par le serveur.
        this._saveLockUntil = Date.now() + 3000;

        this.config = { ...this.config, ...newConfig };
        this.config.socialLinks = this._getSocialLinks(this.config);
        this.saveLocal();
        let remoteError = null;

        // Dispatcher maintenanceModeChanged localement de façon immédiate
        // avant même la sauvegarde réseau, pour que l'UI réagisse sans attendre.
        const nextMaintenanceMode = !!this.config.maintenanceMode;
        if (previousMaintenanceMode !== nextMaintenanceMode) {
            window.dispatchEvent(new CustomEvent('maintenanceModeChanged', {
                detail: { maintenanceMode: nextMaintenanceMode, source: 'save-immediate' }
            }));
        }

        if (window.SupabaseAdapter) {
            try {
                // Ensure local cache timestamp is fresh after a write.
                localStorage.setItem('newket_global_config_time', Date.now().toString());

                const payload = this.config.id
                    ? { ...this.config, id: this.config.id }
                    : { ...this.config, id: 'global-settings' };

                if (window.ApiClient) {
                    // Invalider le cache ApiClient pour /settings après une écriture
                    // afin que le prochain poll récupère les données fraîches.
                    if (window.ApiClient._responseCache instanceof Map) {
                        window.ApiClient._responseCache.delete('global-settings');
                    }

                    await window.ApiClient.put('/settings', payload, {
                        suppressToast: true,
                        suppressErrorLogging: true
                    });
                } else {
                    // Fallback to raw Supabase table.
                    const rows = await window.SupabaseAdapter.fetch('settings');
                    const existingRow = rows && rows.length > 0 ? rows[0] : null;
                    const remotePayload = this._toRemoteSettingsPayload(this.config, existingRow);
                    if (rows && rows.length > 0) {
                        await window.SupabaseAdapter.update('settings', rows[0].id, remotePayload);
                    } else {
                        await window.SupabaseAdapter.insert('settings', remotePayload);
                    }
                }
                this._markMaintenanceCheck();
                // Lever le verrou dès que le save est confirmé
                this._saveLockUntil = 0;
            } catch (err) {
                console.error('[NewKet] Error saving remote settings to Supabase:', err);
                remoteError = err;
            }
        }

        window.dispatchEvent(new CustomEvent('configUpdated', { detail: this.config }));

        if (remoteError) {
            throw remoteError;
        }
    },

    saveLocal() {
        localStorage.setItem('newket_global_config', JSON.stringify(this.config));
        window.newketConfig = this.config;
    }
};

window.ConfigManager = ConfigManager;
ConfigManager.init();
