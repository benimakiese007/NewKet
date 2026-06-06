const DEFAULT_MEASUREMENT_ID = 'G-0XXZ72S2XM';

function isLocalContext() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function normalizeEventName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'newket_event';
}

function sendEvent(eventName, params = {}) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', normalizeEventName(eventName), params);
}

function sendPageView() {
    if (typeof window.gtag !== 'function') return;
    const url = new URL(window.location.href);
    window.gtag('event', 'page_view', {
        page_title: document.title || null,
        page_location: url.toString(),
        page_path: `${url.pathname}${url.search}${url.hash}`,
        page_referrer: document.referrer || null,
    });
}

function isAdminArea() {
    try {
        const path = String(window.location.pathname || '');
        if (path.includes('/src/pages/admin/') || path.includes('/admin/')) return true;
    } catch (_) {}
    return false;
}

function bindAdminDomTracking() {
    if (!isAdminArea()) return;
    if (window.__newketGoogleAnalyticsAdminBound) return;
    window.__newketGoogleAnalyticsAdminBound = true;

    const emit = (target, reason) => {
        if (!target || typeof target.getAttribute !== 'function') return;
        const action = String(target.getAttribute('data-track-action') || '').trim();
        if (!action) return;

        sendEvent(`newket_admin_${normalizeEventName(action)}`, {
            action,
            reason,
            page_title: document.title || null,
            page_path: `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`,
            label: (target.textContent || target.value || target.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 120) || null,
            id: target.id || null,
        });
    };

    document.addEventListener('click', (event) => {
        const target = event.target?.closest?.('[data-track-action]');
        if (!target) return;
        emit(target, 'click');
    }, true);

    document.addEventListener('change', (event) => {
        const target = event.target?.closest?.('[data-track-action]');
        if (!target) return;
        emit(target, 'change');
    }, true);
}

export function initGoogleAnalytics() {
    if (isLocalContext()) return;

    const measurementId = (import.meta?.env?.VITE_GOOGLE_ANALYTICS_ID || DEFAULT_MEASUREMENT_ID).trim();
    if (!measurementId) return;

    if (window.__newketGoogleAnalyticsInitialized) return;
    window.__newketGoogleAnalyticsInitialized = true;

    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
        window.gtag = function gtag() {
            window.dataLayer.push(arguments);
        };
    }

    const existingScript = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`);
    if (!existingScript) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
    }

    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: false });

    window.NewKetGoogleAnalytics = {
        trackEvent: sendEvent,
        trackPageView: sendPageView,
        trackBehaviorEvent(eventType, payload = {}, mergedMeta = {}) {
            const type = normalizeEventName(eventType);
            if (type === 'heartbeat') return;

            if (type === 'page_view') {
                sendPageView();
                return;
            }

            const rawAction = payload?.metadata?.track_action || payload?.target || payload?.page_title || type;
            const actionName = normalizeEventName(rawAction);
            const eventName = (type === 'click' || type === 'admin_action')
                ? `newket_${actionName}`
                : `newket_${type}`;

            sendEvent(eventName, {
                action: type,
                target: payload?.target || null,
                page_title: payload?.page_title || document.title || null,
                page_path: `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`,
                ...mergedMeta,
            });
        }
    };

    sendPageView();
    bindAdminDomTracking();
}
