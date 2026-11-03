(() => {
  try {
    localStorage.setItem('newket_theme', 'light');
  } catch (_) {
    // Ignore storage failures during bootstrap.
  }

  document.documentElement.classList.remove('dark');

  // Détection ultra-précoce iOS Capacitor dès le <head> sur toutes les pages
  try {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isCapacitor = window.location?.protocol === 'capacitor:' || !!window.Capacitor;
    if (isCapacitor && isIOS) {
      document.documentElement.classList.add('is-ios-capacitor');
    }
  } catch (_) {}
})();
