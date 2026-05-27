import HeroContentManager from './hero-content-manager.js';

function setText(el, text) {
    if (!el) return;
    el.textContent = text || '';
}

function setLink(el, label, href) {
    if (!el) return;
    if (label != null) el.textContent = label || '';
    if (href != null) el.setAttribute('href', href || '#');
}

function renderHero(config) {
    const heroSection = document.getElementById('heroSection');
    if (!heroSection) return;

    const slider = document.getElementById('heroSlider');
    const slides = Array.isArray(config?.slides) ? config.slides.slice(0, 2) : [];
    if (slider && slides.length > 0) {
        const isMobile = window.matchMedia?.('(max-width: 768px)')?.matches;
        const mobileFallback = '/Images/What-is-a-online-marketplace-services.webp';
        slider.innerHTML = slides.map((s, idx) => {
            const overlay = typeof s.overlay === 'number' ? s.overlay : 0.4;
            const imageUrl = idx === 0 && isMobile ? mobileFallback : (s.imageUrl || '');
            const active = idx === 0 ? ' active' : '';
            const bg = `linear-gradient(rgba(0, 0, 0, ${overlay}), rgba(0, 0, 0, ${overlay})), url('${imageUrl.replace(/'/g, '\\\'')}')`;
            return `<div class="hero-slide${active}" style="background-image: ${bg};"></div>`;
        }).join('');
    }

    const c = config?.content || {};
    setText(document.getElementById('heroTitleLine1'), c.titleLine1);
    setText(document.getElementById('heroTitleLine2'), c.titleLine2);
    setText(document.getElementById('heroDescription'), c.description);
    setLink(document.getElementById('heroPrimaryCta'), c?.primaryCta?.label, c?.primaryCta?.href);
    setLink(document.getElementById('heroSecondaryCta'), c?.secondaryCta?.label, c?.secondaryCta?.href);

    setText(document.getElementById('heroPromoHeadline'), c?.promo?.headline);
    setText(document.getElementById('heroPromoCaption'), c?.promo?.caption);
    const promoCodeEl = document.getElementById('heroPromoCode');
    if (promoCodeEl) promoCodeEl.textContent = c?.promo?.code ? `Code: ${c.promo.code}` : '';

    if (window.HeroSlider && typeof window.HeroSlider.init === 'function') {
        // Re-init after we injected slides
        window.HeroSlider.init();
    }
}

async function boot() {
    if (!document.getElementById('heroSection')) return;
    // Render immediately from defaults/local cache so the hero is visible
    // without waiting for the remote fetch path.
    renderHero(HeroContentManager.getConfig());

    HeroContentManager.init()
        .then((config) => renderHero(config))
        .catch((err) => {
            console.warn('[NewKet Home] Hero config init failed:', err?.message || err);
        });

    window.addEventListener('heroContentUpdated', (e) => {
        if (e?.detail) renderHero(e.detail);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
