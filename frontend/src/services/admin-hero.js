import HeroContentManager from './hero-content-manager.js';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from './ui-helpers.js';

function $(id) { return document.getElementById(id); }

function showSaved() {
    const el = $('heroSaveStatus');
    if (!el) return;
    el.classList.remove('hidden');
    clearTimeout(window.__heroSaveStatusTimer);
    window.__heroSaveStatusTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function sanitizePathSegment(name) {
    return String(name || '')
        .trim()
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'image';
}

function makeSlideRow(slide, index, total) {
    const img = getOptimizedImageUrl(slide.imageUrl || '');
    const imgSrcSet = buildResponsiveImageSrcSet(slide.imageUrl || '', [120, 180, 240], { quality: 75 });
    const overlay = typeof slide.overlay === 'number' ? slide.overlay : 0.4;

    const disabledUp = index === 0 ? 'disabled opacity-40 cursor-not-allowed' : '';
    const disabledDown = index === total - 1 ? 'disabled opacity-40 cursor-not-allowed' : '';

    return `
        <div class="p-5 rounded-3xl bg-white border border-gray-100 shadow-sm space-y-4" data-slide-index="${index}">
            <div class="flex items-center gap-4">
                <div class="w-20 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 flex-shrink-0">
                    <img src="${img}"${imgSrcSet ? ` srcset="${imgSrcSet}" sizes="80px"` : ''} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" crossorigin="anonymous">
                </div>
                <div class="flex-1 min-w-0 space-y-2">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input data-field="imageUrl" type="text"
                            class="md:col-span-2 w-full px-5 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-black transition-all font-mono text-xs"
                            placeholder="URL ou chemin Supabase (site-assets/hero/...)"
                            value="${(slide.imageUrl || '').replace(/\"/g, '&quot;')}">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-400">Overlay</span>
                            <input data-field="overlay" type="number" step="0.05" min="0" max="0.85"
                                class="w-full px-4 py-3 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-black transition-all font-bold text-xs"
                                value="${overlay}">
                        </div>
                    </div>
                    <input data-field="upload" type="file" accept="image/png,image/jpeg,image/webp"
                        class="w-full px-5 py-3 rounded-2xl bg-gray-50 border-none outline-none font-bold text-xs">
                </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <button type="button" data-action="up" ${disabledUp}
                        class="px-4 py-2 rounded-2xl bg-white border border-gray-100 text-gray-800 font-black tracking-tight hover:bg-gray-50 transition-all text-xs">
                        ↑
                    </button>
                    <button type="button" data-action="down" ${disabledDown}
                        class="px-4 py-2 rounded-2xl bg-white border border-gray-100 text-gray-800 font-black tracking-tight hover:bg-gray-50 transition-all text-xs">
                        ↓
                    </button>
                </div>
                <button type="button" data-action="delete"
                    class="px-4 py-2 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 font-black tracking-tight hover:bg-rose-100 transition-all text-xs">
                    Supprimer
                </button>
            </div>
        </div>
    `;
}

function readFormIntoConfig(currentConfig, slides) {
    const slideIntervalSecondsRaw = Number($('heroSlideIntervalSecondsInput')?.value);
    const slideIntervalSeconds = Number.isFinite(slideIntervalSecondsRaw)
        ? Math.min(31536000, Math.max(2, slideIntervalSecondsRaw))
        : 5;

    const content = {
        titleLine1: ($('heroTitleLine1Input')?.value || '').trim(),
        titleLine2: ($('heroTitleLine2Input')?.value || '').trim(),
        description: ($('heroDescriptionInput')?.value || '').trim(),
        primaryCta: {
            label: ($('heroPrimaryCtaLabel')?.value || '').trim(),
            href: ($('heroPrimaryCtaHref')?.value || '').trim()
        },
        secondaryCta: {
            prefix: ($('heroSecondaryCtaPrefixInput')?.value || '').trim(),
            label: ($('heroSecondaryCtaLabel')?.value || '').trim(),
            href: ($('heroSecondaryCtaHref')?.value || '').trim()
        },
        promo: {
            headline: ($('heroPromoHeadlineInput')?.value || '').trim(),
            caption: ($('heroPromoCaptionInput')?.value || '').trim(),
            code: ($('heroPromoCodeInput')?.value || '').trim()
        },
        slideIntervalSeconds
    };

    return {
        id: currentConfig?.id || 'homepage-hero',
        slides,
        content
    };
}

function getSlidesFromDom() {
    const container = $('heroSlidesList');
    if (!container) return [];
    const rows = Array.from(container.querySelectorAll('[data-slide-index]'));
    return rows.map(row => {
        const imageUrl = row.querySelector('[data-field="imageUrl"]')?.value?.trim() || '';
        const overlay = Number(row.querySelector('[data-field="overlay"]')?.value);
        return {
            imageUrl,
            overlay: Number.isFinite(overlay) ? overlay : 0.4
        };
    });
}

async function render(config) {
    $('heroTitleLine1Input').value = config?.content?.titleLine1 || '';
    $('heroTitleLine2Input').value = config?.content?.titleLine2 || '';
    $('heroDescriptionInput').value = config?.content?.description || '';
    $('heroPrimaryCtaLabel').value = config?.content?.primaryCta?.label || '';
    $('heroPrimaryCtaHref').value = config?.content?.primaryCta?.href || '';
    $('heroSecondaryCtaPrefixInput').value = config?.content?.secondaryCta?.prefix || '';
    $('heroSecondaryCtaLabel').value = config?.content?.secondaryCta?.label || '';
    $('heroSecondaryCtaHref').value = config?.content?.secondaryCta?.href || '';
    $('heroPromoHeadlineInput').value = config?.content?.promo?.headline || '';
    $('heroPromoCaptionInput').value = config?.content?.promo?.caption || '';
    $('heroPromoCodeInput').value = config?.content?.promo?.code || '';
    $('heroSlideIntervalSecondsInput').value = config?.content?.slideIntervalSeconds || 5;

    const slides = Array.isArray(config?.slides) ? config.slides : [];
    const list = $('heroSlidesList');
    if (list) {
        list.innerHTML = slides.map((s, i) => makeSlideRow(s, i, slides.length)).join('');
    }
}

function bindSlideEvents() {
    const list = $('heroSlidesList');
    if (!list) return;

    list.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('button[data-action]');
        if (!btn) return;
        const row = btn.closest('[data-slide-index]');
        if (!row) return;
        const idx = Number(row.dataset.slideIndex);
        if (!Number.isFinite(idx)) return;

        const slides = getSlidesFromDom();
        const action = btn.dataset.action;
        if (action === 'delete') {
            slides.splice(idx, 1);
        } else if (action === 'up' && idx > 0) {
            const tmp = slides[idx - 1];
            slides[idx - 1] = slides[idx];
            slides[idx] = tmp;
        } else if (action === 'down' && idx < slides.length - 1) {
            const tmp = slides[idx + 1];
            slides[idx + 1] = slides[idx];
            slides[idx] = tmp;
        } else {
            return;
        }

        render(readFormIntoConfig(HeroContentManager.getConfig(), slides));
    });

    list.addEventListener('change', async (e) => {
        const input = e.target;
        if (!input || input.getAttribute('data-field') !== 'upload') return;
        const row = input.closest('[data-slide-index]');
        if (!row) return;

        const file = input.files && input.files[0];
        if (!file) return;

        if (!window.SupabaseAdapter) {
            alert("SupabaseAdapter indisponible. Impossible d'uploader.");
            return;
        }

        const base = sanitizePathSegment(file.name);
        const path = `hero/${Date.now()}-${base}`;
        const publicUrl = await window.SupabaseAdapter.uploadFile('site-assets', path, file);

        if (!publicUrl) {
            const err = window.SupabaseAdapter.getLastUploadError?.() || null;
            const msg = window.SupabaseAdapter.getReadableUploadError ? window.SupabaseAdapter.getReadableUploadError(err) : "Erreur lors de l'upload.";
            alert(msg);
            return;
        }

        const urlInput = row.querySelector('[data-field="imageUrl"]');
        if (urlInput) urlInput.value = publicUrl;

        // Refresh preview quickly
        const imgEl = row.querySelector('img');
        if (imgEl) {
            imgEl.src = getOptimizedImageUrl(publicUrl, { width: 180, quality: 75 });
            if (buildResponsiveImageSrcSet) {
                imgEl.srcset = buildResponsiveImageSrcSet(publicUrl, [120, 180, 240], { quality: 75 });
                imgEl.sizes = '80px';
            }
        }
    });
}

async function boot() {
    if (!window.HeroContentManager) return;
    const config = await HeroContentManager.init({ force: true });
    await render(config);
    bindSlideEvents();

    $('heroAddSlideBtn')?.addEventListener('click', () => {
        const slides = getSlidesFromDom();
        slides.push({ imageUrl: '', overlay: 0.4 });
        render(readFormIntoConfig(HeroContentManager.getConfig(), slides));
    });

    $('heroReloadBtn')?.addEventListener('click', async () => {
        const fresh = await HeroContentManager.init({ force: true });
        await render(fresh);
    });

    $('heroSaveBtn')?.addEventListener('click', async () => {
        const slides = getSlidesFromDom().filter(s => !!(s.imageUrl || '').trim());
        const next = readFormIntoConfig(HeroContentManager.getConfig(), slides);
        const ok = await HeroContentManager.saveConfig(next);
        if (ok) showSaved();
        else alert("Erreur lors de l'enregistrement.");
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
