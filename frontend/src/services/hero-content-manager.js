/**
 * HeroContentManager - Homepage HERO (slides + copy)
 * Stores/loads configuration from Supabase table `hero_content` (row: `homepage-hero`).
 */

const HERO_ROW_ID = 'homepage-hero';
const HERO_LOCAL_KEY = 'newket_homepage_hero_content_v1';
const HERO_LOCAL_TIME_KEY = 'newket_homepage_hero_content_time_v1';
const HERO_DEFAULT_SWITCH_INTERVAL_SECONDS = 5;
const HERO_PUBLIC_IMAGE_MAP = {
    'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572394/newket_assets/frontend/src/assets/Images/marketplace-hero.jpg': 'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572394/newket_assets/frontend/src/assets/Images/marketplace-hero.jpg',
    'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572388/newket_assets/frontend/src/assets/Images/hero-black-friday.png': 'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572388/newket_assets/frontend/src/assets/Images/hero-black-friday.png',
    'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572386/newket_assets/frontend/src/assets/Images/hero-bf-definition.webp': 'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v1782572386/newket_assets/frontend/src/assets/Images/hero-bf-definition.webp'
};

function nowIso() {
    return new Date().toISOString();
}

function safeString(v) {
    return typeof v === 'string' ? v : (v == null ? '' : String(v));
}

function clampNumber(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function normalizeHeroImageUrl(value) {
    const raw = safeString(value).trim();
    if (!raw) return '';

    const match = raw.match(/([^/?#]+)$/);
    const fileName = match ? match[1] : '';
    if (fileName && HERO_PUBLIC_IMAGE_MAP[fileName]) {
        return HERO_PUBLIC_IMAGE_MAP[fileName];
    }

    return raw;
}

const HeroContentManager = {
    defaults: {
        id: HERO_ROW_ID,
        slides: [],
        content: {
            titleLine1: 'SUBTILE',
            titleLine2: 'ÉLÉGANCE.',
            description: "L'excellence du luxe à portée de main. Découvrez une sélection curatée des plus belles pièces du moment.",
            primaryCta: { label: 'Découvrir', href: '/src/pages/catalog.html' },
            secondaryCta: { label: 'Vendre', href: '/src/pages/publish.html' },
            slideIntervalSeconds: HERO_DEFAULT_SWITCH_INTERVAL_SECONDS,
            promo: { headline: '-50%', caption: 'Sélection Premium', code: 'NEWKET50' }
        }
    },

    _config: null,
    _fetchPromise: null,

    _normalize(raw) {
        const base = this.defaults;
        const slides = Array.isArray(raw?.slides) ? raw.slides : [];
        const content = raw?.content && typeof raw.content === 'object' ? raw.content : {};

        const normalizedSlides = slides
            .filter(s => s && typeof s === 'object')
            .map(s => ({
                imageUrl: normalizeHeroImageUrl(s.imageUrl || s.url || ''),
                overlay: clampNumber(s.overlay, 0, 0.85, 0.4)
            }))
            .filter(s => !!s.imageUrl);

        const primaryCta = content.primaryCta && typeof content.primaryCta === 'object' ? content.primaryCta : {};
        const secondaryCta = content.secondaryCta && typeof content.secondaryCta === 'object' ? content.secondaryCta : {};
        const promo = content.promo && typeof content.promo === 'object' ? content.promo : {};
        const slideIntervalSeconds = clampNumber(
            content.slideIntervalSeconds ?? raw?.slideIntervalSeconds,
            2, 31536000, HERO_DEFAULT_SWITCH_INTERVAL_SECONDS
        );

        return {
            id: safeString(raw?.id || HERO_ROW_ID) || HERO_ROW_ID,
            slides: normalizedSlides,
            content: {
                titleLine1: safeString(content.titleLine1 || base.content.titleLine1),
                titleLine2: safeString(content.titleLine2 || base.content.titleLine2),
                description: safeString(content.description || base.content.description),
                primaryCta: {
                    label: safeString(primaryCta.label || base.content.primaryCta.label),
                    href: safeString(primaryCta.href || base.content.primaryCta.href)
                },
                secondaryCta: {
                    prefix: safeString(secondaryCta.prefix || base.content.secondaryCta.prefix || 'Vous possédez une pièce rare ?'),
                    label: safeString(secondaryCta.label || base.content.secondaryCta.label),
                    href: safeString(secondaryCta.href || base.content.secondaryCta.href)
                },
                promo: {
                    headline: safeString(promo.headline || base.content.promo.headline),
                    caption: safeString(promo.caption || base.content.promo.caption),
                    code: safeString(promo.code || base.content.promo.code)
                },
                slideIntervalSeconds
            }
        };
    },

    _loadLocal() {
        try {
            const raw = localStorage.getItem(HERO_LOCAL_KEY);
            if (!raw) return null;
            return this._normalize(JSON.parse(raw));
        } catch (_) {
            return null;
        }
    },

    _saveLocal(config) {
        try {
            localStorage.setItem(HERO_LOCAL_KEY, JSON.stringify(config));
            localStorage.setItem(HERO_LOCAL_TIME_KEY, Date.now().toString());
        } catch (_) {}
    },

    getConfig() {
        return this._config || this._loadLocal() || this.defaults;
    },

    async init(options = {}) {
        const { force = false } = options;

        if (this._config && !force) return this._config;
        if (this._fetchPromise) return this._fetchPromise;

        const cached = this._loadLocal();
        if (cached && !force) this._config = cached;

        const CACHE_DURATION = 1000 * 60 * 30; // 30 min
        const lastFetch = parseInt(localStorage.getItem(HERO_LOCAL_TIME_KEY) || '0', 10);
        const cacheExpired = !lastFetch || (Date.now() - lastFetch > CACHE_DURATION);

        if (!window.SupabaseAdapter || (!cacheExpired && cached && !force)) {
            this._config = this.getConfig();
            return this._config;
        }

        this._fetchPromise = (async () => {
            try {
                const fetchOptions = { eq: [['id', HERO_ROW_ID]], limit: 1, timeout: 3000, suppressToast: true };
                const rows = await window.SupabaseAdapter.fetchWithFilters
                    ? await window.SupabaseAdapter.fetchWithFilters('hero_content', fetchOptions)
                    : await window.SupabaseAdapter.fetch('hero_content', fetchOptions);

                const row = Array.isArray(rows)
                    ? (rows.find(r => r?.id === HERO_ROW_ID) || rows[0])
                    : null;

                if (row) {
                    const normalized = this._normalize(row);
                    this._config = normalized;
                    this._saveLocal(normalized);
                    window.dispatchEvent(new CustomEvent('heroContentUpdated', { detail: normalized }));
                    return normalized;
                }
            } catch (err) {
                console.warn('[NewKet] Failed to fetch hero_content from Supabase:', err);
            }

            const fallback = this.getConfig();
            this._config = fallback;
            return fallback;
        })();

        try {
            return await this._fetchPromise;
        } finally {
            this._fetchPromise = null;
        }
    },

    async saveConfig(nextConfig) {
        const normalized = this._normalize(nextConfig);
        normalized.updated_at = nowIso();

        this._config = normalized;
        this._saveLocal(normalized);
        window.dispatchEvent(new CustomEvent('heroContentUpdated', { detail: normalized }));

        if (!window.SupabaseAdapter) return true;

        try {
            const existing = await window.SupabaseAdapter.fetchWithFilters
                ? await window.SupabaseAdapter.fetchWithFilters('hero_content', { eq: [['id', HERO_ROW_ID]], limit: 1 })
                : await window.SupabaseAdapter.fetch('hero_content');

            const row = Array.isArray(existing)
                ? (existing.find(r => r?.id === HERO_ROW_ID) || null)
                : null;

            const payload = {
                id: HERO_ROW_ID,
                updated_at: normalized.updated_at,
                slides: normalized.slides,
                content: normalized.content
            };

            if (row) {
                await window.SupabaseAdapter.update('hero_content', HERO_ROW_ID, payload);
            } else {
                await window.SupabaseAdapter.insert('hero_content', payload);
            }

            return true;
        } catch (err) {
            console.error('[NewKet] Error saving hero_content to Supabase:', err);
            return false;
        }
    }
};

window.HeroContentManager = HeroContentManager;
export default HeroContentManager;
