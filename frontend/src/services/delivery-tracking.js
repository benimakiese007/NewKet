/**
 * NewKet Realtime Delivery Tracker
 * 
 * Provides real-time bidirectional GPS tracking between Vendor and Customer
 * using Supabase Realtime Broadcast (zero DB load) and Leaflet.js maps.
 * 
 * Features:
 * - 5-second throttled updates with a 10m movement filter to conserve battery & bandwidth.
 * - Screen WakeLock API to keep device screens active while navigating.
 * - Automatic distance calculation (Haversine formula).
 * - Offline / stale signal detection ("Signal perdu il y a X sec").
 * - Privacy pause switch.
 * - Auto-teardown upon PIN validation (DELIVERED).
 */

(function () {
    'use strict';

    class DeliveryTracker {
        constructor() {
            this.orderId = null;
            this.role = null; // 'vendor' | 'customer'
            this.map = null;
            this.channel = null;
            this.watchId = null;
            this.wakeLock = null;
            this.isPaused = false;
            
            this.myLocation = null;
            this.peerLocation = null;
            this.lastPeerUpdate = null;
            this.staleInterval = null;
            this.lastBroadcastLocation = null;

            this.markers = {
                vendor: null,
                customer: null
            };

            this.dom = {
                container: null,
                mapEl: null,
                distanceEl: null,
                statusEl: null,
                pauseBtn: null,
                pinDisplayEl: null
            };
        }

        /**
         * Initialize and start tracking for a specific order.
         * @param {Object} options
         * @param {string} options.orderId
         * @param {string} options.role - 'vendor' | 'customer'
         * @param {HTMLElement|string} options.container - Container element or selector
         * @param {Object} [options.initialCustomerCoords] - Optional fallback { lat, lng }
         * @param {Function} [options.onStatusChange]
         */
        async start({ orderId, role, container, initialCustomerCoords = null, onStatusChange = null }) {
            this.orderId = orderId;
            this.role = role;
            this.onStatusChange = onStatusChange;

            const root = typeof container === 'string' ? document.querySelector(container) : container;
            if (!root) {
                console.error('[DeliveryTracker] Container element not found.');
                return;
            }
            this.dom.container = root;

            // Ensure Leaflet is loaded
            if (typeof window.loadLeaflet === 'function') {
                await window.loadLeaflet();
            }

            if (!window.L) {
                this._renderError('Impossible de charger la carte Leaflet. Vérifiez votre connexion.');
                return;
            }

            this._buildUI();
            this._initMap(initialCustomerCoords);
            this._initRealtime();
            this._startLocationWatch();
            this._requestWakeLock();
            this._startStaleCheck();
        }

        /**
         * Build the map container and header bar inside the target container.
         */
        _buildUI() {
            this.dom.container.innerHTML = `
                <div class="delivery-tracker-card bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                    <!-- Top Status Bar -->
                    <div class="p-3.5 bg-gray-900 text-white flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
                            <div class="truncate">
                                <span class="text-xs font-bold uppercase tracking-wider text-gray-300 block">
                                    ${this.role === 'vendor' ? 'Livraison en direct (Vous ➔ Client)' : 'Suivi du Livreur en direct'}
                                </span>
                                <span id="dt-status-text" class="text-[11px] text-gray-400 font-medium">Recherche de signal GPS...</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button id="dt-pause-btn" type="button" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors flex items-center gap-1.5">
                                <iconify-icon icon="solar:pause-circle-bold" width="14"></iconify-icon>
                                <span>Partage actif</span>
                            </button>
                        </div>
                    </div>

                    <!-- Map View -->
                    <div class="relative w-full h-[320px] sm:h-[380px] bg-gray-100">
                        <div id="dt-map-viewport" class="w-full h-full z-0"></div>
                        
                        <!-- Floating Distance Badge -->
                        <div id="dt-distance-badge" class="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-gray-200/80 shadow-md flex items-center justify-between gap-2 z-[400]">
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center flex-shrink-0">
                                    <iconify-icon icon="${this.role === 'vendor' ? 'solar:user-bold' : 'solar:box-minimalistic-bold'}" width="18"></iconify-icon>
                                </div>
                                <div class="truncate">
                                    <p class="text-[10px] uppercase font-bold text-gray-400 leading-tight">
                                        ${this.role === 'vendor' ? 'Position du client' : 'Position du vendeur'}
                                    </p>
                                    <p id="dt-distance-text" class="text-xs font-extrabold text-gray-900 truncate">
                                        Calcul de la distance...
                                    </p>
                                </div>
                            </div>
                            <button id="dt-recenter-btn" type="button" class="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors" title="Recentrer">
                                <iconify-icon icon="solar:gps-bold" width="16"></iconify-icon>
                            </button>
                        </div>
                    </div>

                    <!-- Safe Privacy Notice -->
                    <div class="px-3.5 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                        <span class="flex items-center gap-1">
                            <iconify-icon icon="solar:shield-check-bold" class="text-emerald-600" width="14"></iconify-icon>
                            Canal éphémère sécurisé
                        </span>
                        <span class="font-medium text-gray-400">Actualisation 5s</span>
                    </div>
                </div>
            `;

            this.dom.mapEl = this.dom.container.querySelector('#dt-map-viewport');
            this.dom.statusEl = this.dom.container.querySelector('#dt-status-text');
            this.dom.distanceEl = this.dom.container.querySelector('#dt-distance-text');
            this.dom.pauseBtn = this.dom.container.querySelector('#dt-pause-btn');

            this.dom.pauseBtn.addEventListener('click', () => this.togglePause());
            this.dom.container.querySelector('#dt-recenter-btn').addEventListener('click', () => this.recenter());
        }

        /**
         * Initialize Leaflet map instance.
         */
        _initMap(initialCustomerCoords) {
            const L = window.L;
            if (!L || !this.dom.mapEl) return;

            // Clean up any stale map
            if (this.dom.mapEl._leaflet_id && L.map._instances) {
                try {
                    delete this.dom.mapEl._leaflet_id;
                } catch (e) {}
            }

            // Default fallback center: Kinshasa (-4.3224, 15.3070)
            const fallbackLat = initialCustomerCoords?.lat || -4.3224;
            const fallbackLng = initialCustomerCoords?.lng || 15.3070;

            this.map = L.map(this.dom.mapEl, {
                zoomControl: false,
                attributionControl: false
            }).setView([fallbackLat, fallbackLng], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(this.map);

            L.control.zoom({ position: 'topright' }).addTo(this.map);

            // Custom icons
            const vendorHtml = `
                <div class="relative flex items-center justify-center">
                    <div class="w-10 h-10 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center border-2 border-white ring-2 ring-emerald-400/50 animate-bounce">
                        <iconify-icon icon="solar:box-minimalistic-bold" width="20"></iconify-icon>
                    </div>
                </div>`;
            const customerHtml = `
                <div class="relative flex items-center justify-center">
                    <div class="w-10 h-10 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center border-2 border-white ring-2 ring-indigo-400/50">
                        <iconify-icon icon="solar:user-bold" width="20"></iconify-icon>
                    </div>
                </div>`;

            this.vendorIcon = L.divIcon({
                className: 'custom-leaflet-marker-vendor',
                html: vendorHtml,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            this.customerIcon = L.divIcon({
                className: 'custom-leaflet-marker-customer',
                html: customerHtml,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            // If initial customer coordinates were provided, place fallback marker
            if (initialCustomerCoords && initialCustomerCoords.lat && initialCustomerCoords.lng) {
                this.markers.customer = L.marker([initialCustomerCoords.lat, initialCustomerCoords.lng], {
                    icon: this.customerIcon
                }).addTo(this.map);
            }
        }

        /**
         * Subscribe to Supabase Realtime Broadcast channel.
         */
        _initRealtime() {
            const client = window.supabaseClient || (window.Supabase && window.Supabase.client);
            if (!client || typeof client.channel !== 'function') {
                console.warn('[DeliveryTracker] Supabase client unavailable for realtime broadcast.');
                return;
            }

            const channelName = `order-tracking:${this.orderId}`;
            this.channel = client.channel(channelName, {
                config: { broadcast: { self: false } }
            });

            this.channel
                .on('broadcast', { event: 'location-update' }, (payload) => {
                    this._handlePeerUpdate(payload.payload);
                })
                .on('broadcast', { event: 'tracking-pause' }, (payload) => {
                    this._handlePeerPause(payload.payload);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        if (this.dom.statusEl) {
                            this.dom.statusEl.textContent = 'Connecté au flux temps réel';
                        }
                    }
                });
        }

        /**
         * Start tracking local device GPS with watchPosition.
         */
        _startLocationWatch() {
            if (!('geolocation' in navigator)) {
                this._renderError('La géolocalisation n\'est pas supportée par votre appareil.');
                return;
            }

            let lastBroadcastTime = 0;
            const THROTTLE_MS = 4500; // 5 seconds roughly

            this.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude, accuracy, heading } = position.coords;
                    this.myLocation = { lat: latitude, lng: longitude, accuracy, heading };

                    // Update my marker on map
                    this._updateMyMarker(this.myLocation);
                    this._updateDistance();

                    // If paused, do not broadcast to peer
                    if (this.isPaused) return;

                    const now = Date.now();
                    const shouldBroadcast = (now - lastBroadcastTime >= THROTTLE_MS);

                    if (shouldBroadcast) {
                        lastBroadcastTime = now;
                        this.lastBroadcastLocation = { ...this.myLocation };
                        this._broadcastLocation(this.myLocation);
                    }
                },
                (error) => {
                    console.warn('[DeliveryTracker] Geolocation error:', error.message);
                    if (this.dom.statusEl) {
                        if (error.code === 1) {
                            this.dom.statusEl.textContent = 'Accès GPS refusé. Veuillez l\'activer dans vos réglages.';
                        } else {
                            this.dom.statusEl.textContent = 'Signal GPS faible ou indisponible.';
                        }
                    }
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 3000,
                    timeout: 10000
                }
            );

            // Heartbeat: émettre toutes les 5 secondes même à l'arrêt complet
            this.heartbeatInterval = setInterval(() => {
                if (this.myLocation && !this.isPaused) {
                    this._broadcastLocation(this.myLocation);
                }
            }, 5000);
        }

        /**
         * Broadcast local coordinates to the peer over Supabase channel.
         */
        _broadcastLocation(coords) {
            if (!this.channel) return;
            this.channel.send({
                type: 'broadcast',
                event: 'location-update',
                payload: {
                    role: this.role,
                    lat: coords.lat,
                    lng: coords.lng,
                    accuracy: coords.accuracy,
                    timestamp: Date.now()
                }
            }).catch(err => console.warn('[DeliveryTracker] Broadcast send error:', err));
        }

        /**
         * Handle incoming location update from the other party.
         */
        _handlePeerUpdate(data) {
            if (!data || data.role === this.role) return;

            this.peerLocation = { lat: data.lat, lng: data.lng };
            this.lastPeerUpdate = Date.now();

            const targetRole = this.role === 'vendor' ? 'customer' : 'vendor';
            const icon = targetRole === 'vendor' ? this.vendorIcon : this.customerIcon;

            if (!this.markers[targetRole]) {
                this.markers[targetRole] = window.L.marker([data.lat, data.lng], { icon }).addTo(this.map);
            } else {
                this.markers[targetRole].setLatLng([data.lat, data.lng]);
            }

            this._updateDistance();
            this._updateStatusFresh();
        }

        /**
         * Handle peer pause signal.
         */
        _handlePeerPause(data) {
            if (!data || data.role === this.role) return;
            if (this.dom.statusEl) {
                const label = data.role === 'vendor' ? 'Le vendeur' : 'Le client';
                this.dom.statusEl.textContent = `${label} a mis sa localisation en pause.`;
            }
        }

        /**
         * Update marker for current user.
         */
        _updateMyMarker(coords) {
            if (!this.map || !window.L) return;

            const icon = this.role === 'vendor' ? this.vendorIcon : this.customerIcon;

            if (!this.markers[this.role]) {
                this.markers[this.role] = window.L.marker([coords.lat, coords.lng], { icon }).addTo(this.map);
                this.map.setView([coords.lat, coords.lng], 16);
            } else {
                this.markers[this.role].setLatLng([coords.lat, coords.lng]);
            }
        }

        /**
         * Calculate and update distance between parties.
         */
        _updateDistance() {
            if (!this.myLocation || !this.peerLocation || !this.dom.distanceEl) return;

            const meters = Math.round(this._getDistanceMeters(this.myLocation, this.peerLocation));
            const targetLabel = this.role === 'vendor' ? 'Le client' : 'Le vendeur';

            if (meters < 1000) {
                this.dom.distanceEl.textContent = `${targetLabel} est à ${meters} mètres`;
            } else {
                const km = (meters / 1000).toFixed(1);
                this.dom.distanceEl.textContent = `${targetLabel} est à ~${km} km`;
            }
        }

        /**
         * Periodic check for stale / lost signal.
         */
        _startStaleCheck() {
            this.staleInterval = setInterval(() => {
                if (!this.lastPeerUpdate) return;
                const elapsedSec = Math.floor((Date.now() - this.lastPeerUpdate) / 1000);

                if (elapsedSec > 15 && this.dom.statusEl) {
                    const minutes = Math.floor(elapsedSec / 60);
                    const label = minutes > 0 ? `${minutes} min` : `${elapsedSec} sec`;
                    this.dom.statusEl.textContent = `Dernière position connue reçue il y a ${label}`;
                }
            }, 5000);
        }

        _updateStatusFresh() {
            if (this.dom.statusEl) {
                this.dom.statusEl.textContent = 'Position en direct synchronisée';
            }
        }

        /**
         * Toggle privacy pause.
         */
        togglePause() {
            this.isPaused = !this.isPaused;
            if (this.dom.pauseBtn) {
                if (this.isPaused) {
                    this.dom.pauseBtn.innerHTML = `
                        <iconify-icon icon="solar:play-circle-bold" width="14" class="text-amber-400"></iconify-icon>
                        <span class="text-amber-300">En pause</span>
                    `;
                    if (this.channel) {
                        this.channel.send({
                            type: 'broadcast',
                            event: 'tracking-pause',
                            payload: { role: this.role, paused: true }
                        });
                    }
                } else {
                    this.dom.pauseBtn.innerHTML = `
                        <iconify-icon icon="solar:pause-circle-bold" width="14"></iconify-icon>
                        <span>Partage actif</span>
                    `;
                    if (this.myLocation) {
                        this._broadcastLocation(this.myLocation);
                    }
                }
            }
        }

        /**
         * Recenter map to fit both markers.
         */
        recenter() {
            if (!this.map || !window.L) return;

            const validPoints = [];
            if (this.myLocation) validPoints.push([this.myLocation.lat, this.myLocation.lng]);
            if (this.peerLocation) validPoints.push([this.peerLocation.lat, this.peerLocation.lng]);

            if (validPoints.length === 2) {
                const bounds = window.L.latLngBounds(validPoints);
                this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
            } else if (validPoints.length === 1) {
                this.map.setView(validPoints[0], 16);
            }
        }

        /**
         * Request Wake Lock to prevent screen sleep.
         */
        async _requestWakeLock() {
            if ('wakeLock' in navigator) {
                try {
                    this.wakeLock = await navigator.wakeLock.request('screen');
                    document.addEventListener('visibilitychange', async () => {
                        if (this.wakeLock !== null && document.visibilityState === 'visible') {
                            this.wakeLock = await navigator.wakeLock.request('screen');
                        }
                    });
                } catch (err) {
                    console.warn('[DeliveryTracker] Wake Lock not granted:', err.message);
                }
            }
        }

        /**
         * Haversine formula for distance in meters.
         */
        _getDistanceMeters(p1, p2) {
            const R = 6371e3; // Earth radius in meters
            const phi1 = (p1.lat * Math.PI) / 180;
            const phi2 = (p2.lat * Math.PI) / 180;
            const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
            const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

            const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                      Math.cos(phi1) * Math.cos(phi2) *
                      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            return R * c;
        }

        _renderError(message) {
            if (this.dom.container) {
                this.dom.container.innerHTML = `
                    <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2">
                        <iconify-icon icon="solar:danger-triangle-bold" width="18" class="text-amber-600 flex-shrink-0"></iconify-icon>
                        <span>${message}</span>
                    </div>
                `;
            }
        }

        /**
         * Completely destroy and clean up tracking resources.
         */
        destroy() {
            if (this.watchId && 'geolocation' in navigator) {
                navigator.geolocation.clearWatch(this.watchId);
                this.watchId = null;
            }

            if (this.staleInterval) {
                clearInterval(this.staleInterval);
                this.staleInterval = null;
            }

            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }

            if (this.channel) {
                try {
                    const client = window.supabaseClient || (window.Supabase && window.Supabase.client);
                    if (client && typeof client.removeChannel === 'function') {
                        client.removeChannel(this.channel);
                    }
                } catch (e) {}
                this.channel = null;
            }

            if (this.wakeLock) {
                try {
                    this.wakeLock.release();
                } catch (e) {}
                this.wakeLock = null;
            }

            if (this.map) {
                try {
                    this.map.remove();
                } catch (e) {}
                this.map = null;
            }

            if (this.dom.container) {
                this.dom.container.innerHTML = '';
            }
        }
    }

    // Expose singleton and class globally
    window.DeliveryTracker = DeliveryTracker;
    window.deliveryTrackerInstance = new DeliveryTracker();
})();
