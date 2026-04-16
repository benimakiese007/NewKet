/**
 * NewKet ThemeManager — Dark Mode
 * Applies dark class to <html>, persists preference, and exposes toggle.
 */
const ThemeManager = {
    STORAGE_KEY: 'newket_theme',

    init() {
        // Apply saved theme immediately (before paint to prevent FOUC)
        const saved = localStorage.getItem(this.STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (saved === 'dark' || (!saved && prefersDark)) {
            this.enable(false);
        } else {
            this.disable(false);
        }

        // Sync toggle button on init
        this._syncToggleUI();

        // Listen for OS-level preference changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.STORAGE_KEY)) {
                e.matches ? this.enable() : this.disable();
            }
        });
    },

    enable(save = true) {
        document.documentElement.classList.add('dark');
        if (save) localStorage.setItem(this.STORAGE_KEY, 'dark');
        this._syncToggleUI();
    },

    disable(save = true) {
        document.documentElement.classList.remove('dark');
        if (save) localStorage.setItem(this.STORAGE_KEY, 'light');
        this._syncToggleUI();
    },

    toggle() {
        if (document.documentElement.classList.contains('dark')) {
            this.disable();
        } else {
            this.enable();
        }
    },

    isDark() {
        return document.documentElement.classList.contains('dark');
    },

    /**
     * Syncs all toggle buttons on the page to reflect current state.
     * Looks for elements with data-theme-toggle attribute.
     */
    _syncToggleUI() {
        const isDark = this.isDark();

        // Update any toggle buttons that have these data attributes
        document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
            const iconEl = btn.querySelector('[data-theme-icon]');
            const labelEl = btn.querySelector('[data-theme-label]');
            if (iconEl) iconEl.setAttribute('icon', isDark ? 'solar:sun-bold' : 'solar:moon-bold');
            if (labelEl) labelEl.textContent = isDark ? 'Mode clair' : 'Mode sombre';
            btn.setAttribute('title', isDark ? 'Passer en mode clair' : 'Passer en mode sombre');
            btn.setAttribute('aria-label', isDark ? 'Passer en mode clair' : 'Passer en mode sombre');
        });

        // Also update mobile nav toggle if present
        document.querySelectorAll('[data-theme-toggle-mobile]').forEach(btn => {
            const iconEl = btn.querySelector('iconify-icon');
            if (iconEl) iconEl.setAttribute('icon', isDark ? 'solar:sun-bold' : 'solar:moon-bold');
        });
    }
};

window.ThemeManager = ThemeManager;

// Apply theme immediately (before DOMContentLoaded to prevent FOUC)
(function () {
    const saved = localStorage.getItem('newket_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
    }
})();

// Auto-initialize ThemeManager when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
    });
}
