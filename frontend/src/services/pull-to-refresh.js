const PTR_MIN_TOUCH_WIDTH = 1024;
const PTR_TRIGGER_DISTANCE = 72;
const PTR_MAX_PULL_DISTANCE = 96;
const PTR_MAX_TRANSLATE = 52;

const PullToRefresh = {
    state: {
        refreshing: false,
        pulling: false,
        armed: false,
        startY: 0,
        surface: null,
        indicator: null,
        label: null,
        spinner: null,
        headerLogo: null,
        usingHeaderLogo: false
    },

    init() {
        if (document.body?.dataset.ptrInitialized === '1') return;
        document.body.dataset.ptrInitialized = '1';

        this.injectStyles();
        this.resolveHeaderLogo();
        this.createIndicator();

        document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
        document.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: true });
    },

    injectStyles() {
        if (document.getElementById('nk-ptr-styles')) return;

        const style = document.createElement('style');
        style.id = 'nk-ptr-styles';
        style.textContent = `
            .nk-ptr-indicator {
                position: fixed;
                top: 12px;
                left: 50%;
                z-index: 1300;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 14px;
                border-radius: 999px;
                background: rgba(15, 23, 42, 0.92);
                color: #fff;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
                transform: translate(-50%, calc(-100% - 24px));
                opacity: 0;
                pointer-events: none;
                transition: transform 180ms ease, opacity 180ms ease;
                will-change: transform, opacity;
            }

            .nk-ptr-indicator.is-visible {
                opacity: 1;
                transform: translate(-50%, 0);
            }

            .nk-ptr-spinner {
                width: 18px;
                height: 18px;
                border-radius: 999px;
                border: 2px solid rgba(255, 255, 255, 0.22);
                border-top-color: #ffffff;
                transform: rotate(0deg);
            }

            .nk-ptr-indicator.is-refreshing .nk-ptr-spinner {
                animation: nk-ptr-spin 0.75s linear infinite;
            }

            .nk-ptr-label {
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.02em;
                white-space: nowrap;
            }

            .nk-ptr-logo {
                will-change: transform;
                transform-origin: 50% 50%;
            }

            .nk-ptr-logo.is-refreshing {
                animation: nk-ptr-spin 0.75s linear infinite;
            }

            @keyframes nk-ptr-spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;

        document.head.appendChild(style);
    },

    resolveHeaderLogo() {
        const resolve = () => {
            const logo =
                document.querySelector('img.header-brand-image') ||
                document.querySelector('.main-header img[alt="NewKet"]') ||
                document.querySelector('#header-placeholder img[alt="NewKet"]');

            if (!logo) return;

            this.state.headerLogo = logo;
            this.state.usingHeaderLogo = true;
            logo.classList.add('nk-ptr-logo');

            // If the floating indicator already exists, remove it: user wants only the header logo.
            if (this.state.indicator) {
                this.state.indicator.remove();
                this.state.indicator = null;
                this.state.spinner = null;
                this.state.label = null;
            }
        };

        resolve();
        window.addEventListener('componentsLoaded', resolve, { once: true });
    },

    createIndicator() {
        if (this.state.usingHeaderLogo) return;
        if (this.state.indicator) return;

        const indicator = document.createElement('div');
        indicator.className = 'nk-ptr-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.innerHTML = `
            <span class="nk-ptr-spinner"></span>
            <span class="nk-ptr-label">Tirez pour actualiser</span>
        `;

        document.body.appendChild(indicator);
        this.state.indicator = indicator;
        this.state.spinner = indicator.querySelector('.nk-ptr-spinner');
        this.state.label = indicator.querySelector('.nk-ptr-label');
    },

    isEligibleTouch(event) {
        this.state.surface = document.querySelector('main') || document.body;

        if (typeof window.NewKetPageRefresh !== 'function' || this.state.refreshing) return false;
        if (window.innerWidth > PTR_MIN_TOUCH_WIDTH) return false;
        if (!event.touches || event.touches.length !== 1) return false;
        if (this.isBlockedTarget(event.target)) return false;
        return this.atTop();
    },

    isBlockedTarget(target) {
        const active = document.activeElement;
        if (active) {
            const tag = (active.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable) {
                return true;
            }
        }

        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return true;
        if (document.querySelector('[role="dialog"][aria-hidden="false"], dialog[open], .modal.active, .drawer.active')) return true;
        if (document.body.classList.contains('mobile-menu-open')) return true;

        return false;
    },

    atTop() {
        const scrollRoot = document.scrollingElement || document.documentElement;
        return (scrollRoot?.scrollTop || 0) <= 0 && window.scrollY <= 0;
    },

    onTouchStart(event) {
        if (!this.isEligibleTouch(event)) {
            this.state.pulling = false;
            return;
        }

        this.state.pulling = true;
        this.state.armed = false;
        this.state.startY = event.touches[0].clientY;
    },

    onTouchMove(event) {
        if (!this.state.pulling || this.state.refreshing) return;

        const deltaY = event.touches[0].clientY - this.state.startY;
        if (deltaY <= 0 || !this.atTop()) {
            this.resetPullState();
            this.resetVisuals();
            return;
        }

        const pullDistance = Math.min(PTR_MAX_PULL_DISTANCE, deltaY * 0.55);
        this.state.armed = pullDistance >= PTR_TRIGGER_DISTANCE;
        event.preventDefault();
        this.applyPullVisuals(pullDistance);
    },

    onTouchEnd() {
        if (!this.state.pulling) return;

        const shouldRefresh = this.state.armed && !this.state.refreshing;
        this.resetPullState();

        if (shouldRefresh) {
            this.startRefresh();
            return;
        }

        this.resetVisuals();
    },

    onTouchCancel() {
        this.resetPullState();
        this.resetVisuals();
    },

    applyPullVisuals(pullDistance) {
        const progress = Math.min(1, pullDistance / PTR_TRIGGER_DISTANCE);
        const translate = Math.round(progress * PTR_MAX_TRANSLATE);

        if (this.state.surface) {
            this.state.surface.style.transition = 'none';
            this.state.surface.style.transform = `translateY(${translate}px)`;
        }

        if (this.state.headerLogo) {
            this.state.headerLogo.classList.remove('is-refreshing');
            const logoTranslate = Math.round(progress * 10);
            const logoRotate = Math.round(progress * 140);
            this.state.headerLogo.style.transform = `translateY(${logoTranslate}px) rotate(${logoRotate}deg)`;
        } else if (this.state.indicator) {
            this.state.indicator.classList.add('is-visible');
            this.state.indicator.classList.remove('is-refreshing');
        }

        if (this.state.label) {
            this.state.label.textContent = this.state.armed ? 'Relachez pour actualiser' : 'Tirez pour actualiser';
        }

        if (this.state.spinner) {
            this.state.spinner.style.transform = `rotate(${Math.round(progress * 180)}deg)`;
        }
    },

    async startRefresh() {
        this.state.refreshing = true;

        if (this.state.headerLogo) {
            this.state.headerLogo.classList.add('is-refreshing');
            this.state.headerLogo.style.transform = 'translateY(10px)';
        } else if (this.state.indicator) {
            this.state.indicator.classList.add('is-visible', 'is-refreshing');
        }

        if (this.state.label) {
            this.state.label.textContent = 'Actualisation...';
        }

        if (this.state.surface) {
            this.state.surface.style.transition = 'transform 180ms ease';
            this.state.surface.style.transform = `translateY(${Math.round(PTR_MAX_TRANSLATE * 0.65)}px)`;
        }

        try {
            await window.NewKetPageRefresh();
        } catch (error) {
            console.error('[NewKet PTR] Refresh failed:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Actualisation impossible', 'error');
            }
        } finally {
            window.setTimeout(() => {
                this.state.refreshing = false;
                this.resetVisuals();
            }, 140);
        }
    },

    resetPullState() {
        this.state.pulling = false;
        this.state.armed = false;
    },

    resetVisuals() {
        if (this.state.surface) {
            this.state.surface.style.transition = 'transform 200ms ease';
            this.state.surface.style.transform = 'translateY(0)';
            window.setTimeout(() => {
                if (this.state.surface) {
                    this.state.surface.style.transition = '';
                }
            }, 220);
        }

        if (this.state.indicator) {
            this.state.indicator.classList.remove('is-visible', 'is-refreshing');
        }

        if (this.state.label) {
            this.state.label.textContent = 'Tirez pour actualiser';
        }

        if (this.state.spinner) {
            this.state.spinner.style.transform = 'rotate(0deg)';
        }

        if (this.state.headerLogo) {
            this.state.headerLogo.classList.remove('is-refreshing');
            this.state.headerLogo.style.transform = '';
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PullToRefresh.init(), { once: true });
} else {
    PullToRefresh.init();
}

window.NewKetPullToRefresh = PullToRefresh;
