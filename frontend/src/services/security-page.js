function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function bindClick(selector, handler) {
  document.querySelectorAll(selector).forEach((element) => {
    element.addEventListener('click', handler);
  });
}

onReady(() => {
  bindClick('[data-open-mobile-filters]', () => {
    document.getElementById('mobileFiltersContainer')?.classList.toggle('hidden');
  });

  bindClick('[data-toggle-mobile-dropdown]', (event) => {
    if (typeof window.toggleMobileDropdown === 'function') {
      window.toggleMobileDropdown(event.currentTarget);
    }
  });

  bindClick('[data-reset-filters]', () => {
    if (typeof window.resetFilters === 'function') {
      window.resetFilters();
    }
  });

  bindClick('[data-filter-all-products]', (event) => {
    if (typeof window.filterAllProducts === 'function') {
      window.filterAllProducts(event.currentTarget.dataset.filterAllProducts);
    }
  });

  bindClick('[data-resolve-path]', (event) => {
    event.preventDefault();
    const target = event.currentTarget.dataset.resolvePath;
    if (typeof window.resolvePath === 'function' && target) {
      window.location.href = window.resolvePath(target);
    }
  });

  bindClick('[data-open-zoom]', () => {
    if (typeof window.openZoom === 'function') {
      window.openZoom();
    }
  });

  bindClick('[data-close-zoom]', () => {
    if (typeof window.closeZoom === 'function') {
      window.closeZoom();
    }
  });

  bindClick('[data-share-product]', () => {
    if (typeof window.shareProduct === 'function') {
      window.shareProduct();
    }
  });

  bindClick('[data-update-qty]', (event) => {
    if (typeof window.updateQty === 'function') {
      window.updateQty(Number(event.currentTarget.dataset.updateQty || '0'));
    }
  });

  bindClick('[data-toggle-sidebar="customer"]', () => {
    window.SidebarManager?.toggle?.();
  });

  bindClick('[data-close-sidebar="customer"]', () => {
    window.SidebarManager?.close?.();
  });

  bindClick('[data-toggle-sidebar="vendor"]', () => {
    window.SidebarManager?.toggle?.();
  });

  bindClick('[data-close-sidebar="vendor"]', () => {
    window.SidebarManager?.close?.();
  });

  bindClick('[data-logout-safe]', (event) => {
    window.AuthManager?.handleLogoutClick?.(event.currentTarget);
  });

  bindClick('[data-switch-customer-tab]', (event) => {
    event.preventDefault();
    const tab = event.currentTarget.dataset.switchCustomerTab;
    if (typeof window.switchTab === 'function' && tab) {
      window.switchTab(tab, event);
    }
  });

  bindClick('[data-switch-vendor-tab]', (event) => {
    event.preventDefault();
    const tab = event.currentTarget.dataset.switchVendorTab;
    if (typeof window.switchVendorTab === 'function' && tab) {
      window.switchVendorTab(tab, event);
    }
  });
});
