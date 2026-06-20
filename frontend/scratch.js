
        let currentSelectedOrder = null;
        let currentSelectedDispute = null;
        let releaseCountdownTimer = null;
        const orderRefreshSignalKey = 'newket_orders_refresh_signal';

        function switchTab(tabId, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const dashboardView = document.getElementById('view-dashboard');
            const dashboardLink = document.getElementById('link-dashboard');

            // Update Hash for persistence (preserve achat deep-links like #achat?order_id=...)
            try {
                const raw = (window.location.hash || '').replace(/^#/, '');
                const decoded = decodeURIComponent(raw || '').trim();
                if (!decoded || decoded.indexOf(tabId) !== 0) {
                    window.location.hash = tabId;
                }
            } catch (e) {
                window.location.hash = tabId;
            }

            ['orders', 'purchases', 'favorites', 'notifications', 'settings'].forEach(t => {
                const el = document.getElementById('tab-' + t);
                const link = document.getElementById('link-' + t);
                if (el) { el.classList.add('hidden'); el.classList.remove('tab-content'); }
                if (link) link.classList.remove('active');
            });

            if (dashboardView) { dashboardView.classList.add('hidden'); dashboardView.classList.remove('tab-content'); }
            if (dashboardLink) dashboardLink.classList.remove('active');

            if (tabId === 'dashboard') {
                if (dashboardView) {
                    dashboardView.classList.remove('hidden');
                    window.requestAnimationFrame(() => dashboardView.classList.add('tab-content'));
                }
                if (dashboardLink) dashboardLink.classList.add('active');
                return;
            }

            const targetEl = document.getElementById('tab-' + tabId);
            const targetLink = document.getElementById('link-' + tabId);
            if (targetEl) {
                targetEl.classList.remove('hidden');
                window.requestAnimationFrame(() => targetEl.classList.add('tab-content'));
            }
            if (targetLink) targetLink.classList.add('active');
            if (tabId === 'notifications') renderDashboardNotifications();
            if (tabId === 'purchases' && typeof window.renderCustomerPurchasesTab === 'function') window.renderCustomerPurchasesTab();
            if (tabId === 'settings') {
                refreshCustomerDevicePushStatus();
                setTimeout(() => {
                    if (typeof initCustomerResidenceMap === 'function') initCustomerResidenceMap();
                }, 120);
            }

            // Auto-close sidebar on mobile after selection
            if (window.SidebarManager) SidebarManager.close();
        }
        window.switchTab = switchTab;

        function bindCustomerDashboardActions() {
            document.querySelectorAll('[data-switch-customer-tab]').forEach((link) => {
                if (link.dataset.bound === 'true') return;
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    const tabId = link.getAttribute('data-switch-customer-tab');
                    if (!tabId) return;
                    window.requestAnimationFrame(() => switchTab(tabId));
                });
                link.dataset.bound = 'true';
            });

            document.querySelector('[data-action="mark-all-notifications-read"]')?.addEventListener('click', () => {
                NotificationManager.markAllAsRead();
                renderDashboardNotifications();
            });

            document.querySelector('[data-action="clear-all-notifications"]')?.addEventListener('click', () => {
                NotificationManager.clearAll();
                renderDashboardNotifications();
            });

            const customerPushToggle = document.getElementById('customerDevicePushToggle');
            if (customerPushToggle && customerPushToggle.dataset.bound !== 'true') {
                customerPushToggle.addEventListener('change', async (event) => {
                    await toggleCustomerDevicePush(event.target.checked);
                });
                customerPushToggle.dataset.bound = 'true';
            }

            document.querySelectorAll('[data-action="close-order-modal"]').forEach((button) => {
                if (button.dataset.bound === 'true') return;
                button.addEventListener('click', closeOrderModal);
                button.dataset.bound = 'true';
            });

            document.getElementById('btnAcceptQuote')?.addEventListener('click', handleAcceptQuote);
            document.getElementById('btnRejectQuote')?.addEventListener('click', handleRejectQuote);
            document.getElementById('btnPayOrder')?.addEventListener('click', handlePayOrder);
            document.getElementById('btnValidateDelivery')?.addEventListener('click', handleValidateDelivery);
            document.getElementById('btnOpenDispute')?.addEventListener('click', showDisputeModal);
            document.getElementById('btnSendDisputeMessage')?.addEventListener('click', () => {
                if (typeof window.sendDisputeMessage === 'function') return window.sendDisputeMessage();
                // Avoid hard crash if the dispute module hasn't been loaded yet.
                showToast('Messagerie indisponible. Veuillez r\u00e9essayer dans un instant.', 'error');
            });
            document.querySelector('[data-action="buyer-accept-dispute-offer"]')?.addEventListener('click', () => {
                if (typeof window.handleBuyerAcceptDisputeOffer === 'function') return window.handleBuyerAcceptDisputeOffer();
                showToast('Action indisponible. Veuillez r\u00e9essayer.', 'error');
            });
            document.querySelector('[data-action="buyer-reject-dispute-offer"]')?.addEventListener('click', () => {
                if (typeof window.handleBuyerRejectDisputeOffer === 'function') return window.handleBuyerRejectDisputeOffer();
                showToast('Action indisponible. Veuillez r\u00e9essayer.', 'error');
            });
            document.querySelector('[data-action="download-invoice"]')?.addEventListener('click', downloadInvoice);
            document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('[data-action="close-dispute-modal"]').forEach((button) => {
                    if (button.dataset.bound === 'true') return;
                    button.addEventListener('click', closeDisputeModal);
                    button.dataset.bound = 'true';
                });
                document.getElementById('btnSubmitDispute')?.addEventListener('click', submitDispute);
            });
        }

        bindCustomerDashboardActions();

        let customerAvatarUploadInFlight = false;

        function renderCustomerProfileAvatarPreview(name, avatarUrl) {
            if (!window.renderAvatar) return;
            window.renderAvatar(name, avatarUrl, 'profileAvatarPreviewImg', 'profileAvatarPreviewPlaceholder');
            const preview = document.getElementById('profileAvatarPreview');
            if (preview) {
                preview.style.backgroundColor = '#f3f4f6';
                preview.style.color = '#111827';
            }
        }

        async function handleCustomerAvatarUpload(file) {
            if (!file || customerAvatarUploadInFlight) return;

            if (!file.type || !file.type.startsWith('image/')) {
                showToast('Choisissez une image valide.', 'error');
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                showToast('Image trop lourde. Maximum 2 Mo.', 'error');
                return;
            }

            customerAvatarUploadInFlight = true;
            if (window.LoaderManager) LoaderManager.show('Mise à jour de la photo...');

            try {
                const client = window.SupabaseAdapter?.getClient?.();
                if (!client) throw new Error('Client Supabase indisponible');

                const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                if (!user?.id) throw new Error('Utilisateur non authentifié');

                const ext = (file.name?.split('.')?.pop() || 'jpg').toLowerCase();
                const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'jpg';
                const filePath = `avatars/${user.id}_${Date.now()}.${safeExt}`;

                const publicUrl = await window.SupabaseAdapter.uploadFile('user-assets', filePath, file);
                if (!publicUrl) throw new Error('Upload echoue');

                await window.SupabaseAdapter.update('users', user.id, { avatar: publicUrl });
                await client.auth.updateUser({
                    data: { avatar_url: publicUrl }
                });

                const currentProfile = ProfileManager.getProfile();
                ProfileManager.saveProfile({ ...currentProfile, avatar: publicUrl });

                const currentName = currentProfile.name || localStorage.getItem('newketUserName') || user.email || 'Utilisateur';
                renderCustomerProfileAvatarPreview(currentName, publicUrl);
                showToast('Photo de profil mise à jour.', 'success');
            } catch (error) {
                console.error('[Customer Avatar] Upload error:', error);
                const uploadError = window.SupabaseAdapter?.getLastUploadError?.() || error;
                const readableError = window.SupabaseAdapter?.getReadableUploadError?.(uploadError) || error?.message;
                showToast(readableError || 'Erreur lors de la mise a jour de la photo.', 'error');
            } finally {
                customerAvatarUploadInFlight = false;
                const input = document.getElementById('customerAvatarUploadInput');
                if (input) input.value = '';
                if (window.LoaderManager) window.LoaderManager.hide();
            }
        }

        // Avatar rendering is now handled by global renderAvatar from ui-helpers.js

        // Status badge
        function renderStatusBadge(points) {
            const badge = document.getElementById('userStatusBadge');
            if (!badge) return;
            let cls, icon, label;
            if (points >= 500) {
                cls = 'status-vip'; icon = '\u2605'; label = 'VIP';
            } else if (points >= 100) {
                cls = 'status-premium'; icon = '\u{1F3C6}'; label = 'Premium';
            } else {
                cls = 'status-standard'; icon = ''; label = 'Standard';
            }
            badge.className = `status-badge ${cls}`;
            badge.textContent = (icon ? icon + ' ' : '') + label;
        }

        let customerResidenceMap = null;
        let customerResidenceMarker = null;
        let customerResidenceSelection = null;
        let customerResidenceMapInitPromise = null;

        function getSavedCustomerResidence() {
            try {
                return window.ProfileManager?.getHomeLocation?.() || null;
            } catch (_) {
                return null;
            }
        }

        function setCustomerResidenceBadge(visible) {
            const badge = document.getElementById('customerResidenceBadge');
            if (!badge) return;
            badge.classList.toggle('hidden', !visible);
        }

        function setCustomerResidenceStatus(message, tone = 'info') {
            const status = document.getElementById('customerResidenceStatus');
            if (!status) return;

            const tones = {
                info: {
                    icon: 'solar:info-circle-bold',
                    iconClass: 'text-gray-400',
                    textClass: 'text-gray-600',
                    boxClass: 'bg-gray-50 border-gray-100'
                },
                success: {
                    icon: 'solar:check-circle-bold',
                    iconClass: 'text-green-600',
                    textClass: 'text-green-700',
                    boxClass: 'bg-green-50 border-green-100'
                },
                warning: {
                    icon: 'solar:danger-triangle-bold',
                    iconClass: 'text-amber-500',
                    textClass: 'text-amber-700',
                    boxClass: 'bg-amber-50 border-amber-100'
                },
                error: {
                    icon: 'solar:danger-circle-bold',
                    iconClass: 'text-red-500',
                    textClass: 'text-red-600',
                    boxClass: 'bg-red-50 border-red-100'
                }
            };

            const ui = tones[tone] || tones.info;
            status.className = `text-xs px-4 py-3 rounded-2xl border flex items-center gap-2 ${ui.boxClass}`;
            status.innerHTML = `
                <iconify-icon icon="${ui.icon}" width="16" class="${ui.iconClass}"></iconify-icon>
                <span class="${ui.textClass}">${message}</span>
            `;
        }

        async function initCustomerResidenceMap() {
            const mapEl = document.getElementById('customerResidenceMap');
            const cityInput = document.getElementById('residenceCity');
            const locateBtn = document.getElementById('residenceLocateBtn');
            const saveBtn = document.getElementById('saveResidenceBtn');

            if (!mapEl || !cityInput || !locateBtn || !saveBtn) return;

            const savedResidence = getSavedCustomerResidence();
            if (!cityInput.value) {
                cityInput.value = savedResidence?.city || localStorage.getItem('newketUserCity') || 'Kinshasa';
            }

            if (locateBtn.dataset.bound !== 'true') {
                locateBtn.addEventListener('click', () => {
                    if (!navigator.geolocation) {
                        setCustomerResidenceStatus('La geolocalisation est indisponible sur ce navigateur.', 'error');
                        showToast('Geolocalisation indisponible.', 'warning');
                        return;
                    }

                    locateBtn.disabled = true;
                    setCustomerResidenceStatus('Recherche de votre position actuelle...', 'info');

                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            customerResidenceSelection = {
                                lat,
                                lng,
                                city: cityInput.value.trim() || savedResidence?.city || 'Kinshasa'
                            };

                            if (customerResidenceMarker) customerResidenceMarker.setLatLng([lat, lng]);
                            if (customerResidenceMap) {
                                customerResidenceMap.setView([lat, lng], 16, { animate: true });
                                customerResidenceMap.invalidateSize();
                            }

                            setCustomerResidenceBadge(false);
                            setCustomerResidenceStatus('Position actuelle chargee. Sauvegardez-la si c est votre residence.', 'success');
                            locateBtn.disabled = false;
                        },
                        (error) => {
                            let message = 'Impossible de recuperer votre position.';
                            if (error?.code === 1) message = 'Permission refusee. Activez la geolocalisation.';
                            if (error?.code === 2) message = 'Position non disponible.';
                            setCustomerResidenceStatus(message, 'error');
                            locateBtn.disabled = false;
                        },
                        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
                    );
                });
                locateBtn.dataset.bound = 'true';
            }

            if (saveBtn.dataset.bound !== 'true') {
                saveBtn.addEventListener('click', () => {
                    const city = cityInput.value.trim() || 'Kinshasa';
                    if (!Number.isFinite(customerResidenceSelection?.lat) || !Number.isFinite(customerResidenceSelection?.lng)) {
                        setCustomerResidenceStatus('Choisissez votre residence sur la carte avant de sauvegarder.', 'warning');
                        showToast('Selectionnez votre residence sur la carte.', 'warning');
                        return;
                    }

                    const payload = {
                        lat: customerResidenceSelection.lat,
                        lng: customerResidenceSelection.lng,
                        city
                    };

                    const saved = window.ProfileManager?.saveHomeLocation?.(payload);
                    if (!saved) {
                        localStorage.setItem('newketHomeLocation', JSON.stringify({
                            ...payload,
                            updated_at: new Date().toISOString()
                        }));
                    }

                    cityInput.value = city;
                    customerResidenceSelection = payload;
                    setCustomerResidenceBadge(true);
                    setCustomerResidenceStatus('Residence sauvegardee. Le checkout utilisera cette position par defaut.', 'success');
                    showToast('Residence de livraison sauvegardee.', 'success');
                });
                saveBtn.dataset.bound = 'true';
            }

            if (customerResidenceMap) {
                setTimeout(() => customerResidenceMap.invalidateSize(), 120);
                return;
            }

            if (customerResidenceMapInitPromise) {
                await customerResidenceMapInitPromise;
                if (customerResidenceMap) setTimeout(() => customerResidenceMap.invalidateSize(), 120);
                return;
            }

            customerResidenceMapInitPromise = (async () => {
                try {
                    await window.loadLeaflet?.();
                } catch (error) {
                    console.error('[Customer Residence] Leaflet load error:', error);
                    setCustomerResidenceStatus('Impossible de charger la carte de residence.', 'error');
                    return;
                }

                if (!window.L) {
                    setCustomerResidenceStatus('Leaflet est indisponible pour cette page.', 'error');
                    return;
                }

                if (customerResidenceMap) {
                    try { customerResidenceMap.invalidateSize(); } catch(e) {}
                    return;
                }

                // If container has a stale _leaflet_id, destroy it cleanly before re-init
                if (mapEl._leaflet_id) {
                    try {
                        const stale = L.map._instances?.[mapEl._leaflet_id];
                        if (stale && typeof stale.remove === 'function') stale.remove();
                    } catch(e) {}
                    delete mapEl._leaflet_id;
                    mapEl.dataset.leafletReady = '';
                    mapEl.innerHTML = '';
                }

                const defaultCenter = savedResidence
                    ? [savedResidence.lat, savedResidence.lng]
                    : [-4.4419, 15.2663];
                const defaultZoom = savedResidence ? 16 : 12;

                // Fix for Leaflet Icon.Default.js removeChild NotFoundError
                L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';

                customerResidenceMap = L.map(mapEl).setView(defaultCenter, defaultZoom);
                mapEl.dataset.leafletReady = 'true';
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 18,
                    attribution: '© OpenStreetMap'
                }).addTo(customerResidenceMap);

                customerResidenceMarker = L.marker(defaultCenter, { draggable: true }).addTo(customerResidenceMap);
                customerResidenceMap.invalidateSize();

                customerResidenceSelection = savedResidence
                    ? { lat: savedResidence.lat, lng: savedResidence.lng, city: savedResidence.city || cityInput.value.trim() || 'Kinshasa' }
                    : null;

                customerResidenceMarker.on('dragend', () => {
                    const pos = customerResidenceMarker.getLatLng();
                    customerResidenceSelection = {
                        lat: pos.lat,
                        lng: pos.lng,
                        city: cityInput.value.trim() || 'Kinshasa'
                    };
                    setCustomerResidenceBadge(false);
                    setCustomerResidenceStatus('Repere deplace. Sauvegardez pour enregistrer cette residence.', 'warning');
                });

                if (savedResidence) {
                    setCustomerResidenceBadge(true);
                    setCustomerResidenceStatus('Residence sauvegardee chargee. Vous pouvez la reajuster si necessaire.', 'success');
                } else {
                    setCustomerResidenceStatus('Placez votre residence sur la carte puis sauvegardez-la pour vos prochaines commandes.', 'info');
                }
            })();

            try {
                await customerResidenceMapInitPromise;
            } finally {
                customerResidenceMapInitPromise = null;
            }
        }


        async function ensureCustomerIdentity() {
            const existingEmail = localStorage.getItem('newketUserEmail');
            const existingId = localStorage.getItem('newketUserId');
            if (existingEmail && existingId) return;
            if (!window.SupabaseAdapter?.getClient) return;

            try {
                const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                if (user?.email) localStorage.setItem('newketUserEmail', user.email);
                if (user?.id) localStorage.setItem('newketUserId', user.id);
                const name = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
                if (name) localStorage.setItem('newketUserName', name);
            } catch (_) {}
        }

        function isCustomerOrdersDataPending() {
            // We consider "pending" until we receive the first ordersUpdated event.
            // This avoids relying on internal OrderManager flags that can drift.
            return window.__newketCustomerOrdersReady !== true;
        }

        async function refreshCustomerDevicePushStatus() {
            const toggle = document.getElementById('customerDevicePushToggle');
            const status = document.getElementById('customerDevicePushStatus');
            if (!toggle || !status) return;

            if (!window.AppNotifications) {
                toggle.disabled = true;
                status.textContent = 'Indisponible sur cette page.';
                return;
            }

            try {
                const state = await AppNotifications.getDeviceNotificationStatus();
                toggle.checked = state === 'enabled';
                toggle.disabled = state === 'unsupported' || state === 'denied';
                status.textContent = AppNotifications.getDeviceNotificationGuidance
                    ? AppNotifications.getDeviceNotificationGuidance(state)
                    : 'PWA installee recommandee. Navigateur normal: support variable.';
            } catch (error) {
                toggle.checked = false;
                status.textContent = 'Etat impossible a verifier.';
            }
        }

        async function toggleCustomerDevicePush(enable) {
            const toggle = document.getElementById('customerDevicePushToggle');
            const status = document.getElementById('customerDevicePushStatus');
            if (!toggle || !window.AppNotifications) return;

            toggle.disabled = true;
            if (status) status.textContent = enable ? 'Activation...' : 'Desactivation...';

            try {
                const ok = enable
                    ? await AppNotifications.enableDeviceNotifications()
                    : await AppNotifications.disableDeviceNotifications();
                if (!ok) toggle.checked = false;
            } catch (error) {
                console.error('Customer device push toggle error:', error);
                toggle.checked = !enable;
                if (window.showToast) showToast("Impossible de modifier les notifications appareil.", 'error');
            } finally {
                toggle.disabled = false;
                await refreshCustomerDevicePushStatus();
            }
        }

        async function loadDashboardData() {
            if (window.OrderManager) {
                OrderManager._initialized = false;
                await OrderManager.init();
            }
            if (typeof renderOrders === 'function') renderOrders();
            if (typeof renderCustomerDashboardStats === 'function') renderCustomerDashboardStats();
            if (typeof renderCustomerOrdersFocusPanels === 'function') renderCustomerOrdersFocusPanels();
            if (typeof window.renderCustomerPurchasesTab === 'function') window.renderCustomerPurchasesTab();
        }

        document.addEventListener('DOMContentLoaded', async () => {
            await ensureCustomerIdentity();
            window.__newketCustomerOrdersReady = false;
            window.__newketCustomerOrdersFallbackReady = false;
            renderOrders();
            renderFavorites();
            renderDashboardNotifications();

            // Show Admin Link for Suppliers
            const role = localStorage.getItem('newketRole');
            if (role === 'supplier') {
                const supplierLink = document.getElementById('supplier-link-container');
                if (supplierLink) supplierLink.classList.remove('hidden');
            }

            // Load Dashboard Stats
            renderCustomerDashboardStats();

            // Default view: restore from URL hash if present, otherwise show dashboard
            (function () {
                try {
                    const raw = (window.location.hash || '').replace(/^#/, '').trim();
                    const decoded = raw ? decodeURIComponent(raw) : '';
                    const tab = (decoded.split(/[?&]/)[0] || '').trim();
                    const validTabs = ['dashboard', 'orders', 'purchases', 'favorites', 'notifications', 'settings'];
                    switchTab(validTabs.includes(tab) ? tab : 'dashboard');
                } catch (e) {
                    switchTab('dashboard');
                }
            })();

            // Load Profile Settings
            const applyCustomerProfileSettings = (profile = ProfileManager.getProfile()) => {
                const nameInput = document.getElementById('profName');
                const emailInput = document.getElementById('profEmail');
                const phoneInput = document.getElementById('profPhone');
                if (nameInput) nameInput.value = profile.name || '';
                if (emailInput) emailInput.value = profile.email || '';
                if (phoneInput) {
                    phoneInput.value =
                        profile.phone ||
                        profile.store_phone ||
                        localStorage.getItem('newketUserPhone') ||
                        '';
                }
            };

            const profile = ProfileManager.getProfile();
            applyCustomerProfileSettings(profile);
            bindReferralPanelActions();
            await refreshReferralPanel();
            const avatarUploadBtn = document.getElementById('changeProfileAvatarBtn');
            const avatarUploadInput = document.getElementById('customerAvatarUploadInput');
            const initialAvatarName = profile.name || localStorage.getItem('newketUserName') || localStorage.getItem('newketUserEmail') || 'Utilisateur';
            const initialAvatarUrl = profile.avatar || localStorage.getItem('newketUserAvatar') || '';
            renderCustomerProfileAvatarPreview(initialAvatarName, initialAvatarUrl);

            if (avatarUploadBtn && avatarUploadInput) {
                avatarUploadBtn.addEventListener('click', () => avatarUploadInput.click());
                avatarUploadInput.addEventListener('change', (event) => {
                    const selectedFile = event.target.files?.[0];
                    if (selectedFile) {
                        handleCustomerAvatarUpload(selectedFile);
                    }
                });
            }

            initCustomerResidenceMap();

            // Avatar & name
            const userName = profile.name || localStorage.getItem('newketUserName');
            const userEmail = localStorage.getItem('newketUserEmail');
            const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Utilisateur');
            const avatarUrl = profile.avatar || localStorage.getItem('newketUserAvatar');

            const nameEl = document.getElementById('userDisplayName');
            if (nameEl) nameEl.textContent = displayName;

            const refreshCustomerSidebarAvatar = async () => {
                const currentProfile = ProfileManager.getProfile();
                const currentName = currentProfile.name || localStorage.getItem('newketUserName') || displayName;
                let currentAvatar = currentProfile.avatar || localStorage.getItem('newketUserAvatar') || avatarUrl;

                if (!currentAvatar && window.SupabaseAdapter?.getClient) {
                    try {
                        const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                        currentAvatar =
                            user?.user_metadata?.avatar_url ||
                            user?.user_metadata?.avatarUrl ||
                            user?.user_metadata?.picture ||
                            user?.user_metadata?.picture_url ||
                            user?.user_metadata?.photo_url ||
                            user?.user_metadata?.photoURL ||
                            user?.user_metadata?.avatar ||
                            user?.identities?.[0]?.identity_data?.picture ||
                            user?.identities?.[0]?.identity_data?.avatar_url ||
                            currentAvatar;
                        if (!currentAvatar && user?.id && window.SupabaseAdapter.fetchWithFilters) {
                            const dbProfile = await window.SupabaseAdapter.fetchWithFilters('users', {
                                eq: [['id', user.id]],
                                single: true,
                                skipCache: true
                            });
                            currentAvatar = dbProfile?.avatar || dbProfile?.avatar_url || dbProfile?.picture || dbProfile?.photo_url || currentAvatar;
                        }
                    } catch (_) {}
                }

                if (window.renderAvatar) {
                    renderAvatar(currentName, currentAvatar, 'userAvatarImg', 'userAvatarPlaceholder');
                }
            };

            refreshCustomerSidebarAvatar();
            window.addEventListener('profileUpdated', refreshCustomerSidebarAvatar);
            window.addEventListener('profileUpdated', (event) => {
                applyCustomerProfileSettings(event?.detail || ProfileManager.getProfile());
            });
            window.addEventListener('profileUpdated', () => {
                const updatedProfile = ProfileManager.getProfile();
                renderCustomerProfileAvatarPreview(
                    updatedProfile.name || localStorage.getItem('newketUserName') || displayName,
                    updatedProfile.avatar || localStorage.getItem('newketUserAvatar') || ''
                );
            });

            // Status badge (after stats load)
            setTimeout(() => {
                const ptsEl = document.getElementById('customer-newket-points');
                const pts = ptsEl ? parseInt(ptsEl.textContent) || 0 : 0;
                renderStatusBadge(pts);
            }, 600);

            // Listen to data updates from Supabase
            window.addEventListener('ordersUpdated', () => {
                window.__newketCustomerOrdersReady = true;
                renderOrders();
                renderCustomerDashboardStats();
            });
            window.addEventListener('activitiesUpdated', () => {
                renderCustomerDashboardStats();
            });
            window.addEventListener('notificationsUpdated', () => {
                renderDashboardNotifications();
            });
            window.addEventListener('favoritesUpdated', () => {
                renderFavorites();
            });
            window.addEventListener('storage', (event) => {
                if (event.key !== orderRefreshSignalKey || !event.newValue) return;
                loadDashboardData().catch(console.error);
            });

            // Fallback: if orders never load (offline/dev/auth mismatch), stop skeletons and show empty states.
            setTimeout(() => {
                if (window.__newketCustomerOrdersReady !== true) {
                    window.__newketCustomerOrdersReady = true;
                    window.__newketCustomerOrdersFallbackReady = true;
                    try { renderOrders(); } catch (_) {}
                    try { renderCustomerDashboardStats(); } catch (_) {}
                }
            }, 5500);
        });

        // Profile Form Submit
        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('profName').value;
            const profile = {
                name,
                email: document.getElementById('profEmail').value,
                phone: document.getElementById('profPhone').value
            };
            try {
                const result = await window.ApiClient.put('/profile/me', { name: profile.name, phone: profile.phone });
                const saved = result?.data || {};
                const savedPhone = saved.phone || saved.store_phone || profile.phone;
                ProfileManager.saveProfile({ ...profile, ...saved, phone: savedPhone });
                document.getElementById('userDisplayName').textContent = (saved.name || name) || 'Mon Compte';
                renderAvatar(saved.name || name, (saved.avatar || profile.avatar) || localStorage.getItem('newketUserAvatar'), 'userAvatarImg', 'userAvatarPlaceholder');
                showToast('Profil mis à jour avec succès !', 'success');
            } catch (err) {
                console.error('[Customer Profile] Update error:', err);
                showToast('Erreur lors de la mise à jour du profil.', 'error');
            }
        });

        function syncPasswordFormMode() {
            const currentPasswordGroup = document.getElementById('currentPasswordGroup');
            const currentPasswordInput = document.getElementById('currentPassword');
            const oauthHint = document.getElementById('passwordOauthHint');
            const requiresCurrentPassword = !!window.AuthManager?.requiresCurrentPassword?.();
            const isOauthOnly = !requiresCurrentPassword;

            if (currentPasswordGroup) currentPasswordGroup.classList.toggle('hidden', isOauthOnly);
            if (oauthHint) oauthHint.classList.toggle('hidden', !isOauthOnly);
            if (currentPasswordInput) {
                currentPasswordInput.required = requiresCurrentPassword;
                if (isOauthOnly) currentPasswordInput.value = '';
            }
            const usernameInput = document.getElementById('cPasswordUsername');
            if (usernameInput) {
                usernameInput.value = localStorage.getItem('newketUserEmail') || '';
            }
        }

        // Password Form Submit
        document.getElementById('passwordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPass = (document.getElementById('currentPassword')?.value || '').trim();
            const np = (document.getElementById('newPassword')?.value || '').trim();
            const cp = (document.getElementById('confirmPassword')?.value || '').trim();
            const requiresCurrentPassword = !!window.AuthManager?.requiresCurrentPassword?.();

            if (requiresCurrentPassword && !currentPass) { showToast('Veuillez saisir votre mot de passe actuel.', 'error'); return; }
            if (!np) { showToast('Veuillez saisir un nouveau mot de passe.', 'error'); return; }
            if (np.length < 8) { showToast('Le mot de passe doit faire au moins 8 caractères.', 'error'); return; }
            if (np !== cp) { showToast('Les mots de passe ne correspondent pas.', 'error'); return; }

            try {
                if (!window.AuthManager || typeof window.AuthManager.changePassword !== 'function') {
                    throw new Error("Fonction de changement de mot de passe indisponible (AuthManager.changePassword).");
                }

                await window.AuthManager.changePassword(currentPass, np);

                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                showToast('Mot de passe mis à jour avec succès !', 'success');
            } catch (err) {
                console.error('Erreur password:', err);
                showToast('Erreur lors de la mise à jour : ' + err.message, 'error');
            }
        });

        // Passkeys
        const registerPasskeyBtnCust = document.getElementById('registerPasskeyBtnCust');
        
        // Render Passkeys List
        const customerPasskeysList = document.getElementById('customerPasskeysList');
        
        const renderCustomerPasskeys = (passkeys) => {
            if (!customerPasskeysList) return;
            if (!passkeys || passkeys.length === 0) {
                customerPasskeysList.classList.add('hidden');
                customerPasskeysList.innerHTML = '';
                return;
            }
            
            customerPasskeysList.classList.remove('hidden');
            customerPasskeysList.innerHTML = passkeys.map(pk => {
                const date = new Date(pk.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
                const name = pk.friendly_name || pk.name || 'Appareil inconnu';
                
                let pkType = 'WebAuthn / Biométrie';
                let icon = 'solar:key-minimalistic-bold';
                const lowerName = name.toLowerCase();
                
                if (lowerName.includes('apple') || lowerName.includes('mac') || lowerName.includes('iphone') || lowerName.includes('ipad')) {
                    pkType = 'Passkey Apple (Face ID / Touch ID)';
                    icon = 'bi:apple';
                } else if (lowerName.includes('windows')) {
                    pkType = 'Windows Hello (Empreinte / Code)';
                    icon = 'bi:windows';
                } else if (lowerName.includes('android')) {
                    pkType = 'Passkey Android';
                    icon = 'bi:android2';
                } else if (lowerName.includes('yubikey') || lowerName.includes('security key')) {
                    pkType = 'Clé de sécurité physique';
                    icon = 'solar:usb-bold';
                }
                
                return `
                    <div class="flex flex-wrap sm:flex-nowrap items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50 gap-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 text-gray-500 shrink-0">
                                <iconify-icon icon="${icon}" width="18"></iconify-icon>
                            </div>
                            <div class="min-w-0">
                                <p class="text-sm font-bold text-gray-900 truncate">${name}</p>
                                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Ajoutée le ${date}</p>
                                    <span class="text-[10px] text-gray-300 hidden sm:inline">•</span>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Type : ${pkType}</p>
                                </div>
                            </div>
                        </div>
                        <div class="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-green-100 text-green-800 rounded">
                            Opérationnelle
                        </div>
                    </div>
                `;
            }).join('');
        };
        
        const loadCustomerPasskeys = () => {
            if (window.supabaseClient && window.supabaseClient.auth.passkey) {
                window.supabaseClient.auth.passkey.list().then(({ data }) => {
                    renderCustomerPasskeys(data);
                    if (data && data.length > 0) {
                        const title = registerPasskeyBtnCust.closest('div').querySelector('h2');
                        if (title && !title.innerHTML.includes('Activée')) {
                            title.innerHTML += ' <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-green-100 text-green-800 normal-case tracking-normal">Activée</span>';
                        }
                        registerPasskeyBtnCust.innerHTML = '<iconify-icon icon="solar:fingerprint-bold" width="20"></iconify-icon> Créer une autre clé d\'accès';
                    } else {
                        const title = registerPasskeyBtnCust.closest('div').querySelector('h2');
                        if (title && title.innerHTML.includes('Activée')) {
                            title.innerHTML = "Clé d'accès (Passkey)";
                        }
                        registerPasskeyBtnCust.innerHTML = '<iconify-icon icon="solar:fingerprint-bold" width="20"></iconify-icon> Créer une clé d\'accès';
                    }
                }).catch(err => console.error("Erreur passkeys:", err));
            }
        };

        if (window.newketInitialized) {
            loadCustomerPasskeys();
        } else {
            window.addEventListener('newketInitialized', loadCustomerPasskeys);
        }

        if (registerPasskeyBtnCust) {
            registerPasskeyBtnCust.addEventListener('click', async () => {
                if (!window.supabaseClient || !window.supabaseClient.auth.registerPasskey) {
                    showToast("Votre navigateur ne supporte pas encore cette fonctionnalité.", "error");
                    return;
                }
                const originalText = registerPasskeyBtnCust.innerHTML;
                registerPasskeyBtnCust.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Création...';
                registerPasskeyBtnCust.disabled = true;
                try {
                    const { data, error } = await window.supabaseClient.auth.registerPasskey();
                    if (error) throw error;
                    showToast("Clé d'accès créée avec succès !", "success");
                    loadCustomerPasskeys();
                } catch (err) {
                    console.error('Passkey registration error:', err);
                    let msg = err.message || "Erreur lors de la création de la clé d'accès.";
                    if (msg.includes('cancelled') || msg.includes('cancel')) {
                        msg = "Création annulée.";
                    }
                    showToast(msg, 'error');
                } finally {
                    registerPasskeyBtnCust.innerHTML = originalText;
                    registerPasskeyBtnCust.disabled = false;
                }
            });
        }

        function getReferralLoginLink(code) {
            const loginPath = typeof window.resolvePath === 'function' ? window.resolvePath('login') : '/pages/login';
            const url = new URL(loginPath, window.location.origin);
            url.searchParams.set('signup', '1');
            url.searchParams.set('ref', code);
            return url.toString();
        }

        function formatNkTokenUsd(amount) {
            const value = Number(amount || 0);
            return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}$`;
        }

        async function refreshReferralPanel(retryCount = 0) {
            const codeInput = document.getElementById('referralCodeDisplay');
            const linkInput = document.getElementById('referralLinkDisplay');
            const totalEl = document.getElementById('referralTotalCount');
            const pendingEl = document.getElementById('referralPendingCount');
            const qualifiedEl = document.getElementById('referralQualifiedCount');
            const claimInput = document.getElementById('referralClaimCode');
            const balanceEl = document.getElementById('referralNkTokenBalance');
            const balanceUsdEl = document.getElementById('referralNkTokenBalanceUsd');
            const usdBadgeEl = document.getElementById('referralNkTokenUsdBadge');
            const historyCountEl = document.getElementById('referralRewardHistoryCount');
            const historyEl = document.getElementById('referralRewardHistory');

            if (!codeInput || !linkInput) return;

            try {
                const data = await window.ApiClient.get('/referrals/me', {
                    suppressToast: true,
                    suppressErrorLogging: true,
                    suppressNetworkError: true
                });

                const code = data?.referral_code || '';
                const link = code ? getReferralLoginLink(code) : '';
                const stats = data?.stats || {};
                const balance = Number(data?.nk_token_balance || 0);
                const balanceUsd = Number(data?.nk_token_balance_usd || 0);
                const rateUsd = Number(data?.nk_token_rate_usd || 0.5);
                const rewardHistory = Array.isArray(data?.reward_history) ? data.reward_history : [];

                codeInput.value = code;
                linkInput.value = link;
                if (totalEl) totalEl.textContent = String(stats.total || 0);
                if (pendingEl) pendingEl.textContent = String(stats.pending || 0);
                if (qualifiedEl) qualifiedEl.textContent = String((stats.qualified || 0) + (stats.rewarded || 0));
                window.__newketNkTokenBalance = balance;
                window.__newketNkTokenUsdValue = rateUsd;
                const pointsEl = document.getElementById('customer-newket-points');
                if (pointsEl) pointsEl.textContent = `${balance} NKToken`;
                if (balanceEl) balanceEl.textContent = `${balance} NKToken`;
                if (balanceUsdEl) balanceUsdEl.textContent = `H ${formatNkTokenUsd(balanceUsd)}`;
                if (usdBadgeEl) usdBadgeEl.textContent = formatNkTokenUsd(balanceUsd);
                if (historyCountEl) historyCountEl.textContent = String(rewardHistory.length);
                if (historyEl) {
                    if (rewardHistory.length === 0) {
                        historyEl.innerHTML = '<div class="text-sm text-gray-400">Aucune récompense pour le moment.</div>';
                    } else {
                        historyEl.innerHTML = rewardHistory.slice(0, 6).map((reward) => {
                            const inviteeName = reward?.invitee?.name || reward?.invitee?.email || 'Client';
                            const rewardAmount = Number(reward?.reward_amount || 0);
                            const rewardAmountUsd = Number(reward?.reward_amount_usd || rewardAmount * rateUsd);
                            const rewardedAt = reward?.rewarded_at ? new Date(reward.rewarded_at).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                            }) : 'Date inconnue';
                            return `
                                <div class="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                                    <div class="min-w-0">
                                        <div class="text-sm font-black text-gray-900 truncate">${inviteeName}</div>
                                        <div class="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Récompense conclue le ${rewardedAt}</div>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <div class="text-sm font-black text-emerald-700">+${rewardAmount} NKToken</div>
                                        <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">H ${formatNkTokenUsd(rewardAmountUsd)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                }

                if (claimInput && data?.referred_by_code && !claimInput.value) {
                    claimInput.value = data.referred_by_code;
                }
            } catch (error) {
                console.warn(`[Customer Referral] Unable to load referral summary (attempt ${retryCount + 1}):`, error?.message || error);
                if (retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => refreshReferralPanel(retryCount + 1), delay);
                }
            }
        }

        async function claimReferralCode() {
            const claimInput = document.getElementById('referralClaimCode');
            const hint = document.getElementById('referralHint');
            const button = document.getElementById('claimReferralBtn');
            if (!claimInput || !button) return;

            const code = claimInput.value.trim();
            if (!code) {
                showToast('Colle un code de parrainage avant de valider.', 'warning');
                return;
            }

            button.disabled = true;
            button.textContent = '...';

            try {
                await window.ApiClient.post('/referrals/claim', { code }, {
                    suppressToast: true,
                    suppressErrorLogging: true
                });

                localStorage.removeItem('newketReferralCode');
                if (hint) hint.textContent = 'Code validé. Le parrainage est maintenant rattaché à ton compte.';
                showToast('Code de parrainage validé.', 'success');
                await refreshReferralPanel();
            } catch (error) {
                console.error('[Customer Referral] Claim error:', error);
                showToast(error?.message || 'Impossible de valider ce code.', 'error');
            } finally {
                button.disabled = false;
                button.textContent = 'Valider';
            }
        }

        function bindReferralPanelActions() {
            const codeBtn = document.getElementById('copyReferralCodeBtn');
            const linkBtn = document.getElementById('copyReferralLinkBtn');
            const claimBtn = document.getElementById('claimReferralBtn');
            const codeInput = document.getElementById('referralCodeDisplay');
            const linkInput = document.getElementById('referralLinkDisplay');

            const copyValue = async (value, label) => {
                if (!value) return;
                try {
                    await navigator.clipboard.writeText(value);
                    showToast(`${label} copié.`, 'success');
                } catch {
                    showToast('Impossible de copier automatiquement.', 'warning');
                }
            };

            if (codeBtn && codeInput) {
                codeBtn.addEventListener('click', () => copyValue(codeInput.value, 'Code'));
            }

            if (linkBtn && linkInput) {
                linkBtn.addEventListener('click', () => copyValue(linkInput.value, 'Lien'));
            }

            if (claimBtn) {
                claimBtn.addEventListener('click', claimReferralCode);
            }
        }

        syncPasswordFormMode();
        window.addEventListener('newketInitialized', syncPasswordFormMode);

        function renderDashboardNotifications() {
            const list = document.getElementById('dashboard-notifications-list');
            if (!list) return;

            if (!window.NotificationManager || typeof NotificationManager.getNotifications !== 'function') {
                // Show skeleton only while waiting on async orders/app boot (no forced/min duration).
                if (isCustomerOrdersDataPending() && typeof window.buildSkeletonNotificationHTML === 'function') {
                    list.innerHTML = window.buildSkeletonNotificationHTML(3);
                } else {
                    list.innerHTML = `
                        <div class="glass-panel p-12 text-center text-gray-400">
                            <iconify-icon icon="solar:bell-off-linear" width="48" class="mb-4 text-gray-200"></iconify-icon>
                            <p>Notifications indisponibles</p>
                        </div>
                    `;
                }
                return;
            }

            const notifications = NotificationManager.getNotifications();

            if (notifications.length === 0) {
                list.innerHTML = `
                    <div class="glass-panel p-12 text-center text-gray-400">
                        <iconify-icon icon="solar:bell-off-linear" width="48" class="mb-4 text-gray-200"></iconify-icon>
                        <p>Aucune notification</p>
                    </div>
                `;
            } else {
                list.innerHTML = notifications.map(n => {
                    const type = window.normalizeNotificationType ? window.normalizeNotificationType(n.type) : n.type;
                    let icon = 'solar:bell-linear';
                    let iconColor = 'bg-gray-50 text-gray-400';
                    if (type === 'success') { icon = 'solar:check-circle-bold'; iconColor = 'bg-green-50 text-green-500'; }
                    else if (type === 'error' || type === 'danger') { icon = 'solar:danger-circle-bold'; iconColor = 'bg-red-50 text-red-500'; }
                    else if (type === 'warning') { icon = 'solar:bell-bing-bold'; iconColor = 'bg-orange-50 text-orange-500'; }
                    else if (type === 'info') { icon = 'solar:info-circle-bold'; iconColor = 'bg-blue-50 text-blue-500'; }

                    return `
                        <div class="glass-panel p-4 flex gap-4 items-center ${!n.read ? 'bg-black/[0.02] border-black/10' : ''} cursor-pointer hover:border-black/20 transition-all" onclick="NotificationManager.markAsRead('${n.id}'); renderDashboardNotifications();">
                            <div class="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${iconColor}">
                                <iconify-icon icon="${icon}" width="20"></iconify-icon>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between mb-0.5">
                                    <h3 class="font-bold text-sm ${!n.read ? 'text-black' : 'text-gray-600'}">${n.title}</h3>
                                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">${new Date(n.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                                </div>
                                <p class="text-xs text-gray-500 truncate">${n.message}</p>
                            </div>
                            ${!n.read ? '<div class="w-1.5 h-1.5 rounded-full bg-black"></div>' : ''}
                        </div>
                    `;
                }).join('');
            }
        }

        function renderCustomerDashboardStats() {
            const email = localStorage.getItem('newketUserEmail');
            const userId = localStorage.getItem('newketUserId');
            const spentEl = document.getElementById('customer-total-spent');
            const countEl = document.getElementById('customer-order-count');
            const avgEl = document.getElementById('customer-avg-order');
            const pointsEl = document.getElementById('customer-newket-points');
            const feed = document.getElementById('customer-activity-feed');

            const isOrdersLoading = isCustomerOrdersDataPending();

            function setInlineSkeleton(el, width) {
                if (!el) return;
                el.innerHTML = `<div class="skeleton skeleton-text" style="width:${width};height:1em;margin:0;"></div>`;
            }

            // Only show skeleton while waiting for async calls (no forced/min duration).
            if (isOrdersLoading) {
                setInlineSkeleton(countEl, '55%');
                setInlineSkeleton(spentEl, '70%');
                setInlineSkeleton(avgEl, '60%');
                setInlineSkeleton(pointsEl, '50%');

                if (feed && typeof window.buildSkeletonPanelListHTML === 'function') {
                    feed.innerHTML = window.buildSkeletonPanelListHTML(3, { lines: 2, showAvatar: true, cardClass: 'glass-panel p-4' });
                }
                return;
            }

            if ((!window.ActivityManager || typeof ActivityManager.getRecentActivity !== 'function') && feed) {
                feed.innerHTML = '<p class="text-sm text-gray-400 py-4">Activit&eacute; indisponible pour le moment.</p>';
            }

            // Orders focus panels (active orders + required actions)
            if (typeof renderCustomerOrdersFocusPanels === 'function') {
                renderCustomerOrdersFocusPanels();
            }

            // If core managers are missing, don't leave skeletons stuck.
            if (!window.OrderManager || typeof OrderManager.getCustomerStats !== 'function' || !window.CurrencyManager || typeof CurrencyManager.formatPrice !== 'function') {
                if (spentEl) spentEl.textContent = '--';
                if (countEl) countEl.textContent = '--';
                if (avgEl) avgEl.textContent = '--';
                if (pointsEl) pointsEl.textContent = '--';
                return;
            }

            if (!email && !userId) {
                if (spentEl) spentEl.textContent = '0';
                if (countEl) countEl.textContent = '0';
                if (avgEl) avgEl.textContent = 'Aujourd\'hui';
                if (pointsEl) pointsEl.textContent = '0 NKToken';
                if (feed) {
                    feed.innerHTML = '<p class="text-sm text-gray-400 py-4">Aucune activité pour le moment.</p>';
                }
                return;
            }

            const stats = OrderManager.getCustomerStats(email, userId);

            if (spentEl) spentEl.textContent = CurrencyManager.formatPrice(stats.totalSpent);
            if (countEl) countEl.textContent = stats.totalOrders;
            if (avgEl) avgEl.textContent = CurrencyManager.formatPrice(stats.avgOrderValue);
            if (pointsEl) pointsEl.textContent = `${Number(window.__newketNkTokenBalance || 0)} NKToken`;

            // Render Activity Feed
            if (feed) {
                if (!window.ActivityManager || typeof ActivityManager.getRecentActivity !== 'function') return;
                const activities = ActivityManager.getRecentActivity(4);
                if (activities.length === 0) {
                    feed.innerHTML = '<p class="text-sm text-gray-400 py-4">Aucune activité pour le moment.</p>';
                } else {
                    feed.innerHTML = activities.map(a => `
                        <div class="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-2xl transition-all">
                            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs flex-shrink-0">
                                ${a.type === 'stock' ? '' : ''}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-900 truncate">${a.text}</p>
                                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${ActivityManager.formatTime(a.time)}</p>
                            </div>
                        </div>
                    `).join('');
                }
            }
        }

        function getCustomerOrdersForDashboard() {
            const email = localStorage.getItem('newketUserEmail');
            const userId = localStorage.getItem('newketUserId');
            if (!window.OrderManager || typeof OrderManager.getOrders !== 'function') return [];
            const all = (OrderManager.getOrders() || []).filter(Boolean);
            if (!email && !userId) return [];
            return all.filter(o =>
                (email && o.customer_email === email) ||
                (userId && (o.user_id === userId || o.customer_id === userId))
            );
        }

        function safeTextLite(v) {
            if (v === null || v === undefined) return '';
            return String(v);
        }

        function isCustomerOrderActive(status) {
            const s = String(status || '').toUpperCase();
            if (!s) return false;
            return !['CANCELLED', 'REFUNDED', 'COMPLETED', 'RELEASED'].includes(s);
        }

        function getCustomerNextAction(order) {
            const status = String(order?.status || '').toUpperCase();
            const hasDispute = status === 'DISPUTED' || status === 'DISPUTE_OPEN';

            if (hasDispute) {
                return { label: 'Voir le litige', icon: 'solar:shield-warning-bold', required: true, kind: 'achat' };
            }
            if (status === 'QUOTE') {
                return { label: 'Voir le devis', icon: 'solar:bill-list-bold', required: true, kind: 'modal' };
            }
            if (status === 'READY_FOR_PAYMENT') {
                return { label: 'Payer maintenant', icon: 'solar:card-send-bold', required: true, kind: 'modal' };
            }
            if (status === 'DELIVERED') {
                return { label: 'Libérer les fonds', icon: 'solar:check-read-bold', required: true, kind: 'achat' };
            }
            if (['PAID_HELD', 'IN_DELIVERY', 'SHIPPED', 'PROCESSING'].includes(status)) {
                return { label: 'Suivre la commande', icon: 'solar:map-point-wave-bold', required: false, kind: 'achat' };
            }
            return { label: 'Voir les détails', icon: 'solar:eye-bold', required: false, kind: 'modal' };
        }

        function renderCustomerOrdersFocusPanels() {
            const listEl = document.getElementById('customer-active-orders-list');
            const actionsEl = document.getElementById('customer-required-actions');
            if (!listEl || !actionsEl) return;

            const orders = getCustomerOrdersForDashboard()
                .slice()
                .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

            const isOrdersLoading = isCustomerOrdersDataPending() && orders.length === 0 && window.__newketCustomerOrdersFallbackReady !== true;
            if (isOrdersLoading && typeof window.buildSkeletonPanelListHTML === 'function') {
                listEl.innerHTML = window.buildSkeletonPanelListHTML(2, { lines: 2, cardClass: 'glass-panel p-4' });
                actionsEl.innerHTML = window.buildSkeletonPanelListHTML(1, { lines: 2, cardClass: 'glass-panel p-4' });
                return;
            }

            const active = orders.filter(o => isCustomerOrderActive(o.status));
            const topActive = active.slice(0, 3);

            if (topActive.length === 0) {
                listEl.innerHTML = `
                    <div class="glass-panel p-8 text-center text-gray-500">
                        <iconify-icon icon="solar:bag-2-bold" width="44" class="mb-3 text-gray-300"></iconify-icon>
                        <p class="font-bold text-gray-900">Aucune commande en cours</p>
                        <p class="mt-2 text-sm">Explorez le catalogue et lancez une demande.</p>
                        <a href="/src/pages/catalog.html" class="inline-block mt-4 text-xs font-black tracking-widest uppercase text-black border-b border-black">Voir le catalogue</a>
                    </div>
                `;
            } else {
                listEl.innerHTML = topActive.map(order => {
                    const id = safeTextLite(order?.id);
                    const productName = safeTextLite(order?.items?.[0]?.name || order?.product_name || 'Produit');
                    const statusLabel = window.OrderManager ? safeTextLite(OrderManager.getStatusLabel(order?.status)) : safeTextLite(order?.status);
                    const amount = (window.CurrencyManager && typeof CurrencyManager.formatPrice === 'function')
                        ? CurrencyManager.formatPrice(Number(order?.final_total_amount ?? order?.total ?? 0))
                        : String(order?.final_total_amount ?? order?.total ?? 0);
                    const next = getCustomerNextAction(order);
                    const dateLabel = order?.date ? new Date(order.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '';

                    const onClick = next.kind === 'achat'
                        ? `window.goToAchatOrder && window.goToAchatOrder('${id}')`
                        : `(typeof openOrderModal === 'function') && openOrderModal('${id}')`;

                    return `
                        <div class="glass-panel p-4 hover:border-black/20 transition-all">
                            <div class="flex items-start justify-between gap-3 sm:gap-4">
                                <div class="min-w-0 flex-1">
                                    <div class="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 truncate">Commande #${id}${dateLabel ? `  -  ${dateLabel}` : ''}</div>
                                    <div class="mt-1 font-black text-gray-900 truncate">${productName}</div>
                                    <div class="mt-1 text-xs sm:text-sm text-gray-500 flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1">
                                        <span class="font-semibold text-gray-700">${statusLabel}</span>
                                        <span class="text-gray-300">|</span>
                                        <span>${safeTextLite(amount)}</span>
                                    </div>
                                </div>
                                <button type="button"
                                    class="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-black text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest hover:bg-gray-900 transition-colors whitespace-nowrap flex items-center gap-1.5"
                                    onclick="${onClick}">
                                    <iconify-icon icon="${next.icon}" width="16"></iconify-icon>
                                    <span class="hidden sm:inline">${next.label}</span>
                                    <span class="sm:hidden">${next.label.replace('Voir les détails', 'Détails').replace('Voir le litige', 'Litige').replace('Voir le devis', 'Devis').replace('Payer maintenant', 'Payer').replace('Libérer les fonds', 'Libérer').replace('Suivre la commande', 'Suivre')}</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            const required = active
                .map(o => ({ order: o, next: getCustomerNextAction(o) }))
                .filter(x => x.next.required)
                .slice(0, 4);

            if (required.length === 0) {
                actionsEl.innerHTML = `
                    <div class="glass-panel p-6 text-center text-gray-500">
                        <iconify-icon icon="solar:check-circle-bold" width="40" class="mb-3 text-gray-300"></iconify-icon>
                        <p class="font-bold text-gray-900">Rien d'urgent</p>
                        <p class="mt-1 text-sm">Vos commandes avancent normalement.</p>
                    </div>
                `;
            } else {
                actionsEl.innerHTML = required.map(({ order, next }) => {
                    const id = safeTextLite(order?.id);
                    const productName = safeTextLite(order?.items?.[0]?.name || order?.product_name || 'Produit');
                    const onClick = next.kind === 'achat'
                        ? `window.goToAchatOrder && window.goToAchatOrder('${id}')`
                        : `(typeof openOrderModal === 'function') && openOrderModal('${id}')`;
                    return `
                        <div class="glass-panel p-4 flex items-center justify-between gap-3 hover:border-black/20 transition-all">
                            <div class="min-w-0">
                                <div class="text-xs font-black uppercase tracking-widest text-gray-400 truncate">#${id}</div>
                                <div class="mt-1 text-sm font-bold text-gray-900 truncate">${productName}</div>
                                <div class="mt-1 text-xs text-gray-500 font-semibold">${next.label}</div>
                            </div>
                            <button type="button"
                                class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors flex items-center justify-center shrink-0"
                                aria-label="${next.label}"
                                onclick="${onClick}">
                                <iconify-icon icon="${next.icon}" width="18"></iconify-icon>
                            </button>
                        </div>
                    `;
                }).join('');
            }
        }

        // Re-render dashboard values when currency changes
        (function bindCustomerCurrencyRerender() {
            if (window.__newketCustomerCurrencyBound) return;
            window.__newketCustomerCurrencyBound = true;

            window.addEventListener('currencyChanged', () => {
                try {
                    if (typeof renderCustomerDashboardStats === 'function') renderCustomerDashboardStats();
                    if (typeof renderCustomerOrdersFocusPanels === 'function') renderCustomerOrdersFocusPanels();
                    if (typeof renderOrders === 'function') renderOrders();
                    if (typeof renderFavorites === 'function') renderFavorites();
                } catch (e) {}
            });
        })();

        function renderOrders() {
            const email = localStorage.getItem('newketUserEmail');
            const userId = localStorage.getItem('newketUserId');
            let orders = [];

            const ordersList = document.getElementById('orders-list');
            if (!ordersList) return;

            if (!window.OrderManager || typeof OrderManager.getOrders !== 'function') {
                ordersList.innerHTML = `
                    <div class="glass-panel p-12 text-center text-gray-500">
                        <iconify-icon icon="solar:shield-warning-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                        <p>Module commandes indisponible</p>
                    </div>
                `;
                return;
            }

            const isOrdersLoading = isCustomerOrdersDataPending();
            if (isOrdersLoading && typeof window.buildSkeletonPanelListHTML === 'function') {
                ordersList.innerHTML = window.buildSkeletonPanelListHTML(3, { lines: 2, cardClass: 'glass-panel p-4' });
                return;
            }

            if (!window.CurrencyManager || typeof CurrencyManager.formatPrice !== 'function') {
                ordersList.innerHTML = `
                    <div class="glass-panel p-12 text-center text-gray-500">
                        <iconify-icon icon="solar:shield-warning-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                        <p>Module devise indisponible</p>
                    </div>
                `;
                return;
            }

            if (email || userId) {
                orders = OrderManager.getOrders().filter(o =>
                    (email && o.customer_email === email) ||
                    (userId && (o.user_id === userId || o.customer_id === userId))
                );
            }
            // Exclude orders already shown in "Mes achats" (paid / completed / delivered)
            orders = orders.filter(o => {
                const s = String(o?.status || '').toUpperCase();
                const ps = String(o?.payment_status || '').toUpperCase();
                const isPurchase =
                    ['PAID', 'SUCCESS', 'SUCCESSFUL', 'SUCCEEDED'].includes(ps) ||
                    ['PAID_HELD', 'IN_DELIVERY', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'RELEASED'].includes(s);
                return !isPurchase;
            });
            orders = orders.slice().sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

            const ordersBadge = document.getElementById('customerOrdersBadge');
            if (ordersBadge) {
                if (orders.length > 0) {
                    ordersBadge.textContent = String(orders.length);
                    ordersBadge.classList.remove('hidden');
                } else {
                    ordersBadge.classList.add('hidden');
                }
            }

            if (!ordersList) return; // Safeguard if DOM is not ready or element is missing
            if (orders.length === 0) {
                ordersList.innerHTML = `
                    <div class="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div class="w-24 h-24 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-6">
                            <iconify-icon icon="solar:bag-broken" width="48"></iconify-icon>
                        </div>
                        <div class="text-2xl font-bold text-gray-900 mb-2">Aucune commande pour le moment</div>
                        <div class="text-gray-500 mb-8 max-w-sm mx-auto">Vous n'avez pas encore envoyé de demande. L'exceptionnel vous attend, découvrez nos nouveautés.</div>
                        <div class="mt-6">
                            <a href="/src/pages/catalog.html" class="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-black transition-all">
                                Voir nos produits
                            </a>
                        </div>
                    </div>
                `;
            } else {
                ordersList.innerHTML = orders.map(order => {
                    const next = (typeof getCustomerNextAction === 'function')
                        ? getCustomerNextAction(order)
                        : { label: 'Voir les details', icon: 'solar:eye-bold', required: false, kind: 'modal' };
                    const actionOnClick = next.kind === 'achat'
                        ? `event.stopPropagation(); window.goToAchatOrder && window.goToAchatOrder('${order.id}')`
                        : `event.stopPropagation(); (typeof openOrderModal === 'function') && openOrderModal('${order.id}')`;
                    const timelineHTML = (typeof buildCustomerOrderTimelineHTML === 'function')
                        ? buildCustomerOrderTimelineHTML(order)
                        : '';

                    // Déterminer si c'est au client d'agir sur cette commande
                    const isCustomerTurn = next.required;
                    const yourTurnBadge = isCustomerTurn
                        ? `<span class="nk-your-turn-btn" onclick="event.stopPropagation(); ${actionOnClick}">
                               <span class="nk-your-turn-dot"></span>
                               À vous de jouer
                           </span>`
                        : '';

                    return `
                        <div class="glass-panel p-3 sm:p-4 cursor-pointer hover:border-black transition-all group${isCustomerTurn ? ' border-green-200' : ''}" onclick="openOrderModal('${order.id}')">
                            <div class="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
                                <div>
                                    <div class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">Demande #${order.id}</div>
                                    <div class="text-xs text-gray-500">${new Date(order.date).toLocaleDateString()}</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    ${yourTurnBadge}
                                    <div class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(order.status)}">
                                        ${window.OrderManager ? OrderManager.getStatusLabel(order.status) : order.status}
                                    </div>
                                    <iconify-icon icon="solar:alt-arrow-right-linear" width="18" class="text-gray-300 group-hover:text-black transition-colors"></iconify-icon>
                                </div>
                            </div>

                            ${timelineHTML ? `
                                <div class="mb-2">
                                    <div class="grid grid-cols-1 sm:grid-cols-5 gap-1">
                                        ${timelineHTML}
                                    </div>
                                </div>
                            ` : ''}

                            <div class="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2">
                                <div class="order-items-strip flex items-center gap-1.5 overflow-x-auto pb-0 scrollbar-none min-w-0">
                                    ${order.items.slice(0, 3).map(item => `
                                        <div class="w-8 h-8 bg-gray-50 rounded border border-gray-100 flex-shrink-0 p-1">
                                            <img src="${window.getOptimizedImageUrl(item.image)}"${window.buildResponsiveImageSrcSet ? ` srcset="${window.buildResponsiveImageSrcSet(item.image, [48, 72, 96], { quality: 70 })}" sizes="32px"` : ''} alt="${item.name || 'Produit'}" loading="lazy" class="w-full h-full object-contain" onerror="this.src=window.resolvePath('assets/Images/default.png')">
                                        </div>
                                    `).join('')}
                                    ${order.items.length > 3 ? `<div class="text-[10px] font-bold text-gray-400">+${order.items.length - 3}</div>` : ''}
                                </div>
                                <div class="flex items-center gap-2 sm:ml-auto sm:shrink-0">
                                    <button type="button"
                                        class="px-2.5 py-1 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-gray-900 transition-colors whitespace-nowrap"
                                        onclick="${actionOnClick}">
                                        <iconify-icon icon="${next.icon}" width="14"></iconify-icon>
                                        ${next.label}
                                    </button>
                                    <div class="text-sm font-black text-gray-900 whitespace-nowrap">${CurrencyManager.formatPrice(order.total)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        function renderFavorites() {
            const favoritesGrid = document.getElementById('favorites-grid');

            if (!favoritesGrid) return; // Safeguard if DOM is not ready or element is missing

            if (!window.FavoritesManager || typeof FavoritesManager.getFavorites !== 'function') {
                // Skeleton only during app init / async load. Otherwise, show a stable empty state.
                if (isCustomerOrdersDataPending() && typeof window.buildSkeletonCardHTML === 'function') {
                    favoritesGrid.innerHTML = window.buildSkeletonCardHTML(3);
                } else {
                    favoritesGrid.innerHTML = `
                        <div class="col-span-full glass-panel p-12 text-center text-gray-500">
                            <iconify-icon icon="solar:heart-broken-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                            <p>Liste de d&eacute;sirs indisponible</p>
                        </div>
                    `;
                }
                return;
            }

            const favorites = FavoritesManager.getFavorites();

            if (favorites.length === 0) {
                favoritesGrid.innerHTML = `
                    <div class="col-span-full text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div class="w-24 h-24 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-6">
                            <iconify-icon icon="solar:heart-broken-linear" width="48"></iconify-icon>
                        </div>
                        <div class="text-2xl font-bold text-gray-900 mb-2">Votre liste de désirs est vide</div>
                        <div class="text-gray-500 mb-8 max-w-sm mx-auto">Laissez-vous séduire par nos pièces d'exception et découvrez nos dernières nouveautés.</div>
                        <div class="mt-6">
                            <a href="/src/pages/catalog.html" class="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-black transition-all">
                                Voir nos produits
                            </a>
                        </div>
                    </div>
                `;
            } else {
                favoritesGrid.innerHTML = favorites.map(item => `
                    <div class="glass-panel p-3 sm:p-6 flex flex-col relative group">
                        <button onclick="removeFavorite('${item.id}')" class="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 transition-colors z-10">
                            <iconify-icon icon="solar:trash-bin-minimalistic-bold" width="18"></iconify-icon>
                        </button>
                        <div class="aspect-square bg-gray-50 rounded-xl mb-4 overflow-hidden">
                             <img src="${window.getOptimizedImageUrl(item.image)}"${window.buildResponsiveImageSrcSet ? ` srcset="${window.buildResponsiveImageSrcSet(item.image, [120, 180, 240], { quality: 75 })}" sizes="(max-width: 640px) 50vw, 160px"` : ''} alt="${item.name || 'Produit favori'}" loading="lazy" class="w-full h-full object-contain p-2 sm:p-4 group-hover:scale-110 transition-transform duration-500" onerror="this.src=window.resolvePath('assets/Images/default.png')">
                        </div>
                        <h3 class="font-bold text-gray-900 text-[10px] sm:text-base mb-1 truncate">${item.name}</h3>
                        <div class="text-[9px] sm:text-sm text-gray-500 mb-4">${CurrencyManager.formatPrice(item.price)}</div>
                        <button onclick="if(window.CartManager) window.CartManager.add({id: '${item.id}', title: '${(item.name||'').replace(/'/g, `\\'`).replace(/\"/g, '&quot;')}', price: '${item.price}', image: '${item.image || ''}', vendor: '${((item.users && (Array.isArray(item.users) ? item.users[0] : item.users))?.company_name || (item.users && (Array.isArray(item.users) ? item.users[0] : item.users))?.name || 'NewKet').replace(/'/g, `\\'`).replace(/\"/g, '&quot;')}'})"
                            class="w-full py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold tracking-normal sm:tracking-widest uppercase flex items-center justify-center gap-1 sm:gap-2 transition-colors shadow-sm hover:shadow-md"
                            aria-label="Ajouter ${String(item.name || 'produit').replace(/\"/g, '&quot;')} au panier">
                            <iconify-icon icon="solar:cart-plus-bold" width="14" class="flex-shrink-0 sm:w-4"></iconify-icon>
                            <span class="truncate">Ajouter au panier</span>
                        </button>
                    </div>
                `).join('');
            }

        function getStatusColor(status) {
            switch (status) {
                case 'PENDING': return 'bg-yellow-100 text-yellow-700';
                case 'QUOTE': return 'bg-orange-100 text-orange-700';
                case 'READY_FOR_PAYMENT': return 'bg-indigo-100 text-indigo-700';
                case 'PROCESSING': return 'bg-amber-100 text-amber-700';
                case 'IN_DELIVERY':
                case 'SHIPPED': return 'bg-blue-100 text-blue-700';
                case 'DELIVERED': return 'bg-teal-100 text-teal-700';
                case 'COMPLETED':
                case 'RELEASED': return 'bg-green-100 text-green-700';
                case 'CANCELLED': return 'bg-gray-100 text-gray-500';
                case 'REFUNDED': return 'bg-orange-100 text-orange-700';
                case 'PAID_HELD': return 'bg-purple-100 text-purple-700';
                case 'DISPUTE_OPEN':
                case 'DISPUTED': return 'bg-orange-100 text-orange-700';
                case 'FROZEN': return 'bg-red-100 text-red-700';
                default: return 'bg-gray-100 text-gray-700';
            }
        }

        // ===== Achat tab (same dashboard layout, no full page reload) =====
        (function() {
            let achatRenderToken = 0;

            function safeText(v) {
                if (v === null || v === undefined) return '';
                return String(v);
            }

            function parseHash() {
                try {
                    const raw = decodeURIComponent((window.location.hash || '').replace(/^#/, '').trim());
                    const match = raw.match(/^([^?&]+)(?:[?&](.*))?$/);
                    if (!match) return { tab: '', params: new URLSearchParams() };
                    const tab = (match[1] || '').trim();
                    const qs = (match[2] || '').trim();
                    return { tab, params: new URLSearchParams(qs) };
                } catch (e) {
                    return { tab: '', params: new URLSearchParams() };
                }
            }

            async function waitForAppReady() {
                if (window.newketInitialized) return;
                if (!isCustomerOrdersDataPending()) return;
                await new Promise((resolve) => {
                    const timer = setTimeout(resolve, 4000);
                    window.addEventListener('newketInitialized', () => { clearTimeout(timer); resolve(); }, { once: true });
                    window.addEventListener('ordersUpdated', () => { clearTimeout(timer); resolve(); }, { once: true });
                });
            }

            function getCustomerOrders() {
                try {
                    const email = localStorage.getItem('newketUserEmail');
                    const userId = localStorage.getItem('newketUserId');
                    const all = (window.OrderManager ? OrderManager.getOrders() : []) || [];
                    if (!email && !userId) return [];
                    return all.filter(o =>
                        o && (
                            (email && o.customer_email === email) ||
                            (userId && (o.user_id === userId || o.customer_id === userId))
                        )
                    );
                } catch (e) {
                    return [];
                }
            }

            function formatAmount(amount) {
                if (window.CurrencyManager && typeof CurrencyManager.formatPrice === 'function') {
                    return CurrencyManager.formatPrice(Number(amount || 0));
                }
                return `${amount || 0}`;
            }

            function setAchatHash(orderId) {
                if (!orderId) {
                    window.location.hash = 'purchases';
                    return;
                }
                window.location.hash = `purchases?order_id=${encodeURIComponent(orderId)}`;
            }

            window.goToAchatOrder = function(orderId) {
                setAchatHash(orderId);
                if (typeof window.switchTab === 'function') window.switchTab('purchases');
            };

            function renderEmpty(container) {
                container.innerHTML = `
                    <div class="glass-panel p-12 text-center text-gray-500">
                        <iconify-icon icon="solar:shop-2-bold" width="48" class="mb-4 text-gray-300"></iconify-icon>
                        <p class="font-bold text-gray-900">Aucun achat prêt pour paiement</p>
                        <p class="mt-2 text-sm">Retournez dans "Mes demandes et devis" pour suivre vos demandes.</p>
                        <div class="mt-6">
                            <button class="px-5 py-3 rounded-2xl bg-black text-white text-xs font-black tracking-widest uppercase hover:bg-gray-900 transition-colors" onclick="window.switchTab && window.switchTab('orders')">Aller aux demandes</button>
                        </div>
                    </div>
                `;
            }

            function buildAchatOrderCard(order) {
                const orderId = safeText(order?.id);
                const dateLabel = order?.date ? new Date(order.date).toLocaleDateString() : '';
                const statusLabel = window.OrderManager ? OrderManager.getStatusLabel(order.status) : safeText(order?.status);
                const total = formatAmount(order?.total ?? order?.final_total_amount ?? 0);
                const firstImg = order?.items?.[0]?.image || order?.product_image || '';
                const img = safeText(firstImg).split(',')[0];
                const productName = order?.items?.[0]?.name || order?.product_name || 'Produit';

                return `
                    <div class="glass-panel p-6 hover:border-black transition-all">
                        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div class="flex items-center gap-4 min-w-0 flex-1">
                                <div class="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                    <img src="${img ? (window.getOptimizedImageUrl ? window.getOptimizedImageUrl(img) : img) : window.resolvePath('assets/Images/default.png')}" alt="" loading="lazy" class="w-full h-full object-contain p-2" onerror="this.src=window.resolvePath('assets/Images/default.png')">
                                </div>
                                <div class="min-w-0">
                                    <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">Demande #${orderId}</div>
                                    <div class="mt-1 font-black text-gray-900 truncate">${safeText(productName)}</div>
                                    <div class="mt-1 text-sm text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span>${safeText(dateLabel)}</span>
                                        <span class="text-gray-300">|</span>
                                        <span class="font-semibold text-gray-700">${safeText(statusLabel)}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center justify-between sm:flex-col sm:items-end sm:justify-start gap-3 sm:gap-2">
                                <div class="text-lg sm:text-xl font-black tracking-tight text-gray-900 whitespace-nowrap">${total}</div>
                                <button class="px-5 py-3 rounded-2xl bg-black text-white text-xs font-black tracking-widest uppercase hover:bg-gray-900 transition-colors w-full sm:w-auto flex items-center justify-center gap-2"
                                    onclick="window.goToAchatOrder('${orderId}')">
                                    <iconify-icon icon="solar:arrow-right-bold" width="18"></iconify-icon>
                                    Continuer
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            async function renderAchatList(container) {
                container.innerHTML = '';
                const orders = getCustomerOrders();
                const ready = orders.filter(o => o && o.status === 'READY_FOR_PAYMENT');

                container.insertAdjacentHTML('beforeend', `
                    <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-900 flex items-start gap-3">
                        <iconify-icon icon="solar:info-circle-bold" width="22"></iconify-icon>
                        <div>
                            <div class="font-black">Sélectionnez une demande</div>
                            <div class="mt-1 text-indigo-800">Vous serez redirigé vers le paiement sécurisé après confirmation.</div>
                        </div>
                    </div>
                `);

                if (ready.length === 0) {
                    renderEmpty(container);
                    return;
                }
                ready.forEach(o => container.insertAdjacentHTML('beforeend', buildAchatOrderCard(o)));
            }

            function buildAchatDetail(order) {
                const orderId = safeText(order?.id);
                const firstImg = order?.items?.[0]?.image || order?.product_image || '';
                const img = safeText(firstImg).split(',')[0];
                const productName = order?.items?.[0]?.name || order?.product_name || 'Produit';
                const qty = order?.items?.[0]?.quantity || 1;

                const subtotal = Number(order?.subtotal_amount ?? order?.merchandise_amount ?? order?.total ?? 0);
                const delivery = Number(order?.delivery_fee_amount ?? 0);
                const discount = Number(order?.promo_discount_amount ?? 0);
                const total = Math.max(0, Number(order?.final_total_amount ?? (subtotal + delivery - discount)));

                const promoCode = safeText(order?.promo_code || '').trim().toUpperCase();

                const paymentState = String(order?.payment_status || '').toUpperCase();
                const isPaid = ['PAID', 'SUCCESS', 'SUCCESSFUL', 'SUCCEEDED', 'COMPLETED'].includes(paymentState) || ['PAID_HELD', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED', 'DISPUTE_OPEN', 'RELEASED'].includes(order?.status);

                return `
                    <div class="glass-panel p-6 sm:p-8">
                        <div class="flex items-start justify-between gap-4 flex-col sm:flex-row">
                            <div>
                                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">Demande #${orderId}</div>
                                <div class="mt-2 flex items-center gap-4">
                                    <div class="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                        <img src="${img ? (window.getOptimizedImageUrl ? window.getOptimizedImageUrl(img) : img) : window.resolvePath('assets/Images/default.png')}" alt="" loading="lazy" class="w-full h-full object-contain p-2" onerror="this.src=window.resolvePath('assets/Images/default.png')">
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-black text-gray-900 truncate">${safeText(productName)}</div>
                                        <div class="text-sm text-gray-500 mt-1">Quantité: <span class="font-bold text-gray-700">${qty}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <button class="px-4 py-2 rounded-2xl bg-gray-50 border border-gray-100 text-xs font-black tracking-widest uppercase hover:bg-gray-100 transition-colors"
                                    onclick="window.location.hash='purchases'; window.renderCustomerPurchasesTab && window.renderCustomerPurchasesTab();">
                                    Retour
                                </button>
                            </div>
                        </div>

                        <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                                <div class="text-xs font-black uppercase tracking-widest text-gray-400">Sous-total</div>
                                <div id="achatDashSubtotal" class="mt-2 text-lg font-black text-gray-900">${formatAmount(subtotal)}</div>
                            </div>
                            <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                                <div class="text-xs font-black uppercase tracking-widest text-gray-400">Livraison</div>
                                <div id="achatDashDelivery" class="mt-2 text-lg font-black text-gray-900">${formatAmount(delivery)}</div>
                            </div>
                            <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                                <div class="text-xs font-black uppercase tracking-widest text-gray-400">Remise</div>
                                <div id="achatDashDiscount" class="mt-2 text-lg font-black text-gray-900">${formatAmount(discount)}</div>
                            </div>
                            <div class="bg-black text-white rounded-2xl p-4">
                                <div class="text-xs font-black uppercase tracking-widest text-white/60">Total</div>
                                <div id="achatDashTotal" class="mt-2 text-xl font-black">${formatAmount(total)}</div>
                            </div>
                        </div>

                        ${isPaid ? '' : `
                        <div class="mt-6">
                            <div class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Code promo</div>
                            <div class="flex gap-2">
                                <input id="achatDashPromoInput" type="text" value="${promoCode}" placeholder="Ex: MAMAN10" class="flex-1 min-w-0 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-black uppercase">
                                <button id="achatDashApplyPromo" class="px-4 py-3 rounded-2xl bg-white border border-gray-100 text-xs font-black tracking-widest uppercase hover:border-black transition-colors">Appliquer</button>
                            </div>
                            <button id="achatDashRemovePromo" class="mt-2 text-xs font-bold text-gray-500 hover:text-black ${promoCode ? '' : 'hidden'}">Retirer le code promo</button>
                            <div id="achatDashPromoSuccess" class="mt-2 text-xs text-emerald-700 font-semibold ${promoCode ? '' : 'hidden'}">${promoCode ? `Code appliqué: ${promoCode}` : ''}</div>
                            <div id="achatDashPromoError" class="mt-2 text-xs text-red-600 font-semibold hidden"></div>
                        </div>
                        `}

                        ${isPaid ? `
                        <div class="mt-6">
                            <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-900 flex items-center justify-center gap-3">
                                <iconify-icon icon="solar:shield-check-bold" width="24"></iconify-icon>
                                <span class="font-black tracking-tight text-sm uppercase">Paiement sécurisé effectué</span>
                            </div>
                        </div>
                        ` : `
                        <div class="mt-6 space-y-3">
                            <button id="achatDashPayNow" class="w-full px-5 py-4 rounded-2xl bg-black text-white text-xs font-black tracking-widest uppercase hover:bg-gray-900 transition-colors flex items-center justify-center gap-2">
                                <iconify-icon icon="solar:card-send-bold" width="20"></iconify-icon>
                                Payer maintenant
                            </button>
                        </div>
                        `}
                    </div>
                `;
            }

            function bindAchatDetailActions(order) {
                const orderId = safeText(order?.id);
                const promoInput = document.getElementById('achatDashPromoInput');
                const promoApplyBtn = document.getElementById('achatDashApplyPromo');
                const promoRemoveBtn = document.getElementById('achatDashRemovePromo');
                const promoError = document.getElementById('achatDashPromoError');
                const promoSuccess = document.getElementById('achatDashPromoSuccess');
                const btnPay = document.getElementById('achatDashPayNow');

                const subtotalEl = document.getElementById('achatDashSubtotal');
                const deliveryEl = document.getElementById('achatDashDelivery');
                const discountEl = document.getElementById('achatDashDiscount');
                const totalEl = document.getElementById('achatDashTotal');

                const clearPromoFeedback = () => {
                    promoError?.classList.add('hidden');
                    promoSuccess?.classList.add('hidden');
                    if (promoError) promoError.textContent = '';
                };

                const syncAmounts = (pricing, promo) => {
                    const subtotalAmount = Number(pricing?.subtotal_amount ?? order?.subtotal_amount ?? order?.merchandise_amount ?? 0);
                    const deliveryAmount = Number(order?.delivery_fee_amount ?? pricing?.delivery_fee_amount ?? 0);
                    const discountAmount = Number(pricing?.promo_discount_amount ?? order?.promo_discount_amount ?? 0);
                    const totalAmount = Math.max(0, Number(pricing?.total_amount ?? order?.final_total_amount ?? (subtotalAmount + deliveryAmount - discountAmount)));

                    if (subtotalEl) subtotalEl.textContent = formatAmount(subtotalAmount);
                    if (deliveryEl) deliveryEl.textContent = formatAmount(deliveryAmount);
                    if (discountEl) discountEl.textContent = formatAmount(discountAmount);
                    if (totalEl) totalEl.textContent = formatAmount(totalAmount);

                    order.subtotal_amount = subtotalAmount;
                    order.promo_id = promo?.id || null;
                    order.promo_code = promo?.code || null;
                    order.promo_discount_amount = discountAmount;
                    order.final_total_amount = totalAmount;

                    const code = safeText(promo?.code || '').trim().toUpperCase();
                    if (promoSuccess) {
                        promoSuccess.textContent = code ? `Code appliqué: ${code}` : '';
                        promoSuccess.classList.toggle('hidden', !code);
                    }
                    if (promoRemoveBtn) promoRemoveBtn.classList.toggle('hidden', !code);
                };

                promoApplyBtn?.addEventListener('click', async () => {
                    clearPromoFeedback();
                    const promoCode = safeText(promoInput?.value).trim().toUpperCase();
                    if (!promoCode) {
                        if (promoError) {
                            promoError.textContent = 'Saisissez un code promo.';
                            promoError.classList.remove('hidden');
                        }
                        return;
                    }

                    promoApplyBtn.disabled = true;
                    promoApplyBtn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon>';
                    try {
                        const data = await window.ApiClient.post('/promos/validate', { order_id: orderId, promo_code: promoCode });
                        syncAmounts(data?.pricing, data?.promo);
                        if (promoInput) promoInput.value = promoCode;
                    } catch (e) {
                        if (promoError) {
                            promoError.textContent = safeText(e?.data?.error || e?.message || 'Impossible de valider ce code promo.');
                            promoError.classList.remove('hidden');
                        }
                    } finally {
                        promoApplyBtn.disabled = false;
                        promoApplyBtn.innerHTML = 'Appliquer';
                    }
                });

                promoRemoveBtn?.addEventListener('click', () => {
                    clearPromoFeedback();
                    if (promoInput) promoInput.value = '';
                    syncAmounts({
                        subtotal_amount: order?.subtotal_amount ?? order?.merchandise_amount ?? 0,
                        promo_discount_amount: 0,
                        total_amount: (Number(order?.subtotal_amount ?? order?.merchandise_amount ?? 0) + Number(order?.delivery_fee_amount ?? 0))
                    }, null);
                });

                btnPay?.addEventListener('click', async () => {
                    if (!btnPay) return;
                    btnPay.disabled = true;
                    if (window.clearInlineFeedback) window.clearInlineFeedback(btnPay);
                    
                    btnPay.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Ouverture...';
                    try {
                        const data = await OrderManager.initiatePayment(orderId, {
                            promo_code: safeText(promoInput?.value).trim().toUpperCase() || null
                        });
                        if (data?.payment_url) {
                            window.location.href = data.payment_url;
                            return;
                        }
                        
                        if (window.showInlineFeedback) {
                            window.showInlineFeedback(btnPay, safeText(data?.error || 'Lien de paiement non reçu'), 'error');
                        }
                    } catch (e) {
                        if (window.showInlineFeedback) {
                            window.showInlineFeedback(btnPay, safeText(e?.message || "Erreur lors de l'ouverture du paiement"), 'error');
                        }
                    } finally {
                        btnPay.disabled = false;
                        btnPay.innerHTML = '<iconify-icon icon="solar:card-send-bold" width="20"></iconify-icon> Payer maintenant';
                    }
                });
            }

            async function renderAchatFromHash(container) {
                const token = ++achatRenderToken;
                await waitForAppReady();
                if (token !== achatRenderToken) return;

                const { tab, params } = parseHash();
                if (tab !== 'achat') return;

                const orderId = safeText(params.get('order_id'));
                if (!orderId) {
                    await renderAchatList(container);
                    return;
                }

                const order = getCustomerOrders().find(o => safeText(o?.id) === orderId) || (window.OrderManager ? OrderManager.getOrderById?.(orderId) : null);
                if (!order) {
                    container.innerHTML = `
                        <div class="glass-panel p-12 text-center text-gray-500">
                            <iconify-icon icon="solar:danger-triangle-bold" width="48" class="mb-4 text-gray-300"></iconify-icon>
                            <p class="font-bold text-gray-900">Commande introuvable</p>
                            <p class="mt-2 text-sm">Retournez à la liste et réessayez.</p>
                            <div class="mt-6">
                                <button class="px-5 py-3 rounded-2xl bg-black text-white text-xs font-black tracking-widest uppercase hover:bg-gray-900 transition-colors" onclick="window.location.hash='purchases'; window.renderCustomerPurchasesTab && window.renderCustomerPurchasesTab();">Retour à la liste</button>
                            </div>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = buildAchatDetail(order);
                bindAchatDetailActions(order);
            }

            // --- Purchases filter state ---
            let _purchasesActiveFilter = 'all';

            function isPurchaseCompleted(o) {
                const s = String(o?.status || '').toUpperCase();
                return ['COMPLETED', 'RELEASED'].includes(s);
            }
            function isPurchasePaidOnly(o) {
                const s = String(o?.status || '').toUpperCase();
                const ps = String(o?.payment_status || '').toUpperCase();
                // Paid but NOT yet completed/released
                return (
                    ['PAID', 'SUCCESS', 'SUCCESSFUL', 'SUCCEEDED'].includes(ps) ||
                    ['PAID_HELD', 'IN_DELIVERY', 'SHIPPED', 'DELIVERED', 'PROCESSING'].includes(s)
                ) && !['COMPLETED', 'RELEASED'].includes(s);
            }
            function getPurchaseStatusBadge(o) {
                if (isPurchaseCompleted(o)) {
                    return '<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700"><iconify-icon icon="solar:check-circle-bold" width="11" style="vertical-align:-1px;margin-right:2px"></iconify-icon>Terminé</span>';
                }
                return '<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter bg-green-100 text-green-700"><iconify-icon icon="solar:wallet-bold" width="11" style="vertical-align:-1px;margin-right:2px"></iconify-icon>Payé</span>';
            }

            window.renderCustomerPurchasesTab = async function(filter) {
                const container = document.getElementById('customer-purchases-list');
                if (!container) return;

                if (filter) _purchasesActiveFilter = filter;

                await waitForAppReady();

                const email = localStorage.getItem('newketUserEmail');
                const userId = localStorage.getItem('newketUserId');
                
                if (!window.OrderManager || typeof OrderManager.getCustomerStats !== 'function') {
                    renderEmptyPurchases(container);
                    return;
                }

                const stats = OrderManager.getCustomerStats(email, userId);
                let myPurchases = (Array.isArray(stats.orders) ? stats.orders : []).filter(o => 
                    o.payment_status === 'PAID' || o.payment_status === 'SUCCESS' || o.status === 'COMPLETED' || o.status === 'DELIVERED'
                    || o.status === 'RELEASED' || o.status === 'PAID_HELD' || o.status === 'IN_DELIVERY' || o.status === 'SHIPPED'
                ).sort((a, b) => {
                    const ta = new Date(a?.timestamp || a?.date || a?.created_at || 0).getTime();
                    const tb = new Date(b?.timestamp || b?.date || b?.created_at || 0).getTime();
                    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
                });

                // Apply active filter
                if (_purchasesActiveFilter === 'paid') {
                    myPurchases = myPurchases.filter(o => isPurchasePaidOnly(o));
                } else if (_purchasesActiveFilter === 'completed') {
                    myPurchases = myPurchases.filter(o => isPurchaseCompleted(o));
                }

                // Update filter button styles
                document.querySelectorAll('.purchases-filter-btn').forEach(btn => {
                    const f = btn.getAttribute('data-filter');
                    if (f === _purchasesActiveFilter) {
                        btn.classList.add('bg-black', 'text-white', 'shadow-lg');
                        btn.classList.remove('bg-gray-100', 'text-gray-600', 'hover:bg-gray-200');
                    } else {
                        btn.classList.remove('bg-black', 'text-white', 'shadow-lg');
                        btn.classList.add('bg-gray-100', 'text-gray-600', 'hover:bg-gray-200');
                    }
                });

                if (document.getElementById('customerPurchasesTotal')) {
                    document.getElementById('customerPurchasesTotal').textContent = window.CurrencyManager ? CurrencyManager.formatPrice(stats.totalSpent || 0) : ((stats.totalSpent || 0) + ' FC');
                }

                if (myPurchases.length === 0) {
                    renderEmptyPurchases(container, _purchasesActiveFilter);
                } else {
                    container.innerHTML = myPurchases.map((o, index) => {
                        const img = window.getOptimizedImageUrl ? window.getOptimizedImageUrl(o.product_image) : (o.product_image || '');
                        const fallbackImg = window.resolvePath ? window.resolvePath('assets/Images/default.png') : '../assets/Images/default.png';
                        const statusBadge = getPurchaseStatusBadge(o);
                        return `
                            <div class="group relative overflow-hidden bg-white border border-gray-100 p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 cursor-pointer" style="animation-delay: ${index * 100}ms" onclick="openOrderModal('${o.id}')">
                                <div class="flex items-center gap-5">
                                    <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 transition-colors">
                                        <img src="${img}" class="w-full h-full object-contain p-2" onerror="this.src='${fallbackImg}'">
                                    </div>
                                    <div>
                                        <h4 class="font-black text-gray-900 group-hover:translate-x-1 transition-transform duration-300">
                                            ${o.product_name || 'Commande multi-produits'}
                                        </h4>
                                        <div class="flex items-center gap-3 mt-1.5">
                                            <span class="text-[9px] font-black uppercase tracking-tighter text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                                ${new Date(o.date || o.timestamp || o.created_at).toLocaleDateString()}
                                            </span>
                                            ${statusBadge}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-6 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                                    <div class="flex flex-col items-start sm:items-end flex-1 sm:flex-none">
                                        <p class="font-black text-lg text-gray-900 leading-none mb-1">${window.CurrencyManager ? CurrencyManager.formatPrice(o.total) : (o.total + ' FC')}</p>
                                        <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                                            Vendeur: <span class="text-gray-600">${o.supplier_name || o.supplier_email || 'NewKet Boutique'}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }

                // Bind filter buttons (once)
                if (!window.__purchasesFilterBound) {
                    window.__purchasesFilterBound = true;
                    document.addEventListener('click', function(e) {
                        const btn = e.target.closest('.purchases-filter-btn');
                        if (!btn) return;
                        const f = btn.getAttribute('data-filter');
                        if (f && f !== _purchasesActiveFilter) {
                            _purchasesActiveFilter = f;
                            window.renderCustomerPurchasesTab(f);
                        }
                    });
                }
            };

            function renderEmptyPurchases(container, filter) {
                const filterMsg = filter === 'paid' ? 'payé' : filter === 'completed' ? 'terminé' : '';
                const emptyTitle = filterMsg
                    ? `Aucune commande ${filterMsg}e`
                    : 'Aucun achat conclu pour le moment';
                const emptyDesc = filterMsg
                    ? `Il n'y a pas encore de commande avec le statut "${filterMsg}".`
                    : 'Vos achats apparaîtront ici. Pourquoi ne pas vous faire plaisir en explorant nos offres ?';
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in zoom-in-95 duration-700">
                        <div class="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6 text-gray-200 shadow-inner">
                            <iconify-icon icon="solar:bag-heart-bold-duotone" width="48"></iconify-icon>
                        </div>
                        <h4 class="font-black text-gray-900 mb-2">${emptyTitle}</h4>
                        <p class="text-xs text-gray-400 max-w-[240px] leading-relaxed mb-8">${emptyDesc}</p>
                        <a href="${typeof window.resolvePath === 'function' ? window.resolvePath('catalog') : '/src/pages/catalog.html'}" class="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200">
                            Découvrir le catalogue
                        </a>
                    </div>
                `;
            }
        })();

        function getPaymentStatusColor(status) {
            switch (status?.toUpperCase()) {
                case 'SUCCESSFUL':
                case 'SUCCESS':
                case 'SUCCEEDED':
                case 'COMPLETED':
                case 'PAID':
                    return 'bg-green-100 text-green-700';
                case 'PENDING':
                    return 'bg-amber-100 text-amber-700';
                case 'FAILED':
                    return 'bg-red-100 text-red-700';
                default:
                    return 'bg-gray-100 text-gray-700';
            }
        }

        function openOrderModal(id) {
            const order = OrderManager.getOrders().find(o => o.id === id);
            if (!order) return;
            currentSelectedOrder = order;
            if (releaseCountdownTimer) {
                clearInterval(releaseCountdownTimer);
                releaseCountdownTimer = null;
            }

            document.getElementById('modalOrderIdText').textContent = 'Commande #' + order.id;
            document.getElementById('modalOrderDateText').textContent = new Date(order.date).toLocaleDateString('fr-FR', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const statusEl = document.getElementById('modalOrderStatus');
            statusEl.textContent = window.OrderManager ? OrderManager.getStatusLabel(order.status) : order.status;
            statusEl.className = `px-3 py-1 rounded-full text-xs font-bold inline-block ${getStatusColor(order.status)}`;

            const payStatusEl = document.getElementById('modalPaymentStatus');
            const transIdEl = document.getElementById('modalTransactionId');
            const contactMethodEl = document.getElementById('modalContactMethod');

            if (payStatusEl) {
                const pStatus = order.payment_status || 'N/A';
                payStatusEl.textContent = pStatus;
                payStatusEl.className = `px-3 py-1 rounded-full text-xs font-bold inline-block ${getPaymentStatusColor(pStatus)}`;
            }
            if (transIdEl) {
                transIdEl.textContent = order.transaction_id ? `Ref: ${order.transaction_id}` : '';
                transIdEl.classList.add('break-all', 'whitespace-normal');
            }
            if (contactMethodEl) {
                const paymentState = String(order.payment_status || '').toUpperCase();
                if (['PAID', 'SUCCESS', 'SUCCESSFUL', 'SUCCEEDED', 'COMPLETED'].includes(paymentState) || order.status === 'PAID_HELD') {
                    contactMethodEl.textContent = 'Paiement confirmé';
                } else if (order.payment_status && order.payment_status !== 'N/A') {
                    contactMethodEl.textContent = 'Netikash Online';
                } else {
                    contactMethodEl.textContent = 'Paiement en cours';
                }
            }

            const itemsList = document.getElementById('modalOrderItems');
            const amounts = getOrderAmounts(order);
            itemsList.innerHTML = order.items.map(item => `
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 p-2 flex-shrink-0">
                        <img src="${window.getOptimizedImageUrl(item.image)}"${window.buildResponsiveImageSrcSet ? ` srcset="${window.buildResponsiveImageSrcSet(item.image, [48, 72, 96], { quality: 70 })}" sizes="56px"` : ''} loading="lazy" class="w-full h-full object-contain" alt="${item.name || 'Article'}" onerror="this.src=window.resolvePath('assets/Images/default.png')">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm sm:text-base truncate">${item.name}</div>
                        <div class="text-xs text-gray-500">Quantité: ${item.quantity} é ${CurrencyManager.formatPrice(item.price)}</div>
                    </div>
                    <div class="text-sm font-bold text-right">${CurrencyManager.formatPrice(item.price * item.quantity)}</div>
                </div>
            `).join('');

            document.getElementById('modalOrderSubtotal').textContent = CurrencyManager.formatPrice(amounts.subtotal);
            document.getElementById('modalOrderDelivery').textContent = amounts.deliveryFee > 0
                ? CurrencyManager.formatPrice(amounts.deliveryFee)
                : 'Gratuit';
            
            const discountRow = document.getElementById('modalOrderDiscountRow');
            const promoCodeRow = document.getElementById('modalOrderPromoCodeRow');
            const promoCodeValue = document.getElementById('modalOrderPromoCode');
            const modalInvoiceLogo = document.getElementById('modalInvoiceLogo');
            if (modalInvoiceLogo) modalInvoiceLogo.src = getNewketLogoUrl();
            const promoCode = String(order?.promo_code || '').trim().toUpperCase();
            if (amounts.discount > 0) {
                if (discountRow) discountRow.classList.remove('hidden');
                document.getElementById('modalOrderDiscount').textContent = "-" + CurrencyManager.formatPrice(amounts.discount);
            } else {
                if (discountRow) discountRow.classList.add('hidden');
            }
            if (promoCodeRow && promoCodeValue) {
                const hasPromoCode = Boolean(promoCode);
                promoCodeRow.classList.toggle('hidden', !hasPromoCode);
                promoCodeValue.textContent = promoCode;
            }

            document.getElementById('modalOrderTotal').textContent = CurrencyManager.formatPrice(amounts.total);

            const timelineEl = document.getElementById('modalOrderTimeline');
            if (timelineEl) {
                timelineEl.innerHTML = buildCustomerOrderTimelineHTML(order);
            }

            // Escrow Logic UI
            const escrowSection = document.getElementById('modalEscrowSection');
            const otpSection = document.getElementById('otpDisplaySection');
            const otpHintEl = document.getElementById('otpHint');
            const quoteSummarySection = document.getElementById('quoteSummarySection');
            const btnValidate = document.getElementById('btnValidateDelivery');
            const btnDispute = document.getElementById('btnOpenDispute');
            const btnAcceptQuote = document.getElementById('btnAcceptQuote');
            const btnRejectQuote = document.getElementById('btnRejectQuote');
            const btnPayOrder = document.getElementById('btnPayOrder');
            const releaseDelaySection = document.getElementById('releaseDelaySection');
            const releaseCountdown = document.getElementById('releaseCountdown');
            const releaseDelayHint = document.getElementById('releaseDelayHint');

            escrowSection.classList.add('hidden');
            otpSection.classList.add('hidden');
            quoteSummarySection.classList.add('hidden');
            releaseDelaySection.classList.add('hidden');
            btnValidate.classList.add('hidden');
            btnDispute.classList.add('hidden');
            btnAcceptQuote.classList.add('hidden');
            btnRejectQuote.classList.add('hidden');
            btnPayOrder.classList.add('hidden');
            if (otpHintEl) otpHintEl.textContent = '';
            if (releaseDelayHint) releaseDelayHint.textContent = '';

            currentSelectedDispute = null;

            if (order.status === 'QUOTE' && order.latest_delivery_quote) {
                const quote = order.latest_delivery_quote;
                escrowSection.classList.remove('hidden');
                quoteSummarySection.classList.remove('hidden');
                document.getElementById('quoteAmount').textContent = CurrencyManager.formatPrice(Number(quote.delivery_fee_amount || 0));
                document.getElementById('quoteDelay').textContent = `${quote.estimated_delay_hours || 0} h`;
                document.getElementById('quoteNote').textContent = quote.note || 'Le vendeur a proposé un devis de livraison.';
                btnAcceptQuote.classList.remove('hidden');
                btnRejectQuote.classList.remove('hidden');
            } else if (order.status === 'READY_FOR_PAYMENT') {
                escrowSection.classList.remove('hidden');
                quoteSummarySection.classList.remove('hidden');
                if (order.latest_delivery_quote) {
                    const quote = order.latest_delivery_quote;
                    document.getElementById('quoteAmount').textContent = CurrencyManager.formatPrice(Number(quote.delivery_fee_amount || 0));
                    document.getElementById('quoteDelay').textContent = `${quote.estimated_delay_hours || 0} h`;
                    document.getElementById('quoteNote').textContent = quote.note || 'Devis accepté. Vous pouvez maintenant payer.';
                } else {
                    document.getElementById('quoteAmount').textContent = CurrencyManager.formatPrice(Number(order.delivery_fee_amount || 0));
                    document.getElementById('quoteDelay').textContent = 'Confirmé';
                    document.getElementById('quoteNote').textContent = 'Le devis a été accepté. Le paiement est maintenant en séquestre.';
                }
                btnPayOrder.classList.remove('hidden');
            } else if (order.status === 'PAID_HELD') {
                escrowSection.classList.remove('hidden');
            } else if (order.status === 'DELIVERED') {
                escrowSection.classList.remove('hidden');
                btnValidate.classList.remove('hidden');
                btnDispute.classList.remove('hidden');
                releaseDelaySection.classList.remove('hidden');
                const releaseAtValue = order.escrow_release_at || order.release_scheduled_at || order.release_at || null;
                const releaseAt = releaseAtValue ? new Date(releaseAtValue) : null;
                const updateReleaseCountdown = () => {
                    const now = new Date();
                    const diffMs = releaseAt && !Number.isNaN(releaseAt.getTime()) ? releaseAt.getTime() - now.getTime() : null;
                    if (releaseCountdown) {
                        releaseCountdown.textContent = diffMs === null ? 'Délai à définir' : formatReleaseCountdown(diffMs);
                    }
                    if (releaseDelayHint) {
                        releaseDelayHint.textContent = releaseAt && !Number.isNaN(releaseAt.getTime())
                            ? (diffMs > 0
                                ? `Libération automatique sous 24h après la validation OTP, soit le ${releaseAt.toLocaleString('fr-FR')} si vous n'agissez pas avant.`
                                : 'Le délai est écoulé. Les fonds peuvent être libérés immédiatement.')
                            : 'La libération automatique sera affichée dès que le délai sera enregistré.';
                    }
                };
                updateReleaseCountdown();
                releaseCountdownTimer = window.setInterval(updateReleaseCountdown, 1000);
            } else if (order.status === 'IN_DELIVERY' || order.status === 'SHIPPED') {
                escrowSection.classList.remove('hidden');
                otpSection.classList.remove('hidden');
                document.getElementById('otpValue').textContent = order.otp_code || '------';
                if (otpHintEl) {
                    otpHintEl.textContent = "Voici votre code de validation (OTP). Donnez-le au livreur uniquement APRÈS avoir reçu et vérifié le produit.";
                }
            }


            if (order.status === 'DISPUTE_OPEN' || order.status === 'DISPUTED' || order.status === 'FROZEN') {
                document.getElementById('modalDisputeChatSection').classList.remove('hidden');
                loadDisputeChat(order.id);
            } else {
                document.getElementById('modalDisputeChatSection').classList.add('hidden');
            }

            document.getElementById('orderModal').classList.remove('hidden');
            document.getElementById('orderModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        function buildCustomerOrderTimelineHTML(order) {
            const status = String(order?.status || '').toUpperCase();
            const pay = String(order?.payment_status || '').toUpperCase();

            const isPaid =
                ['SUCCESS', 'SUCCESSFUL', 'SUCCEEDED', 'COMPLETED', 'PAID'].includes(pay) ||
                ['PAID_HELD', 'IN_DELIVERY', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'RELEASED'].includes(status);

            const isShippingDone = ['DELIVERED', 'COMPLETED', 'RELEASED'].includes(status);
            const isShippingCurrent = ['PAID_HELD', 'IN_DELIVERY', 'SHIPPED'].includes(status);
            const isOtpCurrent = ['DELIVERED'].includes(status);
            const isOtpDone = ['COMPLETED', 'RELEASED'].includes(status);
            const isDone = ['COMPLETED', 'RELEASED'].includes(status);

            const special = ['CANCELLED', 'REFUNDED'].includes(status)
                ? 'cancel'
                : (['DISPUTE_OPEN', 'DISPUTED', 'FROZEN'].includes(status) ? 'dispute' : '');

            const steps = [
                { label: 'Commandee', done: true, current: false },
                { label: 'Payee', done: isPaid, current: !isPaid && status === 'READY_FOR_PAYMENT' },
                { label: 'En livraison', done: isShippingDone, current: isShippingCurrent },
                { label: 'Validation OTP', done: isOtpDone, current: isOtpCurrent },
                { label: 'Terminee', done: isDone, current: false }
            ];

            function chipClass(s) {
                if (special === 'cancel') return 'bg-gray-200 text-gray-600 border-gray-200';
                if (special === 'dispute') return s.done ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-white text-orange-800 border-orange-200';
                if (s.done) return 'bg-black text-white border-black';
                if (s.current) return 'bg-white text-black border-black';
                return 'bg-white text-gray-500 border-gray-200';
            }

            function iconFor(s) {
                if (special === 'cancel') return 'solar:close-circle-bold';
                if (special === 'dispute') return 'solar:danger-circle-bold';
                if (s.done) return 'solar:check-circle-bold';
                if (s.current) return 'solar:clock-circle-bold';
                return 'solar:minus-circle-linear';
            }

            return `
                <div class="flex flex-wrap items-center gap-1.5">
                    ${steps.map((s) => `
                        <div class="inline-flex items-center gap-1 px-2 py-1 rounded-xl border text-[8px] sm:text-[9px] font-black uppercase tracking-[0.16em] leading-none ${chipClass(s)}">
                            <iconify-icon icon="${iconFor(s)}" width="14"></iconify-icon>
                            <span class="whitespace-nowrap">${s.label}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        async function handleValidateDelivery() {
            if (!currentSelectedOrder) return;
            
            const run = async () => {
                try {
                    const btn = document.getElementById('btnValidateDelivery');
                    btn.disabled = true;
                    btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Traitement...';

                    await OrderManager.confirmCompletion(currentSelectedOrder.id);
                    showToast('Fonds libérés avec succès.', 'success');
                    closeOrderModal();
                    await loadDashboardData();
                } catch (error) {
                    showToast(error.message || 'Erreur lors de la validation', 'error');
                    console.error(error);
                } finally {
                    const btn = document.getElementById('btnValidateDelivery');
                    btn.disabled = false;
                    btn.innerHTML = '<iconify-icon icon="solar:check-read-linear" width="20"></iconify-icon> Libérer les fonds';
                }
            };

            if (typeof window.showConfirm === 'function') {
                window.showConfirm(
                    'Libérer les fonds',
                    "La validation OTP est déjà confirmée. En continuant, vous libérez maintenant les fonds séquestrés au vendeur. Continuer ?",
                    run
                );
                return;
            }

            const confirmed = confirm("Voulez-vous libérer maintenant les fonds pour le vendeur ?");
            if (!confirmed) return;

            await run();
          }

        function formatReleaseCountdown(diffMs) {
            const ms = Math.max(0, Number(diffMs || 0));
            const totalSeconds = Math.floor(ms / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            if (days > 0) return `${days}j ${hours}h`;
            if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
            return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
        }

        async function handleAcceptQuote() {
            if (!currentSelectedOrder) return;
            try {
                const btn = document.getElementById('btnAcceptQuote');
                btn.disabled = true;
                btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Traitement...';
                await OrderManager.respondToDeliveryQuote(currentSelectedOrder.id, {
                    action: 'ACCEPT',
                    quote_id: currentSelectedOrder.latest_delivery_quote?.id || null
                });
                showToast('Devis accepté. Vous pouvez maintenant passer au paiement.', 'success');
                closeOrderModal();
                await loadDashboardData();
            } catch (error) {
                showToast(error.message || "Erreur lors de l'acceptation du devis", 'error');
            } finally {
                const btn = document.getElementById('btnAcceptQuote');
                btn.disabled = false;
                btn.innerHTML = '<iconify-icon icon="solar:check-read-linear" width="20"></iconify-icon> Accepter le devis';
            }
        }

        async function handleRejectQuote() {
            if (!currentSelectedOrder) return;
            try {
                const btn = document.getElementById('btnRejectQuote');
                btn.disabled = true;
                btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Traitement...';
                await OrderManager.respondToDeliveryQuote(currentSelectedOrder.id, {
                    action: 'REJECT',
                    quote_id: currentSelectedOrder.latest_delivery_quote?.id || null
                });
                showToast('Devis refusé. La demande a été clôturée.', 'warning');
                closeOrderModal();
                await loadDashboardData();
            } catch (error) {
                showToast(error.message || 'Erreur lors du refus du devis', 'error');
            } finally {
                const btn = document.getElementById('btnRejectQuote');
                btn.disabled = false;
                btn.innerHTML = '<iconify-icon icon="solar:close-circle-linear" width="20"></iconify-icon> Refuser le devis';
            }
        }

        async function handlePayOrder() {
            if (!currentSelectedOrder) return;
            const path = (typeof window.resolvePath === 'function') ? window.resolvePath('achat') : '/src/pages/achat.html';
            window.location.href = `${path}?order_id=${encodeURIComponent(currentSelectedOrder.id)}`;
        }

        // ========================== GESTION DES LITIGES ==========================
        function showDisputeModal() {
            if (!currentSelectedOrder) return;
            console.trace('showDisputeModal called'); // Trace to see if called automatically
            document.getElementById('disputeOrderId').textContent = currentSelectedOrder.id;
            document.getElementById('disputeReason').value = '';
            document.getElementById('disputeDescription').value = '';
            document.getElementById('disputeProof1').value = '';
            document.getElementById('disputeProof2').value = '';
            const modal = document.getElementById('disputeModal');
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            closeOrderModal();
        }

        function closeDisputeModal() {
            const modal = document.getElementById('disputeModal');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }

        async function submitDispute() {
            if (!currentSelectedOrder) return;

            const category = document.getElementById('disputeReason').value;
            const description = document.getElementById('disputeDescription').value.trim();
            const proof1 = document.getElementById('disputeProof1').value.trim();
            const proof2 = document.getElementById('disputeProof2').value.trim();

            if (!category || !description) {
                showToast('Raison et description sont obligatoires.', 'error');
                return;
            }

            const evidence = [];
            if (proof1) evidence.push({ url: proof1, kind: 'photo', source: 'client' });
            if (proof2) evidence.push({ url: proof2, kind: 'photo', source: 'client' });

            try {
                const btn = document.getElementById('btnSubmitDispute');
                btn.disabled = true;
                btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Envoi...';

                await OrderManager.openDispute(currentSelectedOrder.id, category, description, evidence);
                
                showToast('Litige ouvert. Notre service client va analyser votre demande.', 'warning');
                closeDisputeModal();
                await loadDashboardData();
            } catch (error) {
                showToast(error.message || 'Erreur lors de l\'ouverture du litige', 'error');
            } finally {
                const btn = document.getElementById('btnSubmitDispute');
                btn.disabled = false;
                btn.innerHTML = '<iconify-icon icon="solar:danger-triangle-linear" width="20"></iconify-icon> Soumettre le litige';
            }
        }

        window.loadDisputeChat = async function(orderId) {
            const container = document.getElementById('disputeChatContainer');
            const buyerActions = document.getElementById('buyerDisputeActions');
            if (!container) return;
            if (buyerActions) buyerActions.classList.add('hidden');

            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2"><iconify-icon icon="line-md:loading-twotone-loop" width="24"></iconify-icon>Chargement du fil...</div>';

            try {
                currentSelectedDispute = await OrderManager.getDisputeByOrder(orderId);
                if (buyerActions && currentSelectedDispute.status === 'BUYER_PENDING') {
                    buyerActions.classList.remove('hidden');
                }
                const messages = await OrderManager.getDisputeMessages(currentSelectedDispute.id);
                container.innerHTML = '';

                if (!messages || messages.length === 0) {
                    container.innerHTML = '<div class="text-center text-[10px] text-gray-400 italic mt-8">Pas encore de messages. L\'administrateur ou le vendeur vous répondront ici.</div>';
                    return;
                }

                messages.forEach(msg => {
                    const senderRole = (msg.payload && msg.payload.sender_role) || msg.sender_role || 'SYSTEM';
                    const isMe = senderRole === 'CUSTOMER';
                    let roleLabel = '';
                    let bubbleClass = '';
                    let alignClass = isMe ? 'self-end items-end' : 'self-start items-start';
                    const messageText = msg.payload?.message || msg.payload?.event || msg.message || 'Mise à jour';

                    if (senderRole === 'ADMIN') {
                        roleLabel = '<span class="text-[8px] font-black bg-red-100 text-red-600 px-1 py-0.5 rounded ml-2 uppercase">SUPPORT</span>';
                        bubbleClass = 'bg-red-50 border border-red-100 text-red-950';
                    } else if (senderRole === 'VENDOR' || senderRole === 'SELLER') {
                        roleLabel = '<span class="text-[8px] font-black bg-blue-100 text-blue-600 px-1 py-0.5 rounded ml-2 uppercase">VENDEUR</span>';
                        bubbleClass = 'bg-blue-50 border border-blue-100 text-blue-950';
                    } else if (senderRole === 'SYSTEM') {
                        roleLabel = '<span class="text-[8px] font-black bg-gray-100 text-gray-500 px-1 py-0.5 rounded ml-2 uppercase">SYSTÈME</span>';
                        bubbleClass = 'bg-gray-100 text-gray-700';
                    } else {
                        roleLabel = '<span class="text-[8px] font-black text-gray-400 ml-2 uppercase">VOUS</span>';
                        bubbleClass = 'bg-black text-white';
                    }

                    const time = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                    const msgHtml = `
                        <div class="flex flex-col ${alignClass} max-w-[85%]">
                            <div class="flex items-center mb-1">
                                <span class="text-[9px] text-gray-400 font-bold">${time}</span>
                                ${roleLabel}
                            </div>
                            <div class="px-3 py-2 rounded-2xl text-xs font-medium ${bubbleClass} shadow-sm">
                                ${messageText}
                            </div>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', msgHtml);
                });

                container.scrollTop = container.scrollHeight;

                // ⚡ Realtime — nouveaux messages arrivent automatiquement
                OrderManager.subscribeToDisputeMessages(currentSelectedDispute.id, (newMsg) => {
                    const senderRole = (newMsg.payload && newMsg.payload.sender_role) || newMsg.sender_role || 'SYSTEM';
                    const isMe = senderRole === 'CUSTOMER';
                    let roleLabel = '';
                    let bubbleClass = '';
                    let alignClass = isMe ? 'self-end items-end' : 'self-start items-start';
                    const messageText = newMsg.payload?.message || newMsg.payload?.event || newMsg.message || 'Mise à jour';
                    if (senderRole === 'ADMIN') {
                        roleLabel = '<span class="text-[8px] font-black bg-red-100 text-red-600 px-1 py-0.5 rounded ml-2 uppercase">SUPPORT</span>';
                        bubbleClass = 'bg-red-50 border border-red-100 text-red-950';
                    } else if (senderRole === 'VENDOR' || senderRole === 'SELLER') {
                        roleLabel = '<span class="text-[8px] font-black bg-blue-100 text-blue-600 px-1 py-0.5 rounded ml-2 uppercase">VENDEUR</span>';
                        bubbleClass = 'bg-blue-50 border border-blue-100 text-blue-950';
                    } else if (senderRole === 'SYSTEM') {
                        roleLabel = '<span class="text-[8px] font-black bg-gray-100 text-gray-500 px-1 py-0.5 rounded ml-2 uppercase">SYSTÈME</span>';
                        bubbleClass = 'bg-gray-100 text-gray-700';
                    } else {
                        roleLabel = '<span class="text-[8px] font-black text-gray-400 ml-2 uppercase">VOUS</span>';
                        bubbleClass = 'bg-black text-white';
                    }
                    const time = new Date(newMsg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const msgHtml = `
                        <div class="flex flex-col ${alignClass} max-w-[85%]">
                            <div class="flex items-center mb-1">
                                <span class="text-[9px] text-gray-400 font-bold">${time}</span>
                                ${roleLabel}
                            </div>
                            <div class="px-3 py-2 rounded-2xl text-xs font-medium ${bubbleClass} shadow-sm">
                                ${messageText}
                            </div>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', msgHtml);
                    container.scrollTop = container.scrollHeight;
                });
            } catch (error) {
                container.innerHTML = '<div class="text-center text-xs text-red-500 p-4">Erreur de chargement des messages.</div>';
            }
        };

        window.sendDisputeMessage = async function() {
            if (!currentSelectedOrder) return;
            const input = document.getElementById('disputeMessageInput');
            const message = input.value.trim();
            if (!message) return;

            const btn = document.getElementById('btnSendDisputeMessage');
            btn.disabled = true;
            btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="18"></iconify-icon>';

            try {
                if (!currentSelectedDispute) {
                    currentSelectedDispute = await OrderManager.getDisputeByOrder(currentSelectedOrder.id);
                }
                await OrderManager.addDisputeMessage(currentSelectedDispute.id, {
                    type: 'MESSAGE',
                    payload: { message }
                });
                input.value = '';
                // Realtime push le nouveau message automatiquement
            } catch (error) {
                showToast('Erreur d\'envoi du message', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<iconify-icon icon="solar:plain-bold" width="20"></iconify-icon>';
            }
        };

        window.handleBuyerAcceptDisputeOffer = async function() {
            if (!currentSelectedDispute) return;
            try {
                await OrderManager.buyerRespondToDispute(currentSelectedDispute.id, { action: 'ACCEPT' });
                showToast("Proposition vendeur acceptée.", 'success');
                await loadDashboardData();
                await loadDisputeChat(currentSelectedOrder.id);
            } catch (error) {
                showToast(error.message || "Erreur lors de l'acceptation.", 'error');
            }
        };

        window.handleBuyerRejectDisputeOffer = async function() {
            if (!currentSelectedDispute) return;
            try {
                await OrderManager.buyerRespondToDispute(currentSelectedDispute.id, { action: 'REJECT' });
                showToast("Le dossier passe en arbitrage plateforme.", 'warning');
                await loadDashboardData();
                await loadDisputeChat(currentSelectedOrder.id);
            } catch (error) {
                showToast(error.message || "Erreur lors du refus.", 'error');
            }
        };
        // ========================================================================

        function closeOrderModal() {
            if (releaseCountdownTimer) {
                clearInterval(releaseCountdownTimer);
                releaseCountdownTimer = null;
            }
            document.getElementById('orderModal').classList.add('hidden');
            document.getElementById('orderModal').style.display = 'none';
            document.body.style.overflow = '';
            // Unsubscribe from dispute realtime when modal closes
            if (currentSelectedDispute?.id) {
                OrderManager.unsubscribeFromDisputeMessages(currentSelectedDispute.id);
            }
        }

        function getOrderAmounts(order) {
            const itemsSubtotal = Array.isArray(order?.items)
                ? order.items.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 0)), 0)
                : 0;
            const subtotal = Number(order?.merchandise_amount ?? itemsSubtotal ?? 0);
            
            let deliveryFee = Number(order?.delivery_fee_amount ?? 0);
            let discount = Number(order?.promo_discount_amount ?? 0);
            let total = Number(order?.final_total_amount ?? order?.total ?? order?.total_amount ?? Math.max(0, subtotal + deliveryFee - discount));

            if (order?.status === 'QUOTE' && order?.latest_delivery_quote) {
                deliveryFee = Number(order.latest_delivery_quote.delivery_fee_amount || 0);
                total = Math.max(0, subtotal + deliveryFee - discount);
            }

            return {
                subtotal,
                deliveryFee,
                discount,
                total
            };
        }

        function getVendorDisplayName(order) {
            const explicitName = order?.vendor_company_name || order?.vendor?.company_name || order?.vendor_name || order?.vendor?.name;
            if (explicitName) return explicitName;

            const vendorEmail = order?.vendor_email || order?._raw?.vendor_email || '';
            if (vendorEmail) {
                const localPart = vendorEmail.split('@')[0] || vendorEmail;
                return localPart.replace(/[._-]+/g, ' ').trim();
            }

            return 'Vendeur NewKet';
        }

        function getNewketLogoUrl() {
            if (typeof window.resolvePath === 'function') {
                return window.resolvePath('/Images/logo-newket.png');
            }
            try {
                return new URL('/Images/logo-newket.png', window.location.href).href;
            } catch (error) {
                return '/Images/logo-newket.png';
            }
        }

        async function buildInvoiceQrReference(order, amounts) {
            const fingerprint = [
                order?.id || '',
                order?.date || '',
                order?.customer?.email || '',
                order?.customer?.name || '',
                getVendorDisplayName(order),
                amounts?.subtotal ?? 0,
                amounts?.deliveryFee ?? 0,
                amounts?.discount ?? 0,
                amounts?.total ?? 0
            ].join('|');

            const fallbackHash = (() => {
                let hash = 0;
                for (let index = 0; index < fingerprint.length; index += 1) {
                    hash = ((hash << 5) - hash) + fingerprint.charCodeAt(index);
                    hash |= 0;
                }
                return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
            })();

            if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') {
                return `NK-${fallbackHash}`;
            }

            try {
                const encoded = new TextEncoder().encode(fingerprint);
                const digest = await window.crypto.subtle.digest('SHA-256', encoded);
                const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
                return `NK-${hex.slice(0, 12)}`;
            } catch (error) {
                console.warn('Unable to create invoice QR reference:', error);
                return `NK-${fallbackHash}`;
            }
        }

        function buildInvoiceQrTargetUrl(order, qrReference) {
            if (window.InvoiceQrService && typeof window.InvoiceQrService.buildInvoiceQrTargetUrl === 'function') {
                return window.InvoiceQrService.buildInvoiceQrTargetUrl(order, qrReference);
            }

            const resolvedPath = typeof window.resolvePath === 'function'
                ? window.resolvePath('invoice-verify')
                : '/src/pages/invoice-verify.html';
            const url = new URL(resolvedPath, window.location.origin);
            if (order?.id) url.searchParams.set('order_id', order.id);
            if (qrReference) url.searchParams.set('invoice_ref', qrReference);
            return url.toString();
        }

        async function buildInvoiceQrImageSrc(order, qrReference) {
            const targetUrl = buildInvoiceQrTargetUrl(order, qrReference);
            if (window.InvoiceQrService && typeof window.InvoiceQrService.toDataUrl === 'function') {
                return window.InvoiceQrService.toDataUrl(targetUrl);
            }

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" fill="#fff"/><rect x="12" y="12" width="196" height="196" rx="18" fill="#f0fdf4" stroke="#bbf7d0"/><text x="110" y="102" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#065f46">QR indisponible</text><text x="110" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#6b7280">Ouvrir la vérification</text></svg>`;
            return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
        }

        function waitForFrameAssets(printFrame) {
            const frameDocument = printFrame.contentWindow?.document;
            const images = Array.from(frameDocument?.images || []).filter(image => image.src);

            if (!images.length) {
                return Promise.resolve();
            }

            return Promise.race([
                Promise.all(images.map(image => {
                    if (image.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        image.addEventListener('load', resolve, { once: true });
                        image.addEventListener('error', resolve, { once: true });
                    });
                })),
                new Promise(resolve => setTimeout(resolve, 4000))
            ]);
        }

        async function downloadInvoice() {
            if (!currentSelectedOrder) return;

            const o = currentSelectedOrder;
            const amounts = getOrderAmounts(o);
            const qrReference = await buildInvoiceQrReference(o, amounts);
            const qrTargetUrl = buildInvoiceQrTargetUrl(o, qrReference);
            const qrImageSrc = await buildInvoiceQrImageSrc(o, qrReference);
            document.getElementById('invId').textContent = '#' + o.id;
            document.getElementById('invDate').textContent = new Date(o.date).toLocaleDateString();
            document.getElementById('invClient').textContent = o.customer?.name || 'Client NewKet';
            document.getElementById('invEmail').textContent = o.customer?.email || '';
            document.getElementById('invVendor').textContent = getVendorDisplayName(o);
            document.getElementById('invQrCode').textContent = qrReference;
            document.getElementById('invQrImage').src = qrImageSrc;
            const promoCode = String(o.promo_code || '').trim().toUpperCase();
            const discountAmount = Number(amounts.discount || 0);
            const discountRow = document.getElementById('invDiscountRow');
            const discountValue = document.getElementById('invDiscount');
            const promoCodeRow = document.getElementById('invPromoCodeRow');
            const promoCodeValue = document.getElementById('invPromoCode');
            const qrLinkEl = document.getElementById('invQrLink');

            const invoiceLogo = document.getElementById('invLogo');
            if (invoiceLogo) {
                invoiceLogo.src = getNewketLogoUrl();
            }
            if (qrLinkEl) qrLinkEl.href = qrTargetUrl;

            const invItems = document.getElementById('invItems');
            invItems.innerHTML = o.items.map(item => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px 0;">${item.name}</td>
                    <td style="padding: 10px 0; text-align: center;">${item.quantity}</td>
                    <td style="padding: 10px 0; text-align: right;">${CurrencyManager.formatPrice(item.price)}</td>
                    <td style="padding: 10px 0; text-align: right;">${CurrencyManager.formatPrice(item.price * item.quantity)}</td>
                </tr>
            `).join('');

            document.getElementById('invSubtotal').textContent = CurrencyManager.formatPrice(amounts.subtotal);
            if (discountRow && discountValue) {
                const hasDiscount = discountAmount > 0;
                discountRow.classList.toggle('hidden', !hasDiscount);
                discountValue.textContent = hasDiscount ? `- ${CurrencyManager.formatPrice(discountAmount)}` : '';
            }
            if (promoCodeRow && promoCodeValue) {
                const hasPromoCode = Boolean(promoCode);
                promoCodeRow.classList.toggle('hidden', !hasPromoCode);
                promoCodeValue.textContent = promoCode;
            }
            document.getElementById('invDelivery').textContent = amounts.deliveryFee > 0
                ? CurrencyManager.formatPrice(amounts.deliveryFee)
                : 'Gratuit';
            document.getElementById('invTotal').textContent = CurrencyManager.formatPrice(amounts.total);

            // Trigger print dialog so the customer can save the invoice as PDF.
            const printContent = document.getElementById('invoiceTemplate').innerHTML;
            const printFrame = document.createElement('iframe');

            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);

            const printDocument = printFrame.contentWindow?.document;
            if (!printDocument) {
                printFrame.remove();
                showToast('Impossible de préparer la facture.', 'error');
                return;
            }

            printDocument.open();
            printDocument.write(`
                <!doctype html>
                <html>
                    <head>
                        <title>Facture NewKet</title>
                        <style>
                            @page { size: A4 portrait; margin: 10mm; }
                            * { box-sizing: border-box; }
                            html, body { width: 100%; }
                            body { margin: 0; font-family: Arial, sans-serif; color: #1f2937; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .invoice-sheet { position: relative; overflow: hidden; width: 100%; max-width: 760px; background: #fff; margin: 0 auto; page-break-inside: avoid; }
                            .invoice-accent { position: absolute; inset: 0 auto 0 0; width: 108px; background:
                                radial-gradient(circle at -8% 12%, rgba(183, 228, 199, 0.58) 0, rgba(183, 228, 199, 0.58) 34%, transparent 35%),
                                radial-gradient(circle at 18% 34%, rgba(16, 185, 129, 0.16) 0, rgba(16, 185, 129, 0.16) 44%, transparent 45%),
                                radial-gradient(circle at 2% 60%, rgba(74, 222, 128, 0.18) 0, rgba(74, 222, 128, 0.18) 38%, transparent 39%),
                                linear-gradient(180deg, rgba(220, 252, 231, 0.95), rgba(255, 255, 255, 0.25)); }
                            .invoice-body { position: relative; padding: 18px 20px 14px 58px; }
                            .invoice-header { margin-bottom: 12px; }
                            .invoice-header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
                            .invoice-brand { display: flex; align-items: center; gap: 12px; }
                            .invoice-logo { width: 64px; height: 64px; object-fit: contain; }
                            .invoice-title { font-size: 32px; line-height: 0.95; font-weight: 900; letter-spacing: 0.02em; color: #065f46; }
                            .invoice-subtitle { margin-top: 6px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em; }
                            .invoice-meta-card { min-width: 200px; padding: 10px 12px; border: 1px solid #d1fae5; border-radius: 14px; background: linear-gradient(180deg, #f0fdf4, #ffffff); }
                            .invoice-meta-card--below { margin-top: 8px; margin-left: auto; max-width: 300px; }
                            .invoice-meta-row { display: flex; justify-content: space-between; gap: 14px; font-size: 11px; padding: 3px 0; }
                            .invoice-meta-row span { color: #065f46; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
                            .invoice-meta-row strong { color: #111827; font-weight: 800; }
                            .invoice-parties { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
                            .invoice-party-card { padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 14px; background: #ffffff; }
                            .invoice-party-card--soft { background: #f0fdf4; border-color: #bbf7d0; }
                            .invoice-party-label { font-size: 10px; font-weight: 900; color: #047857; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
                            .invoice-party-name { font-size: 14px; font-weight: 800; color: #111827; line-height: 1.2; }
                            .invoice-party-detail { margin-top: 4px; font-size: 11px; line-height: 1.35; color: #6b7280; }
                            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
                            .invoice-table thead th { padding: 8px 10px; border-bottom: 2px solid #a7f3d0; font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; }
                            .invoice-table td { padding: 9px 10px; border-bottom: 1px solid #ecfdf5; font-size: 11px; color: #1f2937; }
                            .invoice-table tbody tr:last-child td { border-bottom: 0; }
                            .text-center { text-align: center !important; }
                            .text-right { text-align: right !important; }
                            .invoice-totals { margin-left: auto; width: 250px; padding: 12px 14px; border-radius: 14px; background: #f9fafb; border: 1px solid #e5e7eb; }
                            .invoice-total-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 4px 0; font-size: 12px; color: #4b5563; }
                            .invoice-total-row strong { color: #111827; font-weight: 800; }
                            .invoice-total-row--discount strong { color: #047857; }
                            .invoice-total-row--grand { margin-top: 6px; padding-top: 10px; border-top: 2px solid #10b981; font-size: 16px; font-weight: 900; color: #065f46; }
                            .invoice-total-row--grand strong { font-size: 20px; color: #065f46; }
                            .invoice-security { margin-top: 12px; display: flex; justify-content: flex-end; }
                            .invoice-qr-card { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 320px; padding: 10px 12px; border-radius: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; }
                            .invoice-qr-image { width: 76px; height: 76px; object-fit: contain; background: #ffffff; border-radius: 10px; padding: 6px; border: 1px solid #d1fae5; }
                            .invoice-qr-copy { min-width: 0; flex: 1; }
                            .invoice-qr-code { margin-top: 3px; font-size: 13px; font-weight: 900; color: #065f46; letter-spacing: 0.08em; word-break: break-word; }
                            .hidden { display: none !important; }
                        </style>
                    </head>
                    <body>${printContent}</body>
                </html>
            `);
            printDocument.close();

            await waitForFrameAssets(printFrame);

            setTimeout(() => {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                setTimeout(() => printFrame.remove(), 1000);
            }, 250);
        }

        function removeFavorite(id) {
            FavoritesManager.removeItem(id);
            renderFavorites(); // Dynamic refresh
        }

        // Add to cart has been removed and replaced with contactSeller from ui-helpers.
    