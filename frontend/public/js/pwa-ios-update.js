/**
 * NewKet — iOS PWA Update Notifier
 *
 * Affiche un bandeau sur iOS uniquement quand l'icône PWA a changé.
 *
 * ⚠️  Pour déclencher le bandeau : changer ICON_VERSION ci-dessous
 *     (ex: 'v2' → 'v3') ET déployer. Ne pas toucher à cette valeur
 *     si seul le code a changé (pas l'icône).
 */

(function () {
  'use strict';

  /**
   * ⚙️  Valeur calculée automatiquement au build depuis le hash de l'icône.
   *    → Si le fichier icône change, ce hash change, le bandeau s'affiche.
   *    → Si seul le code change, ce hash reste identique, rien ne s'affiche.
   *    Ne pas modifier manuellement.
   */
  const ICON_VERSION = '__NEWKET_ICON_VERSION__';

  const STORAGE_KEY = 'newket_icon_version';
  const BANNER_ID   = 'newket-ios-update-banner';

  /** Vrai uniquement sur un iPhone/iPad en mode standalone (installé sur l'écran d'accueil) */
  function isIosPwa() {
    return (
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      window.navigator.standalone === true
    );
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
    var knownVersion;
    try { knownVersion = localStorage.getItem(STORAGE_KEY); } catch (_) { knownVersion = null; }
    if (knownVersion === null) {
      try { localStorage.setItem(STORAGE_KEY, ICON_VERSION); } catch (_) {}
      return;
    }
    if (ICON_VERSION !== knownVersion) {
      setTimeout(function () { showBanner(ICON_VERSION); }, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
