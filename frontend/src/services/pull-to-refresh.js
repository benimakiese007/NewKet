const PTR_MIN_TOUCH_WIDTH = 1024;
const PTR_TRIGGER_DISTANCE = 80;
const PTR_MAX_PULL_DISTANCE = 110;
const PTR_MAX_TRANSLATE = 60;

const PullToRefresh = {
    state: {
        refreshing: false,
        pulling: false,
        armed: false,
        startY: 0,
        surface: null,
        indicator: null,
        label: null,
        spinner: null
    },

    init() {
        if (document.body?.dataset.ptrInitialized === '1') return;
        document.body.dataset.ptrInitialized = '1';

        this.injectStyles();
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
                top: 16px;
                left: 50%;
                z-index: 1300;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 20px;
                border-radius: 24px;
                
                /* Glassmorphism */
                background: rgba(255, 255, 255, 0.7);
                backdrop-filter: blur(16px) saturate(180%);
                -webkit-backdrop-filter: blur(16px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.4);
                
                box-shadow: 
                    0 4px 6px -1px rgba(0, 0, 0, 0.05),
                    0 10px 30px -5px rgba(0, 0, 0, 0.1),
                    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
                
                color: #000;
                transform: translate(-50%, -100px);
                opacity: 0;
                pointer-events: none;
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
                will-change: transform, opacity;
            }

            .nk-ptr-indicator.is-visible {
                opacity: 1;
                transform: translate(-50%, 0);
            }

            .nk-ptr-spinner-container {
                position: relative;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .nk-ptr-spinner {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                border: 2px solid rgba(0, 0, 0, 0.05);
                border-top-color: #000;
                transform: rotate(0deg);
                transition: transform 0.1s linear;
            }

            .nk-ptr-indicator.is-refreshing .nk-ptr-spinner {
                animation: nk-ptr-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }

            .nk-ptr-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                white-space: nowrap;
                color: #000;
                opacity: 0.8;
            }

            @keyframes nk-ptr-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Dark mode support */
            html.dark .nk-ptr-indicator {
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                color: #fff;
            }
            html.dark .nk-ptr-label { color: #fff; }
            html.dark .nk-ptr-spinner { border-color: rgba(255, 255, 255, 0.1); border-top-color: #fff; }
        `;

        document.head.appendChild(style);
    },

    createIndicator() {
        if (this.state.indicator) return;

        const indicator = document.createElement('div');
        indicator.className = 'nk-ptr-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.innerHTML = `
            <div class="nk-ptr-spinner-container">
                <div class="nk-ptr-spinner"></div>
            </div>
            <span class="nk-ptr-label">Mise à jour...</span>
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

        // Apply resistance and limit pull distance
        const pullDistance = Math.min(PTR_MAX_PULL_DISTANCE, deltaY * 0.4);
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
        
        // Elastic translation for the main surface
        if (this.state.surface) {
            const surfaceTranslate = Math.round(progress * PTR_MAX_TRANSLATE);
            this.state.surface.style.transition = 'none';
            this.state.surface.style.transform = `translateY(${surfaceTranslate}px)`;
        }

        if (this.state.indicator) {
            this.state.indicator.classList.add('is-visible');
            this.state.indicator.classList.remove('is-refreshing');
            
            // The pill slides down from the top
            const pillTranslate = Math.min(70, Math.round(progress * 80));
            this.state.indicator.style.transform = `translate(-50%, ${pillTranslate - 50}px)`;
        }

        if (this.state.label) {
            this.state.label.textContent = this.state.armed ? 'Relâcher' : 'Tirer';
        }

        if (this.state.spinner) {
            this.state.spinner.style.transform = `rotate(${Math.round(progress * 180)}deg)`;
        }
    },

    async startRefresh() {
        this.state.refreshing = true;

        if (this.state.indicator) {
            this.state.indicator.classList.add('is-visible', 'is-refreshing');
            // Pin the pill in its "refreshing" position
            this.state.indicator.style.transform = `translate(-50%, 25px)`;
        }

        if (this.state.label) {
            this.state.label.textContent = 'Actualisation...';
        }

        if (this.state.surface) {
            this.state.surface.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)';
            this.state.surface.style.transform = `translateY(${PTR_MAX_TRANSLATE}px)`;
        }

        try {
            await window.NewKetPageRefresh();
        } catch (error) {
            console.error('[NewKet PTR] Refresh failed:', error);
        } finally {
            window.setTimeout(() => {
                this.state.refreshing = false;
                this.resetVisuals();
            }, 1000); // Minimum duration for the animation to feel premium
        }
    },

    resetPullState() {
        this.state.pulling = false;
        this.state.armed = false;
    },

    resetVisuals() {
        if (this.state.surface) {
            this.state.surface.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0, 1)';
            this.state.surface.style.transform = 'translateY(0)';
        }

        if (this.state.indicator) {
            this.state.indicator.classList.remove('is-visible', 'is-refreshing');
            this.state.indicator.style.transform = 'translate(-50%, -100px)';
        }

        window.setTimeout(() => {
            if (!this.state.pulling && !this.state.refreshing && this.state.surface) {
                this.state.surface.style.transition = '';
            }
        }, 500);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PullToRefresh.init(), { once: true });
} else {
    PullToRefresh.init();
}

window.NewKetPullToRefresh = PullToRefresh;
