(() => {
  try {
    localStorage.setItem('newket_theme', 'light');
  } catch (_) {
    // Ignore storage failures during bootstrap.
  }

  document.documentElement.classList.remove('dark');
})();
