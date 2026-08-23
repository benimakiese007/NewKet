/**
 * NewKet — iOS PWA Update Notifier
 *
 * Détecte quand une nouvelle version est déployée et affiche un bandeau
 * discret sur iOS (où les icônes PWA ne se mettent pas à jour automatiquement).
 *
 * Logique :
 *  1. Lire la version actuelle depuis <meta name="newket-version">
 *  2. Comparer avec la dernière version vue (stockée dans localStorage)
 *  3. Si différente ET que l'app tourne en mode standalone iOS → afficher le bandeau
 *  4. Marquer comme vue pour ne pas répéter le bandeau à chaque ouverture
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'newket_pwa_version';
  const BANNER_ID   = 'newket-ios-update-banner';

  /** Vrai uniquement sur un iPhone/iPad en mode standalone (installé sur l'ecran d'accueil) */
  function isIosPwa() {
    return (
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      window.navigator.standalone === true
    );
  }

  /** Lire la version injectee par Vite au moment du build */
  function getCurrentVersion() {
    const meta = document.querySelector('meta[name="newket-version"]');
    return meta ? meta.getAttribute('content') : null;
  }

  /** Creer et afficher le bandeau de notification */
  function showBanner(version) {
    if (document.getElementById(BANNER_ID)) return;

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'polite');

    Object.assign(banner.style, {
      position:   'fixed',
      top:        '0',
      left:       '0',
      right:      '0',
      zIndex:     '99999',
      background: '#064734',
      color:      '#ffffff',
      padding:    '14px 16px',
      paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
      display:    'flex',
      alignItems: 'flex-start',
      gap:        '12px',
      boxShadow:  '0 4px 24px rgba(0,0,0,0.18)',
      fontFamily: "'Inter', sans-serif",
      fontSize:   '14px',
      lineHeight: '1.4',
    });

    banner.innerHTML = '<div style="flex:1;">'
      + '<strong style="display:block;margin-bottom:3px;">NewKet a ete mis a jour !</strong>'
      + `<span style="opacity:0.85;">Pour voir la nouvelle icone, supprimez l'app et reinstallez-la depuis Safari.</span>`
      + '</div>'
      + '<button id="' + BANNER_ID + '-close" aria-label="Fermer"'
      + ' style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;flex-shrink:0;padding:0 4px;opacity:0.8;line-height:1;margin-top:2px;"'
      + '>x</button>';

    document.body.prepend(banner);

    document.getElementById(BANNER_ID + '-close').addEventListener('click', function () {
      dismissBanner(banner, version);
    });

    setTimeout(function () { dismissBanner(banner, version); }, 12000);
  }

  /** Retirer le bandeau et memoriser la version comme vue */
  function dismissBanner(banner, version) {
    if (!banner || !banner.parentNode) return;
    banner.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    banner.style.opacity    = '0';
    banner.style.transform  = 'translateY(-100%)';
    setTimeout(function () { banner.remove(); }, 400);
    try { localStorage.setItem(STORAGE_KEY, version); } catch (_) {}
  }

  /** Point d'entree principal */
  function init() {
    if (!isIosPwa()) return;
    var currentVersion = getCurrentVersion();
    if (!currentVersion) return;
    var knownVersion;
    try { knownVersion = localStorage.getItem(STORAGE_KEY); } catch (_) { knownVersion = null; }
    if (currentVersion !== knownVersion) {
      setTimeout(function () { showBanner(currentVersion); }, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
