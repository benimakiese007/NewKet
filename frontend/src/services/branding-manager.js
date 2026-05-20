// branding-manager.js - Applies site-wide branding (colors, fonts, icons) from ConfigManager

function clamp(num, min, max) {
    return Math.min(max, Math.max(min, num));
}

function normalizeHex(color) {
    const raw = String(color || '').trim();
    if (!raw) return '';
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
        return '#' + raw.slice(1).split('').map((c) => c + c).join('').toLowerCase();
    }
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    return raw; // allow rgb()/hsl()/var(...)
}

function hexToRgb(hex) {
    const h = normalizeHex(hex);
    if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
    return {
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16),
    };
}

function rgbToHex({ r, g, b }) {
    const toHex = (v) => clamp(v, 0, 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function adjustHex(hex, amount) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '';
    return rgbToHex({
        r: rgb.r + amount,
        g: rgb.g + amount,
        b: rgb.b + amount,
    });
}

function upsertLink({ rel, sizes, type, href }) {
    if (!href) return;
    const selector = sizes
        ? `link[rel="${rel}"][sizes="${sizes}"]`
        : `link[rel="${rel}"]`;
    let link = document.head.querySelector(selector);
    if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        if (sizes) link.sizes = sizes;
        if (type) link.type = type;
        document.head.appendChild(link);
    }
    link.href = href;
}

function upsertMeta(name, content) {
    if (!content) return;
    let meta = document.head.querySelector(`meta[name="${name}"]`);
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
    }
    meta.content = content;
}

const BrandingManager = {
    apply(config) {
        const root = document.documentElement;
        if (!root || !config) return;

        const primary = normalizeHex(config.primaryColor) || '#050505';
        const secondary = normalizeHex(config.secondaryColor) || '#121212';
        const headerBg = normalizeHex(config.headerBg) || '#013220';
        const headerFg = normalizeHex(config.headerFg) || '#ffffff';
        const footerBg = normalizeHex(config.footerBg) || '#013220';
        const footerFg = normalizeHex(config.footerFg) || '#ffffff';
        const themeColor = normalizeHex(config.themeColor) || normalizeHex(headerBg) || '#064734';

        // Colors (existing CSS variables)
        root.style.setProperty('--primary-color', primary);
        root.style.setProperty('--secondary-color', secondary);
        root.style.setProperty('--primary-hover', normalizeHex(config.primaryHover) || adjustHex(primary, 24) || '#1a1a1a');

        // Header/Footer variables (consumed by CSS + components)
        root.style.setProperty('--newket-header-bg', headerBg);
        root.style.setProperty('--newket-header-fg', headerFg);
        root.style.setProperty('--newket-footer-bg', footerBg);
        root.style.setProperty('--newket-footer-fg', footerFg);

        // Typography
        if (config.fontHeading) root.style.setProperty('--font-heading', String(config.fontHeading));
        if (config.fontBody) root.style.setProperty('--font-body', String(config.fontBody));

        // Theme color (PWA + browser UI)
        upsertMeta('theme-color', themeColor);

        // Manifest: point to dynamic manifest endpoint (skip file:// protocol)
        if (window.location && window.location.protocol !== 'file:') {
            upsertLink({ rel: 'manifest', href: '/api/manifest' });
        }

        // Icons
        const faviconUrl = String(config.faviconUrl || '').trim();
        if (faviconUrl) {
            upsertLink({ rel: 'icon', type: 'image/png', sizes: '32x32', href: faviconUrl });
            upsertLink({ rel: 'icon', type: 'image/png', sizes: '16x16', href: faviconUrl });
            upsertLink({ rel: 'shortcut icon', href: faviconUrl });
        }

        const appleTouchIconUrl = String(config.appleTouchIconUrl || '').trim();
        if (appleTouchIconUrl) {
            upsertLink({ rel: 'apple-touch-icon', sizes: '512x512', href: appleTouchIconUrl });
        }

        // Logos in header/footer components
        const headerLogoUrl = String(config.headerLogoUrl || '').trim();
        if (headerLogoUrl) {
            document.querySelectorAll('[data-site-logo="header"]').forEach((img) => {
                if (img && img.tagName === 'IMG') img.src = headerLogoUrl;
            });
        }
        const footerLogoUrl = String(config.footerLogoUrl || '').trim();
        if (footerLogoUrl) {
            document.querySelectorAll('[data-site-logo="footer"]').forEach((img) => {
                if (img && img.tagName === 'IMG') img.src = footerLogoUrl;
            });
        }
    },

    init() {
        try {
            if (window.ConfigManager && typeof window.ConfigManager.getConfig === 'function') {
                this.apply(window.ConfigManager.getConfig());
            }
        } catch (_) {}

        window.addEventListener('configUpdated', (event) => {
            this.apply(event?.detail || window.ConfigManager?.getConfig?.());
        });
    }
};

window.BrandingManager = BrandingManager;
BrandingManager.init();
