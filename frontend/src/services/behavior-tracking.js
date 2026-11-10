const BehaviorTracking = {
    _initialized: false,
    _heartbeatTimer: null,
    _visibleSince: 0,
    _lastClickTs: 0,
    _analyticsCooldownUntil: 0,
    _analyticsDisabled: false,
    _baseMetaCache: null,
    _baseMetaCacheTs: 0,

    // --- Queue / Batch ---
    // Les events sont mis en file et envoyés en batch toutes les 30s ou dès 10 events.
    // Réduit drastiquement le nb de requêtes HTTP (10x→100x moins de hits API).
    _queue: [],
    _flushTimer: null,
    _FLUSH_INTERVAL_MS: 30_000, // flush automatique toutes les 30s
    _FLUSH_BATCH_SIZE: 10,      // flush immédiat si la queue atteint 10 events

    init() {
        if (this._initialized) return;
        if (!window.ApiClient) return;
        if (this._isEmbeddedAdmin()) return;
        if (this._isAdminArea()) return;

        this._initialized = true;
        this._visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;

        // In local dev, avoid Vite proxy spam when the API is not running.
        // Behavior tracking is optional, so we disable it if the backend healthcheck is unreachable.
        this._maybeDisableInDevIfApiDown();

        this.trackPageView();
        this.bindClicks();
        this.bindVisibility();
        this.startHeartbeat();
        this.bindAppInstalled();
        this._startFlushTimer();
        this._bindPageExit();
    },

    async _maybeDisableInDevIfApiDown() {
        try {
            const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '');
            if (isLocal) {
                this._analyticsDisabled = true;
                return;
            }
        } catch (_) {
            this._analyticsDisabled = true;
        }
    },

    getOrCreateSessionId() {
        try {
            const key = 'newket_session_id';
            const existing = localStorage.getItem(key);
            if (existing && existing.length >= 12) return existing;
            const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`.slice(0, 64);
            localStorage.setItem(key, id);
            return id;
        } catch (_) {
            return null;
        }
    },

    trackPageView() {
        const dayKey = new Date().toISOString().slice(0, 10);
        const pageKey = `newket_page_view:${window.location.pathname}:${window.location.search}:${dayKey}`;
        try {
            if (sessionStorage.getItem(pageKey)) return;
            sessionStorage.setItem(pageKey, '1');
        } catch (_) {}

        this.track('page_view', {
            page_title: document.title || null,
            metadata: {
                referrer: document.referrer || null,
                query: window.location.search || '',
                hash: window.location.hash || '',
            }
        });
    },

    bindClicks() {
        document.addEventListener('click', (event) => {
            const target = event.target?.closest?.('a,button,[role="button"],[data-track-action]');
            if (!target) return;

            // Ignore high-frequency internal dashboard tab navigation (prevents 429 spam in dev).
            // We still track page views and meaningful actions elsewhere.
            try {
                if (
                    target.matches?.('[data-switch-vendor-tab],[data-switch-customer-tab]') ||
                    target.closest?.('[data-switch-vendor-tab],[data-switch-customer-tab]')
                ) return;
            } catch (_) {}

            // Ignore sidebar UI toggles (burger / close / collapse): no need to track.
            try {
                const onclickAttr = target.getAttribute?.('onclick') || '';
                if (
                    target.matches?.('[data-toggle-sidebar],[data-close-sidebar]') ||
                    target.closest?.('[data-toggle-sidebar],[data-close-sidebar]') ||
                    target.classList?.contains?.('sidebar-toggle-btn') ||
                    target.closest?.('.sidebar-toggle-btn') ||
                    onclickAttr.includes('SidebarManager.toggle') ||
                    onclickAttr.includes('SidebarManager.close')
                ) {
                    return;
                }
            } catch (_) {}

            const now = Date.now();
            if (now - this._lastClickTs < 400) return;
            this._lastClickTs = now;

            const label = this._describeTarget(target);
            if (!label) return;

            const isAdminArea = window.location.pathname.includes('/admin/') || localStorage.getItem('newketRole') === 'admin';
            this.track(isAdminArea ? 'admin_action' : 'click', {
                target: label,
                metadata: {
                    track_action: target.getAttribute?.('data-track-action') || null,
                    href: target.getAttribute('href') || null,
                    id: target.id || null,
                    classes: String(target.className || '').slice(0, 180),
                    text: (target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
                }
            });
        }, true);
    },

    bindVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this._visibleSince = Date.now();
                return;
            }
            this.flushVisibilityDuration();
        });

        window.addEventListener('beforeunload', () => this.flushVisibilityDuration());
    },

    bindAppInstalled() {
        window.addEventListener('appinstalled', () => {
            const pd = this._getPlatformAndDevice();
            this.track('click', {
                target: 'PWA Installed (' + pd.os + ')',
                metadata: {
                    action: 'appinstalled',
                    device: pd.device,
                    device_os: pd.os,
                    is_pwa: true
                }
            });
        });
    },

    startHeartbeat() {
        this._heartbeatTimer = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            this.track('heartbeat', {
                // Reduce event volume: sending 1/min easily hits backend rate limits.
                active_ms: 5 * 60 * 1000,
                metadata: {
                    source: 'interval',
                }
            });
        }, 5 * 60 * 1000);
    },

    flushVisibilityDuration() {
        if (!this._visibleSince) return;
        const elapsed = Date.now() - this._visibleSince;
        this._visibleSince = 0;
        if (elapsed < 5000) return;

        this.track('heartbeat', {
            active_ms: elapsed,
            metadata: {
                source: 'visibilitychange',
            }
        });
    },

    _getPlatformAndDevice() {
        try {
            const ua = String(navigator.userAgent || '').toLowerCase();
            const isIos = /iphone|ipad|ipod/i.test(ua);
            const isAndroid = /android/i.test(ua);
            const isWindows = /windows/i.test(ua);
            const isMac = /macintosh|mac os x/i.test(ua) && !isIos;
            const isLinux = /linux/i.test(ua) && !isAndroid;

            // 1. Detection Capacitor Natif (APK ou IPA)
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
                const capPlatform = (window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : '').toLowerCase();
                if (capPlatform === 'android' || isAndroid) {
                    return { device: 'app_android', os: 'Android (App Native)', is_pwa: false, is_native: true };
                }
                if (capPlatform === 'ios' || isIos) {
                    return { device: 'app_ios', os: 'iOS (App Native)', is_pwa: false, is_native: true };
                }
            }

            // 2. Detection PWA (Standalone sur ecran d accueil)
            const isStandalone = (
                (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                window.navigator.standalone === true ||
                (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://'))
            );

            if (isStandalone) {
                if (isIos) {
                    return { device: 'pwa_ios', os: 'iOS (PWA)', is_pwa: true, is_native: false };
                }
                if (isAndroid) {
                    return { device: 'pwa_android', os: 'Android (PWA)', is_pwa: true, is_native: false };
                }
                let osName = 'Desktop (PWA)';
                if (isWindows) osName = 'Windows (PWA)';
                else if (isMac) osName = 'macOS (PWA)';
                else if (isLinux) osName = 'Linux (PWA)';
                return { device: 'pwa_desktop', os: osName, is_pwa: true, is_native: false };
            }

            // 3. Navigation Web classique
            const w = Number(window.innerWidth || 0);
            const isMobileWidth = w > 0 && w < 1024;
            if (isIos || isAndroid || isMobileWidth) {
                const osName = isIos ? 'iOS (Web)' : (isAndroid ? 'Android (Web)' : 'Mobile (Web)');
                return { device: 'web_mobile', os: osName, is_pwa: false, is_native: false };
            }

            let osName = 'Web (Desktop)';
            if (isWindows) osName = 'Windows (Web)';
            else if (isMac) osName = 'macOS (Web)';
            else if (isLinux) osName = 'Linux (Web)';
            return { device: 'web_desktop', os: osName, is_pwa: false, is_native: false };
        } catch (_) {
            return { device: 'unknown', os: 'Inconnu', is_pwa: false, is_native: false };
        }
    },

    _getDeviceLabel() {
        return this._getPlatformAndDevice().device;
    },

    _getUtmParams() {
        try {
            const url = new URL(window.location.href);
            const params = url.searchParams;
            const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
            const utm = {};
            keys.forEach((k) => {
                const v = params.get(k);
                if (v) utm[k] = String(v).slice(0, 120);
            });
            return utm;
        } catch (_) {
            return {};
        }
    },

    _getBaseMetadata() {
        const now = Date.now();
        if (this._baseMetaCache && now - this._baseMetaCacheTs < 30_000) {
            return this._baseMetaCache;
        }

        let tz = null;
        let lang = null;
        let pwa = false;
        try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
        } catch (_) {}
        try {
            lang = navigator.language || null;
        } catch (_) {}
        try {
            pwa = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        } catch (_) {}

        const pd = this._getPlatformAndDevice();
        const meta = {
            device: pd.device,
            device_os: pd.os,
            is_native: pd.is_native,
            viewport_w: Number(window.innerWidth || 0) || null,
            viewport_h: Number(window.innerHeight || 0) || null,
            screen_w: Number(window.screen?.width || 0) || null,
            screen_h: Number(window.screen?.height || 0) || null,
            tz,
            lang,
            pwa: pd.is_pwa || Boolean(pwa),
            is_authenticated: Boolean(window.AuthManager?.user?.id),
            ...this._getUtmParams(),
        };

        this._baseMetaCache = meta;
        this._baseMetaCacheTs = now;
        return meta;
    },

    track(eventType, payload = {}) {
        try {
            const now = Date.now();
            if (this._analyticsDisabled) return;
            if (this._analyticsCooldownUntil && now < this._analyticsCooldownUntil) return;

            const mergedMeta = {
                ...this._getBaseMetadata(),
                ...(payload.metadata || {}),
            };

            // Empiler l'event dans la queue — pas d'envoi immédiat
            this._queue.push({
                event_type: eventType,
                session_id: this.getOrCreateSessionId(),
                path: `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`,
                page_title: payload.page_title || document.title || null,
                target: payload.target || null,
                active_ms: payload.active_ms || null,
                metadata: mergedMeta,
                user_role: window.AuthManager?.role || localStorage.getItem('newketRole') || 'guest',
            });

            // Flush immédiat si la queue est pleine
            if (this._queue.length >= this._FLUSH_BATCH_SIZE) {
                this._flush();
            }

            try {
                window.NewKetGoogleAnalytics?.trackBehaviorEvent?.(eventType, payload, mergedMeta);
            } catch (_) {}
        } catch (_) {}
    },

    // Démarre le timer de flush périodique (toutes les 30s)
    _startFlushTimer() {
        if (this._flushTimer) return;
        this._flushTimer = setInterval(() => {
            this._flush();
        }, this._FLUSH_INTERVAL_MS);
    },

    // Écoute la fermeture / mise en arrière-plan de la page
    // sendBeacon est garanti même si la page se ferme — pas de perte d'events
    _bindPageExit() {
        const onExit = () => this._flushBeacon();

        try {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this._flushBeacon();
                }
            });
            window.addEventListener('beforeunload', onExit);
            window.addEventListener('pagehide', onExit);
        } catch (_) {}
    },

    // Flush via fetch (normal, mid-session)
    _flush() {
        try {
            if (this._analyticsDisabled) { this._queue = []; return; }
            if (this._queue.length === 0) return;
            if (this._analyticsCooldownUntil && Date.now() < this._analyticsCooldownUntil) {
                this._queue = []; // vider la queue pendant le cooldown
                return;
            }

            const batch = this._queue.splice(0, 25); // max 25 par batch

            window.ApiClient.post('/analytics/events/batch', { events: batch }, {
                suppressErrorLogging: true,
                suppressToast: true,
            }).catch((err) => {
                const status = Number(err?.status || err?.data?.status || 0);
                if (status === 429) {
                    this._analyticsCooldownUntil = Date.now() + (15 * 60 * 1000);
                    return;
                }
                // Si la route batch n'existe pas (vieux backend), fallback sur l'ancien endpoint
                if (status === 404 || status === 405) {
                    this._flushLegacy(batch);
                    return;
                }
                if (status === 501) {
                    this._analyticsDisabled = true;
                }
            });
        } catch (_) {}
    },

    // Flush via sendBeacon (fermeture de page — fire & forget garanti par le browser)
    _flushBeacon() {
        try {
            if (this._analyticsDisabled) { this._queue = []; return; }
            if (this._queue.length === 0) return;

            const batch = this._queue.splice(0, 25);
            const url = '/api/analytics/events/batch';
            const data = JSON.stringify({ events: batch });

            if (navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
            } else {
                // Fallback si sendBeacon non dispo (très rare)
                this._flushLegacy(batch);
            }
        } catch (_) {}
    },

    // Fallback : envoie les events 1 par 1 via l'ancien endpoint (vieux backend sans /batch)
    _flushLegacy(events) {
        try {
            if (!Array.isArray(events) || events.length === 0) return;
            const ev = events[0]; // envoyer seulement le premier pour pas spammer
            window.ApiClient.post('/analytics/events', ev, {
                suppressErrorLogging: true,
                suppressToast: true,
            }).catch(() => {});
        } catch (_) {}
    },

    _isEmbeddedAdmin() {
        try {
            return new URL(window.location.href).searchParams.get('embedded') === '1';
        } catch (_) {
            return false;
        }
    },

    _isAdminArea() {
        try {
            const path = String(window.location.pathname || '');
            if (path.includes('/admin/')) return true;
            if (path.includes('/admin/')) return true;
        } catch (_) {}

        try {
            const role = window.AuthManager?.role || localStorage.getItem('newketRole');
            // Only skip tracking for admin role when browsing admin pages.
            if (role === 'admin') {
                const path = String(window.location.pathname || '');
                if (path.includes('/admin/') || path.includes('/admin/')) return true;
            }
        } catch (_) {}

        return false;
    },

    _describeTarget(target) {
        const explicit = target.getAttribute('data-track-action')
            || target.getAttribute('aria-label')
            || target.getAttribute('title')
            || target.id;
        const text = explicit || target.textContent || target.getAttribute('href') || target.tagName;
        return String(text).trim().replace(/\s+/g, ' ').slice(0, 180) || null;
    }
};

window.BehaviorTracking = BehaviorTracking;
