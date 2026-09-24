const PTR_MIN_TOUCH_WIDTH = 1024;
const PTR_TRIGGER_DISTANCE = 80;
const PTR_MAX_PULL_DISTANCE = 110;
const PTR_MAX_TRANSLATE = 60;

const isNativeCapacitor = () =>
    Boolean(window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() === 'android' || window.Capacitor?.getPlatform?.() === 'ios');

const PullToRefresh = {
    state: {
        refreshing: false,
        pulling: false,
        armed: false,
        startY: 0,
        spinnerAngle: 0,
        wrapper: null,
        indicator: null,
        label: null,
        spinner: null
    },

    init() {
        if (document.body?.dataset.ptrInitialized === '1') return;
        // On native Capacitor (Android/iOS), the OS handles pull-to-refresh natively.
        // We must NOT register non-passive touchmove listeners here — they block the
        // native WebView scroll entirely.
        if (isNativeCapacitor()) return;
        document.body.dataset.ptrInitialized = '1';

        this.injectStyles();
        this.createIndicator();

        // All listeners are passive on web — only touchmove is non-passive to allow
        // preventDefault when the user is clearly doing a pull-down gesture.
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
            /* Fixed at top of viewport — immune to DOM position, overflow:hidden, and z-index of parent containers */
            .nk-ptr-indicator-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                display: flex;
                justify-content: center;
                padding-top: 14px;
                pointer-events: none;
            }

            .nk-ptr-indicator {
                position: relative;
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
                /* Hidden above viewport by default */
                transform: translateY(-60px);
                opacity: 0;
                pointer-events: none;
                will-change: transform, opacity;
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

            /* Spinner animation handled via WAAPI in startRefresh() for smooth transition from pull angle */

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

        const wrapper = document.createElement('div');
        wrapper.className = 'nk-ptr-indicator-wrapper';
        wrapper.id = 'nk-ptr-wrapper';

        const indicator = document.createElement('div');
        indicator.className = 'nk-ptr-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.innerHTML = `
            <div class="nk-ptr-spinner-container">
                <div class="nk-ptr-spinner"></div>
            </div>
            <span class="nk-ptr-label">Mise à jour...</span>
        `;

        wrapper.appendChild(indicator);

        const categoryNav = document.getElementById('category-nav-placeholder');
        const headerPlaceholder = document.getElementById('header-placeholder');
        const main = document.querySelector('main');
        
        if (categoryNav && categoryNav.parentNode) {
            categoryNav.parentNode.insertBefore(wrapper, categoryNav.nextSibling);
        } else if (headerPlaceholder && headerPlaceholder.parentNode) {
            headerPlaceholder.parentNode.insertBefore(wrapper, headerPlaceholder.nextSibling);
        } else if (main && main.parentNode) {
            main.parentNode.insertBefore(wrapper, main);
        } else {
            document.body.prepend(wrapper);
        }

        this.state.wrapper = wrapper;
        this.state.indicator = indicator;
        this.state.spinner = indicator.querySelector('.nk-ptr-spinner');
        this.state.label = indicator.querySelector('.nk-ptr-label');
    },

    isEligibleTouch(event) {

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
            this.state.tracking = false;
            this.state.pulling = false;
            return;
        }

        this.state.tracking = true;
        this.state.pulling = false;
        this.state.armed = false;
        this.state.startY = event.touches[0].clientY;
        this.state.startX = event.touches[0].clientX;
    },

    onTouchMove(event) {
        if (!this.state.tracking || this.state.refreshing) return;

        const currentY = event.touches[0].clientY;
        const currentX = event.touches[0].clientX;
        const deltaY = currentY - this.state.startY;
        const deltaX = Math.abs(currentX - this.state.startX);

        // Determine intent before hijacking touch
        if (!this.state.pulling) {
            // If scrolling up (finger goes up), scrolling horizontally, or no longer at top, abort PTR tracking.
            if (deltaY < -5 || deltaX > 15 || !this.atTop()) {
                this.state.tracking = false;
                return;
            }
            
            // If finger goes down more than deadzone (15px), lock into pull mode
            if (deltaY > 15) {
                this.state.pulling = true;
            } else {
                // Still in deadzone, don't preventDefault yet, allow native scroll to evaluate
                return; 
            }
        }

        if (deltaY <= 0 || !this.atTop()) {
            this.resetPullState();
            this.resetVisuals();
            return;
        }

        // Apply resistance and limit pull distance
        const wasArmed = this.state.armed;
        const pullDistance = Math.min(PTR_MAX_PULL_DISTANCE, deltaY * 0.4);
        this.state.armed = pullDistance >= PTR_TRIGGER_DISTANCE;

        // Haptic feedback when threshold is crossed (Android only — iOS ignores this)
        if (this.state.armed && !wasArmed) {
            navigator.vibrate?.(10);
        }

        // Re-verify we're still at top right before blocking native scroll (#1)
        if (!this.atTop()) {
            this.resetPullState();
            this.resetVisuals();
            return;
        }

        // Only preventDefault after intent is clearly to pull-down. This fixes the Android frozen scroll issue!
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

        // Drive the pill in from above — no wrapper height needed since wrapper is now position:fixed
        if (this.state.indicator) {
            this.state.indicator.classList.remove('is-refreshing');
            const translateY = Math.round((progress - 1) * 60); // -60px → 0 as progress 0 → 1
            const opacity = Math.min(1, progress * 1.4);
            this.state.indicator.style.transition = 'none';
            this.state.indicator.style.transform = `translateY(${translateY}px)`;
            this.state.indicator.style.opacity = opacity.toString();
        }

        if (this.state.label) {
            // Fix #6 — clearer label before threshold
            this.state.label.textContent = this.state.armed ? 'Relâcher' : 'Tirer pour actualiser';
            this.state.label.style.color = '';
        }

        if (this.state.spinner) {
            // Fix #7 — track angle so WAAPI can continue smoothly from here
            const angle = Math.round(progress * 180);
            this.state.spinnerAngle = angle;
            this.state.spinner.style.transform = `rotate(${angle}deg)`;
        }
    },

    async startRefresh() {
        this.state.refreshing = true;

        // Wrapper is now position:fixed — just animate the pill into view with a spring
        if (this.state.indicator) {
            this.state.indicator.classList.add('is-refreshing');
            this.state.indicator.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease';
            this.state.indicator.style.transform = 'translateY(0)';
            this.state.indicator.style.opacity = '1';
        }

        if (this.state.label) {
            this.state.label.textContent = 'Actualisation...';
            this.state.label.style.color = '';
        }

        // Fix #7 — WAAPI spin starting from the exact angle where the pull stopped
        if (this.state.spinner) {
            const startAngle = this.state.spinnerAngle ?? 0;
            this.state.spinner.style.transform = '';
            this.state.spinner.animate(
                [
                    { transform: `rotate(${startAngle}deg)` },
                    { transform: `rotate(${startAngle + 360}deg)` }
                ],
                { duration: 800, iterations: Infinity, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
            );
        }

        try {
            await window.NewKetPageRefresh();
        } catch (error) {
            // Fix #2 — visible error feedback instead of silent failure
            console.error('[NewKet PTR] Refresh failed:', error);
            if (this.state.label) {
                this.state.label.textContent = 'Erreur ⚠️';
                this.state.label.style.color = '#ef4444';
            }
        } finally {
            window.setTimeout(() => {
                this.state.refreshing = false;
                this.resetVisuals();
            }, 1000); // Minimum duration for the animation to feel premium
        }
    },

    resetPullState() {
        this.state.tracking = false;
        this.state.pulling = false;
        this.state.armed = false;
        this.state.spinnerAngle = 0;
    },

    resetVisuals() {
        if (this.state.indicator) {
            this.state.indicator.classList.remove('is-refreshing');
            // Slide pill back above viewport
            this.state.indicator.style.transition = 'transform 0.35s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease';
            this.state.indicator.style.transform = 'translateY(-60px)';
            this.state.indicator.style.opacity = '0';
        }

        // Fix #7 — cancel WAAPI spin animation and reset spinner
        if (this.state.spinner) {
            this.state.spinner.getAnimations().forEach(a => a.cancel());
            this.state.spinner.style.transform = 'rotate(0deg)';
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PullToRefresh.init(), { once: true });
} else {
    PullToRefresh.init();
}

window.NewKetPullToRefresh = PullToRefresh;
