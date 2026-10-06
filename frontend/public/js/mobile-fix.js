(function() {
  const isCapacitor = window.Capacitor !== undefined || window.location.protocol === 'capacitor:';
  if (!isCapacitor) return;

  console.log('[Mobile Fix] Capacitor detected. Applying fixes for routing and scroll...');

  // Activate CSS rules scoped to html.capacitor-native (section 55 in responsive.css)
  document.documentElement.classList.add('capacitor-native');

  // Hide footer on native app (not needed on mobile, replaced by bottom nav bar)
  const style = document.createElement('style');
  style.textContent = '.newket-footer-shell, footer.newket-footer-shell { display: none !important; }';
  document.head ? document.head.appendChild(style) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));

  // Selectors that might block scroll on inner wrappers
  const SCROLL_TARGETS = [
    'html',
    'body',
    '#app',
    '#main-content',
    '.main-content',
    'main',
    '#page-content',
    '.page-content',
    '#app-body',
  ];

  const fixScroll = () => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    if (htmlEl) {
      htmlEl.style.setProperty('overflow-y', 'auto', 'important');
      htmlEl.style.setProperty('overflow-x', 'hidden', 'important');
      htmlEl.style.setProperty('height', 'auto', 'important');
      htmlEl.style.setProperty('min-height', '100%', 'important');
      // Critical for Android WebView: allow native vertical panning
      htmlEl.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      // Android WebView specific: enable momentum scrolling
      htmlEl.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    }

    if (bodyEl) {
      bodyEl.style.setProperty('overflow-y', 'auto', 'important');
      bodyEl.style.setProperty('overflow-x', 'hidden', 'important');
      bodyEl.style.setProperty('height', 'auto', 'important');
      bodyEl.style.setProperty('min-height', '100%', 'important');
      bodyEl.style.setProperty('touch-action', 'pan-y pinch-zoom', 'important');
      bodyEl.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    }

    // Fix any inner wrappers that might restrict scroll
    SCROLL_TARGETS.forEach(selector => {
      const el = document.querySelector(selector);
      if (!el || el === htmlEl || el === bodyEl) return;
      const computed = window.getComputedStyle(el);
      if (
        computed.overflow === 'hidden' ||
        computed.overflowY === 'hidden' ||
        computed.height === '100vh' ||
        computed.maxHeight === '100vh'
      ) {
        el.style.setProperty('overflow-y', 'auto', 'important');
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
      }
    });

    // Android WebView: remove any lingering non-passive touchmove listeners
    // that might have been added before Capacitor was detected.
    // We do this by injecting a capturing listener that re-enables scroll.
    if (!document._capacitorScrollFixed) {
      document._capacitorScrollFixed = true;
      document.addEventListener('touchmove', function(e) {
        // Only intervene if the default page scroll is somehow prevented by another handler.
        // We intentionally do NOT call e.preventDefault() here.
      }, { passive: true, capture: false });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    fixScroll();
    fixLinks();
  });

  window.addEventListener('load', fixScroll);
  setTimeout(fixScroll, 300);
  setTimeout(fixScroll, 1000);

  // Observe only structural changes (new pages/sections added)
  const observer = new MutationObserver((mutations) => {
    const significantChange = mutations.some(m =>
      m.type === 'childList' &&
      Array.from(m.addedNodes).some(n => n.nodeType === 1 && (n.tagName === 'MAIN' || n.tagName === 'SECTION' || (n.id && ['main-content', 'app', 'app-body', 'page-content'].includes(n.id))))
    );
    if (significantChange) {
      fixScroll();
    }
    fixLinks();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    fixScroll();
    fixLinks();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    });
  }


  // Pages are built by Vite into dist/src/pages/xxx.html — so we must prefix with /src/pages/
  function resolveUrl(originalPath) {
    let path = originalPath.split('?')[0];
    let search = originalPath.includes('?') ? '?' + originalPath.split('?').slice(1).join('?') : '';

    if (path === '/') return '/index.html' + search;

    // Already resolved — don't double-process
    if (path.startsWith('/src/pages/')) return originalPath;
    if (path.endsWith('.html')) return originalPath;

    // /boutique/shopSlug/productSlug/rand/NewKet -> product page
    let match = path.match(/^\/boutique\/[^/?#]+\/([^/?#]+)\/(?:[0-9]{1,3})\/newket\/?/i);
    if (match) {
        const urlParams = new URLSearchParams(search.replace(/^\?/, ''));
        urlParams.set('id', match[1]);
        return '/src/pages/product.html?' + urlParams.toString();
    }

    // /boutique/shopSlug or /boutique/shopSlug/NewKet -> shop page
    match = path.match(/^\/boutique\/([^/?#]+)(?:\/newket)?\/?$/i);
    if (match) {
        const urlParams = new URLSearchParams(search.replace(/^\?/, ''));
        urlParams.set('shop', match[1]);
        return '/src/pages/shop.html?' + urlParams.toString();
    }

    // /admin/xxx -> /src/pages/admin/xxx.html
    if (path.startsWith('/admin/')) {
        const cleanPath = path.endsWith('.html') ? path : path.replace(/\/?$/, '.html');
        return '/src/pages' + cleanPath + search;
    }

    // All standard page routes -> /src/pages/xxx.html
    const rootPages = ["404", "500", "about", "achat", "catalog", "choose-role", "customer-dashboard", "faq", "favorites", "invoice-verify", "login", "mentions-legales", "notifications", "payment-cancel", "payment-success", "privacy", "product", "promo", "publish", "reset-password", "seller-onboarding", "seller", "settings", "shop", "shops", "support", "system-health", "terms", "vendor-dashboard"];
    const simplePage = path.match(/^\/([^/?#.@]+)\/?$/i);
    if (simplePage && rootPages.includes(simplePage[1])) {
        return `/src/pages/${simplePage[1]}.html${search}`;
    }

    return originalPath;
  };

  // 3. Fix Links Interceptor
  function fixLinks(element = document) {
    const links = element.querySelectorAll('a[href]');
    links.forEach(a => {
      let href = a.getAttribute('href');

      // Ignore anchors, external, special schemes, already fixed paths
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href.startsWith('/src/pages/')) {
        return;
      }

      try {
        let newHref = href;
        if (href.startsWith('/')) {
            newHref = resolveUrl(href);
        } else {
            const urlObj = new URL(href, window.location.origin);
            newHref = resolveUrl(urlObj.pathname + urlObj.search + urlObj.hash);
        }
        if (newHref !== href) {
            a.setAttribute('href', newHref);
        }
      } catch (e) {}
    });
  };

  // Intercept JS-based navigation (window.location.assign / replace)
  const originalAssign = window.location.assign.bind(window.location);
  window.location.assign = function(url) {
      if (typeof url === 'string') url = resolveUrl(url);
      return originalAssign(url);
  };

  const originalReplace = window.location.replace.bind(window.location);
  window.location.replace = function(url) {
      if (typeof url === 'string') url = resolveUrl(url);
      return originalReplace(url);
  };

  // ── Swipe-Back Gesture ───────────────────────────────────────────────────
  // iOS/Android WebView does not support the native swipe-back gesture.
  // Detect a left-edge swipe (starting ≤ 30px from left) and call history.back().
  (function initSwipeBack() {
    let startX = null;
    let startY = null;
    const EDGE_THRESHOLD = 30;   // px from left edge to trigger zone
    const MIN_SWIPE_X   = 60;    // minimum horizontal travel to count
    const MAX_SWIPE_Y   = 80;    // maximum vertical drift allowed (avoids conflict with scroll)

    document.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_THRESHOLD) {
        startX = touch.clientX;
        startY = touch.clientY;
      } else {
        startX = null;
        startY = null;
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);

      if (dx >= MIN_SWIPE_X && dy <= MAX_SWIPE_Y) {
        if (window.history.length > 1) {
          window.history.back();
        }
      }
      startX = null;
      startY = null;
    }, { passive: true });
  })();

})();
