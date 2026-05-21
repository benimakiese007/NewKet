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
    if (slider && Array.isArray(config?.slides)) {
        slider.innerHTML = config.slides.map((s, idx) => {
            const overlay = typeof s.overlay === 'number' ? s.overlay : 0.4;
            const imageUrl = s.imageUrl || '';
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
    const config = await HeroContentManager.init();
    renderHero(config);

    window.addEventListener('heroContentUpdated', (e) => {
        if (e?.detail) renderHero(e.detail);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}

