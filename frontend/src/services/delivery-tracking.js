/**
 * NewKet Realtime Delivery Tracker
 * 
 * Provides real-time bidirectional GPS tracking, in-app chat, and WebRTC voice calls
 * between Vendor and Customer using Supabase Realtime Broadcast (zero DB load) and Leaflet.js.
 * 
 * Features:
 * - 5-second throttled GPS updates with 5s heartbeat interval.
 * - In-App Realtime Chat with quick preset message chips.
 * - In-App WebRTC Voice Call (100% free, zero telecom charges, WebRTC P2P audio).
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
            this.heartbeatInterval = null;
            this.lastBroadcastLocation = null;

            // WebRTC Call state
            this.peerConnection = null;
            this.localStream = null;
            this.remoteStream = null;
            this.callState = 'idle'; // 'idle' | 'calling' | 'incoming' | 'connected'

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
                callBtn: null,
                chatInput: null,
                chatList: null,
                callModal: null
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
         * Build the map container, top header bar, mini-chat & call modal inside the target container.
         */
        _buildUI() {
            const isVendor = this.role === 'vendor';
            const peerLabel = isVendor ? 'Client' : 'Vendeur';

            this.dom.container.innerHTML = `
                <div class="delivery-tracker-card bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                    <!-- Top Status Bar -->
                    <div class="p-3.5 bg-gray-900 text-white flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0 flex-1">
                            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
                            <div class="truncate">
                                <span class="text-xs font-bold uppercase tracking-wider text-gray-300 block">
                                    ${isVendor ? 'Livraison en direct (Vous ➔ Client)' : 'Suivi du Livreur en direct'}
                                </span>
                                <span id="dt-status-text" class="text-[11px] text-gray-400 font-medium">Recherche de signal GPS...</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                            <!-- Voice Call Button -->
                            <button id="dt-call-btn" type="button" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 shadow-sm" title="Appeler">
                                <iconify-icon icon="solar:phone-bold" width="14"></iconify-icon>
                                <span>Appeler</span>
                            </button>
                            <!-- Pause Button -->
                            <button id="dt-pause-btn" type="button" class="px-2 py-1 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors flex items-center gap-1" title="Pause GPS">
                                <iconify-icon icon="solar:pause-circle-bold" width="14"></iconify-icon>
                                <span class="hidden sm:inline">Partage</span>
                            </button>
                        </div>
                    </div>

                    <!-- Map View -->
                    <div class="relative w-full h-[280px] sm:h-[340px] bg-gray-100">
                        <div id="dt-map-viewport" class="w-full h-full z-0"></div>
                        
                        <!-- Floating Distance Badge -->
                        <div id="dt-distance-badge" class="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-gray-200/80 shadow-md flex items-center justify-between gap-2 z-[400]">
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center flex-shrink-0">
                                    <iconify-icon icon="${isVendor ? 'solar:user-bold' : 'solar:box-minimalistic-bold'}" width="18"></iconify-icon>
                                </div>
                                <div class="truncate">
                                    <p class="text-[10px] uppercase font-bold text-gray-400 leading-tight">
                                        Position du ${peerLabel.toLowerCase()}
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

                    <!-- Realtime Delivery In-App Mini-Chat -->
                    <div class="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
                        <!-- Quick Message Chips -->
                        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                            <button type="button" class="dt-chip-btn shrink-0 px-2.5 py-1 bg-white border border-gray-200 rounded-full font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                                Je suis là !
                            </button>
                            <button type="button" class="dt-chip-btn shrink-0 px-2.5 py-1 bg-white border border-gray-200 rounded-full font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                                Je t'attends au portail
                            </button>
                            <button type="button" class="dt-chip-btn shrink-0 px-2.5 py-1 bg-white border border-gray-200 rounded-full font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                                J'arrive dans 2 min
                            </button>
                        </div>

                        <!-- Chat Messages Container -->
                        <div id="dt-chat-messages" class="max-h-[110px] overflow-y-auto space-y-1.5 pr-1 text-xs">
                            <div class="text-[11px] text-gray-400 italic text-center py-1">
                                Chat de livraison sécurisé. Écrivez un message rapide...
                            </div>
                        </div>

                        <!-- Chat Input Form -->
                        <form id="dt-chat-form" class="flex items-center gap-2 pt-1">
                            <input id="dt-chat-input" type="text" placeholder="Message rapide..." 
                                class="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-black transition-colors" maxlength="150" />
                            <button type="submit" class="px-3 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center">
                                <iconify-icon icon="solar:plain-bold" width="14"></iconify-icon>
                            </button>
                        </form>
                    </div>

                    <!-- Privacy Notice -->
                    <div class="px-3.5 py-2 bg-gray-900 text-gray-400 flex items-center justify-between text-[11px]">
                        <span class="flex items-center gap-1 text-emerald-400 font-semibold">
                            <iconify-icon icon="solar:shield-check-bold" width="14"></iconify-icon>
                            Appel & Chat In-App Gratuits
                        </span>
                        <span class="font-medium text-gray-500">Actualisation 5s</span>
                    </div>

                    <!-- In-App WebRTC Voice Call Overlay / Modal -->
                    <div id="dt-call-overlay" class="hidden absolute inset-0 bg-gray-900/95 backdrop-blur-md z-[500] flex flex-col items-center justify-center p-6 text-white text-center">
                        <div class="w-16 h-16 rounded-full bg-emerald-600/30 border-2 border-emerald-400 flex items-center justify-center mb-4 animate-pulse">
                            <iconify-icon icon="solar:phone-calling-bold" width="32" class="text-emerald-400"></iconify-icon>
                        </div>
                        <h4 id="dt-call-title" class="text-base font-extrabold uppercase tracking-wider mb-1">Appel en cours...</h4>
                        <p id="dt-call-subtitle" class="text-xs text-gray-300 mb-6">Connexion audio sécurisée avec le ${peerLabel.toLowerCase()}</p>
                        
                        <!-- Call Action Buttons -->
                        <div class="flex items-center gap-4">
                            <!-- Answer Button (Visible only on incoming) -->
                            <button id="dt-btn-answer" type="button" class="hidden px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95">
                                <iconify-icon icon="solar:phone-bold" width="18"></iconify-icon>
                                <span>Décrocher</span>
                            </button>
                            <!-- Mute Button -->
                            <button id="dt-btn-mute" type="button" class="hidden px-4 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-semibold text-xs flex items-center gap-1.5">
                                <iconify-icon icon="solar:muted-bold" width="16"></iconify-icon>
                                <span id="dt-mute-text">Muet</span>
                            </button>
                            <!-- End Call Button -->
                            <button id="dt-btn-hangup" type="button" class="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 font-bold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95">
                                <iconify-icon icon="solar:phone-dead-bold" width="18"></iconify-icon>
                                <span>Raccrocher</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            this.dom.mapEl = this.dom.container.querySelector('#dt-map-viewport');
            this.dom.statusEl = this.dom.container.querySelector('#dt-status-text');
            this.dom.distanceEl = this.dom.container.querySelector('#dt-distance-text');
            this.dom.pauseBtn = this.dom.container.querySelector('#dt-pause-btn');
            this.dom.callBtn = this.dom.container.querySelector('#dt-call-btn');
            this.dom.chatInput = this.dom.container.querySelector('#dt-chat-input');
            this.dom.chatList = this.dom.container.querySelector('#dt-chat-messages');
            this.dom.callOverlay = this.dom.container.querySelector('#dt-call-overlay');

            // Event Listeners
            this.dom.pauseBtn.addEventListener('click', () => this.togglePause());
            this.dom.callBtn.addEventListener('click', () => this.startCall());
            this.dom.container.querySelector('#dt-recenter-btn').addEventListener('click', () => this.recenter());

            // Chat Form submit
            const chatForm = this.dom.container.querySelector('#dt-chat-form');
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this._sendChatMessage(this.dom.chatInput.value);
            });

            // Quick Message Chips
            this.dom.container.querySelectorAll('.dt-chip-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._sendChatMessage(btn.textContent.trim());
                });
            });

            // Call buttons
            this.dom.container.querySelector('#dt-btn-answer').addEventListener('click', () => this.acceptCall());
            this.dom.container.querySelector('#dt-btn-hangup').addEventListener('click', () => this.endCall());
            this.dom.container.querySelector('#dt-btn-mute').addEventListener('click', () => this.toggleMute());
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
                .on('broadcast', { event: 'chat-message' }, (payload) => {
                    this._handleIncomingChatMessage(payload.payload);
                })
                .on('broadcast', { event: 'call-signal' }, (payload) => {
                    this._handleCallSignal(payload.payload);
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

                    this._updateMyMarker(this.myLocation);
                    this._updateDistance();

                    if (this.isPaused) return;

                    const now = Date.now();
                    if (now - lastBroadcastTime >= THROTTLE_MS) {
                        lastBroadcastTime = now;
                        this.lastBroadcastLocation = { ...this.myLocation };
                        this._broadcastLocation(this.myLocation);
                    }
                },
                (error) => {
                    console.warn('[DeliveryTracker] Geolocation error:', error.message);
                    if (this.dom.statusEl) {
                        this.dom.statusEl.textContent = error.code === 1 
                            ? 'Accès GPS refusé. Veuillez l\'activer.' 
                            : 'Signal GPS faible ou indisponible.';
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
         * Broadcast local coordinates.
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
         * Send a text message in the in-app delivery mini-chat.
         */
        _sendChatMessage(text) {
            const message = String(text || '').trim();
            if (!message || !this.channel) return;

            const msgData = {
                role: this.role,
                text: message,
                timestamp: Date.now()
            };

            this.channel.send({
                type: 'broadcast',
                event: 'chat-message',
                payload: msgData
            }).then(() => {
                this._renderChatBubble(msgData, true);
                if (this.dom.chatInput) this.dom.chatInput.value = '';
            }).catch(err => console.warn('[DeliveryTracker] Chat send error:', err));
        }

        /**
         * Handle incoming chat message from peer.
         */
        _handleIncomingChatMessage(data) {
            if (!data || data.role === this.role) return;
            this._renderChatBubble(data, false);
            
            // Audio beep notification on incoming message
            this._playNotificationBeep();
        }

        /**
         * Render chat bubble inside the mini-chat container.
         */
        _renderChatBubble(data, isMe) {
            if (!this.dom.chatList) return;

            const timeStr = new Date(data.timestamp || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const bubbleHtml = `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    <div class="px-3 py-1.5 rounded-2xl text-xs max-w-[85%] ${isMe ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none shadow-sm'}">
                        <p class="font-medium break-words">${this._escapeHtml(data.text)}</p>
                    </div>
                    <span class="text-[9px] text-gray-400 mt-0.5 px-1">${timeStr}</span>
                </div>
            `;

            // Remove placeholder if present
            const placeholder = this.dom.chatList.querySelector('.italic');
            if (placeholder) placeholder.remove();

            this.dom.chatList.insertAdjacentHTML('beforeend', bubbleHtml);
            this.dom.chatList.scrollTop = this.dom.chatList.scrollHeight;
        }

        /**
         * WebRTC Voice Call Implementation (Free P2P Audio)
         */
        async startCall() {
            if (this.callState !== 'idle') return;
            this.callState = 'calling';
            this._showCallOverlay('Appel en cours...', `Connexion audio avec le ${this.role === 'vendor' ? 'client' : 'vendeur'}...`, false);

            // Signal de sonnerie immédiat (< 50ms) avant même l'initialisation du micro
            this._sendCallSignal({ type: 'ring' });

            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this._createPeerConnection();

                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });

                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);

                this._sendCallSignal({ type: 'offer', offer });
            } catch (err) {
                console.warn('[DeliveryTracker] Micro access error:', err.message);
                alert('Veuillez autoriser l\'accès au micro pour effectuer l\'appel audio.');
                this.endCall();
            }
        }

        async acceptCall() {
            if (this.callState !== 'incoming') return;
            this.callState = 'connected';
            this._showCallOverlay('En communication', 'Appel vocal actif', true);

            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this._createPeerConnection();

                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });

                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);

                this._sendCallSignal({ type: 'answer', answer });
            } catch (err) {
                console.warn('[DeliveryTracker] Accept call error:', err.message);
                this.endCall();
            }
        }

        endCall() {
            if (this.callState !== 'idle' && this.channel) {
                this._sendCallSignal({ type: 'hangup' });
            }
            this._resetCallState();
        }

        toggleMute() {
            if (this.localStream) {
                const audioTrack = this.localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    const muteBtnText = this.dom.container.querySelector('#dt-mute-text');
                    if (muteBtnText) muteBtnText.textContent = audioTrack.enabled ? 'Muet' : 'Activer Micro';
                }
            }
        }

        _createPeerConnection() {
            // Free public Google STUN server for ICE candidate resolution
            const configuration = {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            };

            this.peerConnection = new RTCPeerConnection(configuration);

            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this._sendCallSignal({ type: 'candidate', candidate: event.candidate });
                }
            };

            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                let audioEl = document.getElementById('dt-remote-audio');
                if (!audioEl) {
                    audioEl = document.createElement('audio');
                    audioEl.id = 'dt-remote-audio';
                    audioEl.autoplay = true;
                    document.body.appendChild(audioEl);
                }
                audioEl.srcObject = this.remoteStream;
            };
        }

        _sendCallSignal(payload) {
            if (!this.channel) return;
            this.channel.send({
                type: 'broadcast',
                event: 'call-signal',
                payload: { role: this.role, ...payload }
            }).catch(err => console.warn('[DeliveryTracker] Call signal send error:', err));
        }

        _handleCallSignal(data) {
            if (!data || data.role === this.role) return;

            if (data.type === 'ring') {
                if (this.callState === 'idle') {
                    this.callState = 'incoming';
                    this._showCallOverlay('Appel entrant...', `Le ${data.role === 'vendor' ? 'vendeur' : 'client'} souhaite vous parler`, false, true);
                    this._playRingtone();
                }
            } else if (data.type === 'offer') {
                this.pendingOffer = data.offer;
                if (this.callState === 'idle') {
                    this.callState = 'incoming';
                    this._showCallOverlay('Appel entrant...', `Le ${data.role === 'vendor' ? 'vendeur' : 'client'} souhaite vous parler`, false, true);
                    this._playRingtone();
                }
            } else if (data.type === 'answer' && this.peerConnection) {
                this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                this.callState = 'connected';
                this._showCallOverlay('En communication', 'Appel vocal actif', true);
            } else if (data.type === 'candidate' && this.peerConnection) {
                this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
            } else if (data.type === 'hangup') {
                this._resetCallState();
            }
        }

        _showCallOverlay(title, subtitle, isConnected = false, isIncoming = false) {
            if (!this.dom.callOverlay) return;
            this.dom.callOverlay.classList.remove('hidden');

            this.dom.container.querySelector('#dt-call-title').textContent = title;
            this.dom.container.querySelector('#dt-call-subtitle').textContent = subtitle;

            const btnAnswer = this.dom.container.querySelector('#dt-btn-answer');
            const btnMute = this.dom.container.querySelector('#dt-btn-mute');

            btnAnswer.classList.toggle('hidden', !isIncoming);
            btnMute.classList.toggle('hidden', !isConnected);
        }

        _resetCallState() {
            this.callState = 'idle';
            if (this.dom.callOverlay) this.dom.callOverlay.classList.add('hidden');

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            const audioEl = document.getElementById('dt-remote-audio');
            if (audioEl) audioEl.remove();
        }

        _playNotificationBeep() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
            } catch (e) {}
        }

        _playRingtone() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.6);
            } catch (e) {}
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

            // Trace ou met à jour la ligne directe pointillée entre les 2 positions
            if (this.map && window.L) {
                const points = [
                    [this.myLocation.lat, this.myLocation.lng],
                    [this.peerLocation.lat, this.peerLocation.lng]
                ];
                if (!this.trackingPolyline) {
                    this.trackingPolyline = window.L.polyline(points, {
                        color: '#10b981',
                        weight: 3,
                        dashArray: '6, 8',
                        opacity: 0.85
                    }).addTo(this.map);
                } else {
                    this.trackingPolyline.setLatLngs(points);
                }
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
                        <span class="hidden sm:inline text-amber-300">En pause</span>
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
                        <span class="hidden sm:inline">Partage</span>
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

        _getDistanceMeters(p1, p2) {
            const R = 6371e3;
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

        _escapeHtml(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
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
            this._resetCallState();

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

            if (this.trackingPolyline) {
                try {
                    this.trackingPolyline.remove();
                } catch (e) {}
                this.trackingPolyline = null;
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

    window.DeliveryTracker = DeliveryTracker;
    window.deliveryTrackerInstance = new DeliveryTracker();
})();
