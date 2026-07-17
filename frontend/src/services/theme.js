/**
 * ThemeManager (deprecated)
 * Dark mode has been removed from NewKet. This stub keeps legacy pages safe.
 */

const ThemeManager = {
  init() {
    try { document.documentElement.classList.remove('dark'); } catch {}
    try { localStorage.removeItem('newket_theme'); } catch {}
  },
  toggle() {
    // noop
    this.init();
  },
  _syncToggleUI() {},
};

window.ThemeManager = ThemeManager;
ThemeManager.init();

