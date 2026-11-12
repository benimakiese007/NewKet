/**
 * call-notifier.js - Interface d'appel vocal identique au dashboard sur toutes les pages
 * Affiche l'overlay d'appel plein écran & pilule PiP avec le même design, animations et icônes que sur le dashboard.
 */

(function initCallNotifier() {
    'use strict';

    const currentPath = window.location.pathname;
    const isOnDashboard = currentPath.includes('customer-dashboard') || currentPath.includes('vendor-dashboard');

    let _ringCtx = null;
    let _ringInterval = null;
    let _currentViewMode = 'fullscreen'; // 'fullscreen' | 'pip'
    let _activeIncomingData = null;

    // ── WebRTC state (géré directement ici, sans delivery-tracking.js) ────────
    let _peerConnection = null;
    let _pendingIceCandidates = [];
    let _localStream = null;
    let _remoteStream = null;
    let _orderChannel = null;      // Canal Supabase order pour les signaux WebRTC
    let _callState = 'idle';       // 'idle' | 'incoming' | 'connected'
    let _callTimerInterval = null;
    let _callDurationSecs = 0;
    let _isMuted = false;
    let _isSpeakerOn = false; // Haut-parleur OFF par défaut (comme WhatsApp / Téléphone)
    let _myRole = null;            // rôle de l'utilisateur courant (opposé de data.role)
    let _myName = null;
    let _myAvatar = null;

    // État du drag pour la pilule PiP
    const pipDrag = {
        isDragging: false,
        startX: 0,
        startY: 0,
        initialLeft: 0,
        initialTop: 0,
        hasMoved: false
    };


    function _cleanDisplayName(name) {
        if (!name) return 'Utilisateur';
        const str = String(name).trim();
        if (str.includes('@')) {
            return str.split('@')[0];
        }
        return str;
    }

    function _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ── Sonnerie Web Audio API ───────────────────────────────────────────────
    function _playRingTone() {
        try {
            if (_ringInterval) return;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            _ringCtx = new AudioCtx();

            const playDualTone = () => {
                if (!_ringCtx) return;
                try {
                    const osc1 = _ringCtx.createOscillator();
                    const osc2 = _ringCtx.createOscillator();
                    const gain = _ringCtx.createGain();

                    osc1.type = 'sine';
                    osc1.frequency.setValueAtTime(440, _ringCtx.currentTime);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(480, _ringCtx.currentTime);

                    gain.gain.setValueAtTime(0.12, _ringCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, _ringCtx.currentTime + 0.6);

                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(_ringCtx.destination);

                    osc1.start();
                    osc2.start();
                    osc1.stop(_ringCtx.currentTime + 0.6);
                    osc2.stop(_ringCtx.currentTime + 0.6);
                } catch (_) {}
            };

            playDualTone();
            _ringInterval = setInterval(playDualTone, 1400);
        } catch (_) {}
    }

    function _stopRingTone() {
        if (_ringInterval) {
            clearInterval(_ringInterval);
            _ringInterval = null;
        }
        if (_ringCtx) {
            try { _ringCtx.close(); } catch (_) {}
            _ringCtx = null;
        }
    }

    // ── Bascule Plein Écran / PiP ─────────────────────────────────────────────
    function _setViewMode(mode) {
        _currentViewMode = mode;
        const fullEl = document.getElementById('dt-global-call-fullscreen');
        const pipEl = document.getElementById('dt-global-call-pip');
        if (!fullEl || !pipEl) return;

        if (mode === 'pip') {
            fullEl.classList.add('hidden');
            pipEl.classList.remove('hidden');
            window.dispatchEvent(new CustomEvent('nativeOverlayClose'));
            try {
                window.ComponentsLoader?.syncNativeHeaderButtonsVisibility?.();
                window.ComponentsLoader?.syncNativeTabBarVisibility?.();
            } catch (_) {}
        } else {
            pipEl.classList.add('hidden');
            fullEl.classList.remove('hidden');
            // En mode Plein Écran : masquer le Liquid Glass natif iOS (premier plan absolu)
            try {
                window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
                window.Capacitor?.Plugins?.NativeHeaderButtons?.hide?.().catch(() => {});
                window.Capacitor?.Plugins?.NativeHeaderButtons?.hideClose?.().catch(() => {});
            } catch (_) {}
            window.dispatchEvent(new CustomEvent('nativeOverlayOpen'));
        }
    }

    // ── Drag & Snap pour la pilule PiP ───────────────────────────────────────
    function _setupPipDrag(pipEl) {
        if (!pipEl) return;
        pipEl.style.touchAction = 'none';

        const onPointerDown = (e) => {
            if (e.target.closest('button')) return;
            // Empêcher le scroll natif de la page lors du drag sur mobile
            if (e.cancelable) e.preventDefault();

            pipDrag.isDragging = true;
            pipDrag.hasMoved = false;
            pipDrag.startX = e.clientX;
            pipDrag.startY = e.clientY;

            const rect = pipEl.getBoundingClientRect();
            pipDrag.initialLeft = rect.left;
            pipDrag.initialTop = rect.top;

            pipEl.style.transition = 'none';
            try { pipEl.setPointerCapture?.(e.pointerId); } catch (_) {}
        };

        const onPointerMove = (e) => {
            if (!pipDrag.isDragging) return;
            // Bloquer tout défilement parasite de l'arrière-plan
            if (e.cancelable) e.preventDefault();

            const dx = e.clientX - pipDrag.startX;
            const dy = e.clientY - pipDrag.startY;

            if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
                pipDrag.hasMoved = true;
            }

            let newLeft = pipDrag.initialLeft + dx;
            let newTop = pipDrag.initialTop + dy;

            const pad = 10;
            newLeft = Math.max(pad, Math.min(window.innerWidth - pipEl.offsetWidth - pad, newLeft));
            newTop = Math.max(pad, Math.min(window.innerHeight - pipEl.offsetHeight - pad, newTop));

            pipEl.style.left = `${newLeft}px`;
            pipEl.style.top = `${newTop}px`;
            pipEl.style.right = 'auto';
        };

        const onPointerUp = (e) => {
            if (!pipDrag.isDragging) return;
            pipDrag.isDragging = false;
            try { pipEl.releasePointerCapture?.(e.pointerId); } catch (_) {}

            pipEl.style.transition = 'left 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1), top 0.25s ease-out';

            const rect = pipEl.getBoundingClientRect();
            const pad = 12;
            const screenCenter = window.innerWidth / 2;
            const pillCenter = rect.left + rect.width / 2;

            let targetLeft = pad;
            if (pillCenter >= screenCenter) {
                targetLeft = window.innerWidth - rect.width - pad;
            }

            let targetTop = Math.max(pad, Math.min(window.innerHeight - rect.height - pad, rect.top));

            pipEl.style.left = `${targetLeft}px`;
            pipEl.style.top = `${targetTop}px`;
            pipEl.style.right = 'auto';

            setTimeout(() => { pipDrag.hasMoved = false; }, 100);
        };

        pipEl.addEventListener('pointerdown', onPointerDown, { passive: false });
        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
    }

    // ── Construction de l'interface identique au Dashboard ──────────────────
    function _buildDashboardStyleCallUI(data) {
        let root = document.getElementById('newket-global-call-ui-root');
        if (root) root.remove();

        _activeIncomingData = data;

        const callerName = _cleanDisplayName(data.callerName || (data.role === 'vendor' ? 'Vendeur' : 'Client'));
        const callerAvatar = data.callerAvatar || '';
        const orderId = data.orderId || '';

        const subtitleText = `Le ${data.role === 'vendor' ? 'vendeur' : 'client'} souhaite vous parler`;
        const initials = callerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'NK';

        root = document.createElement('div');
        root.id = 'newket-global-call-ui-root';
        root.style.cssText = 'position: relative; z-index: 2147483647 !important; isolation: isolate;';
        root.innerHTML = `
            <!-- 1. FULLSCREEN CALL OVERLAY (Identique à delivery-tracking.js) -->
            <div id="dt-global-call-fullscreen" class="fixed inset-0 bg-gray-950/95 backdrop-blur-xl flex flex-col justify-between px-6 sm:px-8 text-white select-none transition-opacity duration-200" style="z-index: 2147483647 !important; padding-top: max(1.5rem, calc(env(safe-area-inset-top) + 0.75rem)); padding-bottom: max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem));">
                <!-- Top Bar: Privacy & Bouton Réduire PiP -->
                <div class="flex items-center justify-between w-full max-w-xl mx-auto pt-2">
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-emerald-400 text-xs font-semibold backdrop-blur-md">
                        <iconify-icon icon="solar:shield-check-bold" width="16"></iconify-icon>
                        <span>Appel Chiffré In-App</span>
                    </div>
                    <button id="dt-global-btn-minimize" type="button" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all shadow-md" title="Réduire en pilule flottante">
                        <iconify-icon icon="solar:minimize-square-3-bold" width="20"></iconify-icon>
                    </button>
                </div>

                <!-- Center Area: Grand Avatar, Nom, Statut & Chronomètre -->
                <div class="flex flex-col items-center justify-center text-center my-auto">
                    <div class="relative mb-5">
                        <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-emerald-400/80 shadow-2xl overflow-hidden bg-gray-800 flex items-center justify-center text-3xl font-bold text-emerald-400">
                            ${callerAvatar 
                                ? `<img src="${callerAvatar}" class="w-full h-full object-cover" alt="Avatar" />` 
                                : `<span>${initials}</span>`
                            }
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-gray-900 shadow-lg animate-pulse">
                            <iconify-icon icon="solar:phone-bold" width="18"></iconify-icon>
                        </div>
                    </div>

                    <h3 class="text-xl sm:text-2xl font-black tracking-wide text-white mb-1.5">${_escapeHtml(callerName)}</h3>
                    <h4 id="dt-global-call-title" class="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-1">APPEL ENTRANT...</h4>
                    <p id="dt-global-call-subtitle" class="text-xs text-gray-400 mb-3">${_escapeHtml(subtitleText)}</p>

                    <div id="dt-global-call-timer" class="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-sm font-bold border border-emerald-500/20">
                        Sonnerie...
                    </div>
                </div>

                <!-- Bottom Bar: Commandes Décrocher / Muet / Raccrocher -->
                <div class="flex items-center justify-center gap-6 pb-6 w-full max-w-md mx-auto">
                    <!-- Answer Button -->
                    <button id="dt-global-btn-answer" type="button" class="px-7 py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-emerald-500/30 transition-all cursor-pointer">
                        <iconify-icon icon="solar:phone-bold" width="22"></iconify-icon>
                        <span>Décrocher</span>
                    </button>

                    <!-- Mute Button (Masqué lors de la sonnerie, visible en appel) -->
                    <button id="dt-global-btn-mute" type="button" class="hidden px-5 sm:px-6 py-4 rounded-full bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 border border-gray-700 font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer">
                        <iconify-icon id="dt-global-mute-icon" icon="solar:muted-bold" width="20"></iconify-icon>
                        <span id="dt-global-mute-text">Muet</span>
                    </button>

                    <!-- Speaker Button (Haut-parleur) -->
                    <button id="dt-global-btn-speaker" type="button" class="hidden px-5 sm:px-6 py-4 rounded-full bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-400 border border-gray-700 font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer">
                        <iconify-icon id="dt-global-speaker-icon" icon="solar:volume-small-bold" width="20"></iconify-icon>
                        <span id="dt-global-speaker-text">Haut-parleur</span>
                    </button>

                    <!-- Decline / Hangup Button -->
                    <button id="dt-global-btn-hangup" type="button" class="px-7 py-4 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-red-600/30 transition-all cursor-pointer">
                        <iconify-icon icon="solar:phone-dead-bold" width="22"></iconify-icon>
                        <span>Raccrocher</span>
                    </button>
                </div>
            </div>

            <!-- 2. FLOATING PERSISTENT TOAST PILL (PiP Minimisé Draggable & Aimanté - Identique Dashboard) -->
            <div id="dt-global-call-pip" class="hidden fixed right-4 w-[280px] max-w-[92vw] h-[54px] rounded-full bg-gray-950/95 backdrop-blur-md border border-white/10 shadow-2xl text-white flex items-center justify-between px-2.5 select-none touch-none cursor-grab active:cursor-grabbing transition-transform duration-200" style="z-index: 2147483647 !important; top: max(4.75rem, calc(env(safe-area-inset-top) + 4rem)); touch-action: none !important;">
                <!-- Zone Gauche + Milieu : Cliquable pour ré-agrandir en plein écran -->
                <div id="dt-global-pip-expand-zone" class="flex items-center gap-2.5 min-w-0 flex-1 h-full pl-1 cursor-pointer">
                    <!-- Avatar miniature avec point vert direct -->
                    <div class="relative flex-shrink-0">
                        <div class="w-9 h-9 rounded-full overflow-hidden bg-gray-800 border-2 border-emerald-400/90 flex items-center justify-center text-xs font-bold text-emerald-400">
                            ${callerAvatar 
                                ? `<img src="${callerAvatar}" class="w-full h-full object-cover" alt="Avatar" />` 
                                : `<span>${initials}</span>`
                            }
                        </div>
                        <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-gray-950 animate-pulse"></span>
                    </div>

                    <!-- Nom & Statut / Timer -->
                    <div class="min-w-0 flex-1 truncate">
                        <div class="text-xs font-bold text-white truncate leading-tight">${_escapeHtml(callerName)}</div>
                        <div id="dt-global-pip-timer" class="text-[11px] font-mono font-semibold text-emerald-400 leading-tight">Appel entrant...</div>
                    </div>
                </div>

                <!-- Zone Droite : Boutons d'action compacts -->
                <div class="flex items-center gap-1.5 flex-shrink-0 pr-0.5">
                    <!-- Décrocher mini -->
                    <button id="dt-global-pip-btn-answer" type="button" class="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white flex items-center justify-center shadow transition-all cursor-pointer" title="Décrocher">
                        <iconify-icon icon="solar:phone-bold" width="16"></iconify-icon>
                    </button>
                    <!-- Muet mini -->
                    <button id="dt-global-pip-btn-mute" type="button" class="hidden w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-200 flex items-center justify-center transition-all cursor-pointer" title="Couper le micro">
                        <iconify-icon id="dt-global-pip-mute-icon" icon="solar:microphone-bold" width="16"></iconify-icon>
                    </button>
                    <!-- Haut-parleur mini -->
                    <button id="dt-global-pip-btn-speaker" type="button" class="hidden w-8 h-8 rounded-full bg-white/10 text-gray-400 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all cursor-pointer" title="Haut-parleur">
                        <iconify-icon id="dt-global-pip-speaker-icon" icon="solar:volume-small-bold" width="16"></iconify-icon>
                    </button>
                    <!-- Raccrocher mini -->
                    <button id="dt-global-pip-btn-hangup" type="button" class="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow transition-all cursor-pointer" title="Raccrocher">
                        <iconify-icon icon="solar:phone-dead-bold" width="16"></iconify-icon>
                    </button>
                </div>
            </div>
        `;

        // Masquer immédiatement les boutons natifs iOS pour que l'appel soit en premier plan absolu
        try {
            window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
            window.Capacitor?.Plugins?.NativeHeaderButtons?.hide?.().catch(() => {});
            window.Capacitor?.Plugins?.NativeHeaderButtons?.hideClose?.().catch(() => {});
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('nativeOverlayOpen'));

        document.body.appendChild(root);

        const fullEl = root.querySelector('#dt-global-call-fullscreen');
        const pipEl = root.querySelector('#dt-global-call-pip');

        _setupPipDrag(pipEl);

        // Minimiser en PiP
        root.querySelector('#dt-global-btn-minimize')?.addEventListener('click', () => {
            _setViewMode('pip');
        });

        // Agrandir en Plein Écran
        root.querySelector('#dt-global-pip-expand-zone')?.addEventListener('click', () => {
            if (!pipDrag.hasMoved) {
                _setViewMode('fullscreen');
            }
        });

        // Actions Décrocher — WebRTC in-place sans rechargement ni redirection
        let autoDismissTimer = null;

        const onAnswer = () => {
            if (autoDismissTimer) {
                clearTimeout(autoDismissTimer);
                autoDismissTimer = null;
            }
            _stopRingTone();
            _acceptCallWebRTC(data);
        };

        // Actions Raccrocher / Refuser
        const onDecline = () => {
            if (autoDismissTimer) {
                clearTimeout(autoDismissTimer);
                autoDismissTimer = null;
            }
            if (_callState === 'connected' || _callState === 'incoming') {
                _endCallWebRTC();
            } else {
                _dismissCallUI();
            }
        };

        root.querySelector('#dt-global-btn-answer')?.addEventListener('click', onAnswer);
        root.querySelector('#dt-global-pip-btn-answer')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onAnswer();
        });

        root.querySelector('#dt-global-btn-hangup')?.addEventListener('click', onDecline);
        root.querySelector('#dt-global-pip-btn-hangup')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onDecline();
        });

        root.querySelector('#dt-global-btn-mute')?.addEventListener('click', _toggleMuteWebRTC);
        root.querySelector('#dt-global-pip-btn-mute')?.addEventListener('click', (e) => {
            e.stopPropagation();
            _toggleMuteWebRTC();
        });
        root.querySelector('#dt-global-btn-speaker')?.addEventListener('click', _toggleSpeakerWebRTC);
        root.querySelector('#dt-global-pip-btn-speaker')?.addEventListener('click', (e) => {
            e.stopPropagation();
            _toggleSpeakerWebRTC();
        });

        _playRingTone();

        // Auto-dismiss après 35s si toujours en sonnerie
        autoDismissTimer = setTimeout(() => {
            if (_activeIncomingData && _callState === 'idle') {
                _dismissCallUI();
            }
        }, 35000);
    }

    function _dismissCallUI() {
        _activeIncomingData = null;
        _callState = 'idle';
        _stopCallTimer();
        const root = document.getElementById('newket-global-call-ui-root');
        if (root) root.remove();
        _stopRingTone();
        window.dispatchEvent(new CustomEvent('nativeOverlayClose'));
        try {
            window.ComponentsLoader?.syncNativeHeaderButtonsVisibility?.();
            window.ComponentsLoader?.syncNativeTabBarVisibility?.();
        } catch (_) {}
    }

    // ── WebRTC Engine (fonctionne sur toutes les pages, sans redirection) ─────

    async function _acceptCallWebRTC(data) {
        if (_callState === 'connected') return;
        _callState = 'incoming';

        const client = window.supabaseClient || (window.Supabase && window.Supabase.client);
        if (!client) {
            console.warn('[NewKet Audio] Supabase client non disponible');
            return;
        }

        // Résoudre mon rôle et mes infos depuis le localStorage / auth
        _myRole = data.role === 'vendor' ? 'customer' : 'vendor';
        try {
            const { data: { user } } = await client.auth.getUser();
            const { data: profile } = await client.from('users')
                .select('username, avatar_url')
                .eq('id', user?.id)
                .single();
            _myName = profile?.username || user?.email || 'Utilisateur';
            _myAvatar = profile?.avatar_url || '';
        } catch (_) {
            _myName = 'Utilisateur';
            _myAvatar = '';
        }

        // Transition UI vers l'état connecté (identique au dashboard)
        _switchToInCallUI();

        // Rejoindre le canal order pour les signaux WebRTC avec attente asynchrone garantie
        const orderId = data.orderId || '';
        const subscribePromise = new Promise((resolve) => {
            if (!orderId) return resolve(false);
            _orderChannel = client.channel(`order-tracking:${orderId}`);
            _orderChannel.subscribe((status) => {
                console.log('[NewKet Audio] 📡 Statut canal order-tracking:', status);
                if (status === 'SUBSCRIBED') {
                    _listenOrderSignals(data);
                    resolve(true);
                }
            });
            // Timeout de sécurité 3.5s au cas où
            setTimeout(() => resolve(false), 3500);
        });

        // Établir la connexion audio WebRTC
        try {
            _pendingIceCandidates = [];
            console.log('[NewKet Audio] 🎙️ Demande d\'autorisation micro (avec annulation d\'écho)...');
            _localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            console.log('[NewKet Audio] ✅ Micro autorisé avec succès !');
            _createPeerConn();

            _localStream.getTracks().forEach(track => {
                _peerConnection.addTrack(track, _localStream);
            });

            // Attendre la souscription confirmée au canal
            await subscribePromise;
            console.log('[NewKet Audio] 📡 Canal prêt pour échanger les signaux SDP');

            const pendingOffer = data.pendingOffer || data.offer;
            if (pendingOffer) {
                console.log('[NewKet Audio] 📥 Application de l\'offre SDP distante reçue...');
                await _peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer));

                // Flusher les candidats ICE arrivés avant le setRemoteDescription
                if (_pendingIceCandidates && _pendingIceCandidates.length > 0) {
                    console.log(`[NewKet Audio] 🧊 Traitement de ${_pendingIceCandidates.length} candidat(s) ICE en attente dans call-notifier...`);
                    for (const cand of _pendingIceCandidates) {
                        await _peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                    }
                    _pendingIceCandidates = [];
                }

                const answer = await _peerConnection.createAnswer();
                await _peerConnection.setLocalDescription(answer);
                console.log('[NewKet Audio] 📤 Envoi de la réponse answer vers l\'appelant...');
                _sendOrderSignal({ type: 'answer', answer });
                _sendOrderSignal({ type: 'call-accepted' });
                _callState = 'connected';
                _startCallTimer(0);
            } else {
                console.log('[NewKet Audio] ❓ Aucune offre distante immédiate, demande en cours (request-offer)...');
                _sendOrderSignal({ type: 'request-offer' });
                _callState = 'connected';
            }

        } catch (err) {
            console.warn('[NewKet Audio] Erreur micro:', err.message);
            _endCallWebRTC();
        }
    }

    function _createPeerConn() {
        _peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:stun.services.mozilla.com' }
            ]
        });

        _peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[NewKet Audio] 🧊 Candidat ICE généré, envoi...');
                _sendOrderSignal({ type: 'candidate', candidate: event.candidate });
            }
        };

        _peerConnection.oniceconnectionstatechange = () => {
            console.log('[NewKet Audio] 📶 Notifier Statut connexion ICE:', _peerConnection.iceConnectionState);
        };

        _peerConnection.onconnectionstatechange = () => {
            if (!_peerConnection) return;
            const state = _peerConnection.connectionState;
            console.log('[NewKet Audio] 🔗 Notifier Statut PeerConnection:', state);
            if (state === 'failed' || state === 'closed') {
                console.warn('[NewKet Audio] 🔴 Connexion WebRTC échouée/fermée, arrêt immédiat...');
                _endCallWebRTC();
            } else if (state === 'disconnected') {
                setTimeout(() => {
                    if (_peerConnection && (_peerConnection.connectionState === 'disconnected' || _peerConnection.connectionState === 'failed')) {
                        console.warn('[NewKet Audio] 🔴 Déconnexion prolongée, arrêt de l\'appel...');
                        _endCallWebRTC();
                    }
                }, 3500);
            }
        };

        _peerConnection.ontrack = (event) => {
            console.log('[NewKet Audio] 🔊 FLUX AUDIO DISTANT REÇU ! Branchement haut-parleur...');
            if (_callState === 'connected' && !_callTimerInterval) {
                _startCallTimer(0);
            }
            _remoteStream = event.streams[0];
            let audioEl = document.getElementById('nk-notifier-remote-audio');
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = 'nk-notifier-remote-audio';
                audioEl.autoplay = true;
                audioEl.setAttribute('playsinline', 'true');
                audioEl.playsInline = true;
                audioEl.muted = false; // toujours audible — pas de haut-parleur forcé sur web
                audioEl.volume = 1.0;
                document.body.appendChild(audioEl);
            }
            audioEl.srcObject = _remoteStream;
            audioEl.play().catch(e => {
                console.warn('[NewKet Audio] Lecture audio restreinte:', e?.message);
                const unlock = () => {
                    audioEl.play().catch(() => {});
                    document.removeEventListener('touchstart', unlock);
                    document.removeEventListener('click', unlock);
                };
                document.addEventListener('touchstart', unlock, { once: true });
                document.addEventListener('click', unlock, { once: true });
            });
        };
    }

    function _sendOrderSignal(payload) {
        if (!_orderChannel) return;
        _orderChannel.send({
            type: 'broadcast',
            event: 'call-signal',
            payload: {
                role: _myRole,
                callerName: _myName,
                callerAvatar: _myAvatar,
                ...payload
            }
        }).catch(err => console.warn('[NewKet Audio] Échec envoi signal:', err));
    }

    function _listenOrderSignals(data) {
        if (!_orderChannel) return;
        _orderChannel.on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
            if (!payload || payload.role === _myRole) return;

            if (payload.type === 'offer' && _peerConnection && !_peerConnection.remoteDescription) {
                try {
                    console.log('[NewKet Audio] 📥 Offre reçue suite à demande ou retard');
                    await _peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));

                    if (_pendingIceCandidates && _pendingIceCandidates.length > 0) {
                        for (const cand of _pendingIceCandidates) {
                            await _peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                        }
                        _pendingIceCandidates = [];
                    }

                    const answer = await _peerConnection.createAnswer();
                    await _peerConnection.setLocalDescription(answer);
                    console.log('[NewKet Audio] 📤 Envoi de la réponse answer');
                    _sendOrderSignal({ type: 'answer', answer });
                    _sendOrderSignal({ type: 'call-accepted' });
                } catch (e) { console.warn('[NewKet Audio] Erreur traitement offer:', e); }

            } else if (payload.type === 'candidate' && _peerConnection) {
                if (_peerConnection.remoteDescription && _peerConnection.remoteDescription.type) {
                    _peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
                } else {
                    if (!_pendingIceCandidates) _pendingIceCandidates = [];
                    _pendingIceCandidates.push(payload.candidate);
                }

            } else if (payload.type === 'answer' && _peerConnection) {
                console.log('[NewKet Audio] 🤝 Réponse answer reçue dans call-notifier !');
                try {
                    await _peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
                    if (_pendingIceCandidates && _pendingIceCandidates.length > 0) {
                        for (const cand of _pendingIceCandidates) {
                            await _peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                        }
                        _pendingIceCandidates = [];
                    }
                } catch (e) { console.warn('[NewKet Audio] Erreur setRemoteDescription answer:', e); }

                _callState = 'connected';
                _startCallTimer(0);
                _sendOrderSignal({ type: 'call-start-sync', duration: 0 });
                if (_durationSyncInterval) clearInterval(_durationSyncInterval);
                _durationSyncInterval = setInterval(() => {
                    if (_callState === 'connected') {
                        _sendOrderSignal({ type: 'call-duration-sync', duration: _callDurationSecs });
                    }
                }, 2000);

            } else if ((payload.type === 'call-duration-sync' || payload.type === 'call-start-sync') && _callState === 'connected') {
                if (typeof payload.duration === 'number') {
                    if (!_callTimerInterval) {
                        _startCallTimer(payload.duration);
                    } else if (Math.abs(_callDurationSecs - payload.duration) >= 1) {
                        _callDurationSecs = payload.duration;
                        _updateTimerDisplay();
                    }
                }

            } else if (payload.type === 'hangup') {
                console.log('[NewKet Audio] 🔴 Appel terminé par l\'interlocuteur');
                _endCallWebRTC();
            }
        });
    }

    function _switchToInCallUI() {
        // Met à jour l'interface existante (#dt-global-call-fullscreen et #dt-global-call-pip)
        const fullTitle = document.getElementById('dt-global-call-title');
        const fullSubtitle = document.getElementById('dt-global-call-subtitle');
        const btnAnswerFull = document.getElementById('dt-global-btn-answer');
        const btnMuteFull = document.getElementById('dt-global-btn-mute');

        const btnAnswerPip = document.getElementById('dt-global-pip-btn-answer');
        const btnMutePip = document.getElementById('dt-global-pip-btn-mute');
        const timerPip = document.getElementById('dt-global-pip-timer');
        const timerFull = document.getElementById('dt-global-call-timer');

        if (fullTitle) fullTitle.textContent = 'EN COMMUNICATION';
        if (fullSubtitle) fullSubtitle.textContent = 'Appel vocal actif';
        if (btnAnswerFull) btnAnswerFull.classList.add('hidden');
        if (btnMuteFull) btnMuteFull.classList.remove('hidden');

        const btnSpeakerFull = document.getElementById('dt-global-btn-speaker');
        const btnSpeakerPip = document.getElementById('dt-global-pip-btn-speaker');

        if (btnAnswerPip) btnAnswerPip.classList.add('hidden');
        if (btnMutePip) btnMutePip.classList.remove('hidden');
        if (btnSpeakerFull) btnSpeakerFull.classList.remove('hidden');
        if (btnSpeakerPip) btnSpeakerPip.classList.remove('hidden');

        if (timerPip) timerPip.textContent = '00:00';
        if (timerFull) timerFull.textContent = '00:00';

        _updateMuteUI();
        _updateSpeakerUI();
        _setViewMode('pip');
    }

    let _durationSyncInterval = null;

    function _startCallTimer(initialSecs = 0) {
        _stopCallTimer();
        _callDurationSecs = typeof initialSecs === 'number' ? initialSecs : 0;
        _updateTimerDisplay();

        _callTimerInterval = setInterval(() => {
            _callDurationSecs++;
            _updateTimerDisplay();
        }, 1000);
    }

    function _stopCallTimer() {
        if (_callTimerInterval) {
            clearInterval(_callTimerInterval);
            _callTimerInterval = null;
        }
        if (_durationSyncInterval) {
            clearInterval(_durationSyncInterval);
            _durationSyncInterval = null;
        }
    }

    function _updateTimerDisplay(customText = null) {
        let formatted = customText;
        if (!formatted) {
            const m = String(Math.floor(_callDurationSecs / 60)).padStart(2, '0');
            const s = String(_callDurationSecs % 60).padStart(2, '0');
            formatted = `${m}:${s}`;
        }
        const fullTimerEl = document.getElementById('dt-global-call-timer');
        const pipTimerEl = document.getElementById('dt-global-pip-timer');
        if (fullTimerEl) fullTimerEl.textContent = formatted;
        if (pipTimerEl) pipTimerEl.textContent = formatted;
    }

    function _updateMuteUI() {
        const fullMuteBtn = document.getElementById('dt-global-btn-mute');
        const fullMuteText = document.getElementById('dt-global-mute-text');
        const pipMuteBtn = document.getElementById('dt-global-pip-btn-mute');
        const pipMuteIcon = document.getElementById('dt-global-pip-mute-icon');

        if (fullMuteBtn) {
            fullMuteBtn.classList.toggle('bg-red-600/80', _isMuted);
            fullMuteBtn.classList.toggle('border-red-500', _isMuted);
            fullMuteBtn.classList.toggle('bg-gray-800', !_isMuted);
        }
        if (fullMuteText) {
            fullMuteText.textContent = _isMuted ? 'Micro Coupé' : 'Muet';
        }

        if (pipMuteBtn) {
            pipMuteBtn.classList.toggle('bg-red-600', _isMuted);
            pipMuteBtn.classList.toggle('text-white', _isMuted);
            pipMuteBtn.classList.toggle('bg-white/10', !_isMuted);
            pipMuteBtn.classList.toggle('text-gray-200', !_isMuted);
        }
        if (pipMuteIcon) {
            pipMuteIcon.setAttribute('icon', _isMuted ? 'solar:muted-bold' : 'solar:microphone-bold');
        }
    }

    function _toggleMuteWebRTC() {
        if (!_localStream) return;
        const track = _localStream.getAudioTracks()[0];
        if (!track) return;
        _isMuted = !_isMuted;
        track.enabled = !_isMuted;
        _updateMuteUI();
    }

    function _toggleSpeakerWebRTC() {
        _isSpeakerOn = !_isSpeakerOn;
        const audioEl = document.getElementById('nk-notifier-remote-audio');
        if (audioEl) {
            // Audio joue toujours — le haut-parleur contrôle uniquement l'acheminement physique sur natif
            audioEl.muted = false;
            audioEl.volume = 1.0;
        }
        try {
            if (window.Capacitor?.Plugins?.NativeAudioRouter?.setSpeaker) {
                window.Capacitor.Plugins.NativeAudioRouter.setSpeaker({ enabled: _isSpeakerOn });
            }
        } catch (_) {}
        _updateSpeakerUI();
    }

    function _updateSpeakerUI() {
        const isSpeaker = _isSpeakerOn === true; // false par défaut

        const btnSpeakerFull = document.getElementById('dt-global-btn-speaker');
        const speakerIconFull = document.getElementById('dt-global-speaker-icon');
        const speakerTextFull = document.getElementById('dt-global-speaker-text');
        const btnSpeakerPip = document.getElementById('dt-global-pip-btn-speaker');
        const speakerIconPip = document.getElementById('dt-global-pip-speaker-icon');

        if (btnSpeakerFull) {
            btnSpeakerFull.classList.toggle('bg-emerald-500/20', isSpeaker);
            btnSpeakerFull.classList.toggle('border-emerald-500/40', isSpeaker);
            btnSpeakerFull.classList.toggle('text-emerald-400', isSpeaker);
            btnSpeakerFull.classList.toggle('bg-gray-800', !isSpeaker);
            btnSpeakerFull.classList.toggle('border-gray-700', !isSpeaker);
            btnSpeakerFull.classList.toggle('text-gray-400', !isSpeaker);
        }
        if (speakerIconFull) {
            speakerIconFull.setAttribute('icon', isSpeaker ? 'solar:volume-loud-bold' : 'solar:volume-small-bold');
        }
        if (speakerTextFull) {
            speakerTextFull.textContent = 'Haut-parleur';
        }
        if (btnSpeakerPip) {
            btnSpeakerPip.classList.toggle('bg-emerald-500/20', isSpeaker);
            btnSpeakerPip.classList.toggle('text-emerald-400', isSpeaker);
            btnSpeakerPip.classList.toggle('bg-white/10', !isSpeaker);
            btnSpeakerPip.classList.toggle('text-gray-400', !isSpeaker);
        }
        if (speakerIconPip) {
            speakerIconPip.setAttribute('icon', isSpeaker ? 'solar:volume-loud-bold' : 'solar:volume-small-bold');
        }
    }

    function _endCallWebRTC() {
        _pendingIceCandidates = [];
        _sendOrderSignal({ type: 'hangup' });
        _stopCallTimer();

        if (_peerConnection) {
            try { _peerConnection.close(); } catch (_) {}
            _peerConnection = null;
        }
        if (_localStream) {
            _localStream.getTracks().forEach(t => t.stop());
            _localStream = null;
        }
        const audioEl = document.getElementById('nk-notifier-remote-audio');
        if (audioEl) {
            try { audioEl.pause(); audioEl.srcObject = null; } catch (_) {}
            audioEl.remove();
        }

        if (_orderChannel) {
            try {
                const client = window.supabaseClient || window.Supabase?.client;
                client?.removeChannel(_orderChannel);
            } catch (_) {}
            _orderChannel = null;
        }

        _callState = 'idle';
        _isMuted = false;
        _isSpeakerOn = false; // Reset haut-parleur OFF pour le prochain appel
        _dismissCallUI();
    }

    // ── Toast In-App pour messages de chat et vocaux ─────────────────────────
    let _activeChatToast = null;
    let _chatToastTimeout = null;

    function _playChatDingSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
            setTimeout(() => { try { ctx.close(); } catch (_) {} }, 500);
        } catch (_) {}
    }

    function _dismissChatMessageToast() {
        if (_chatToastTimeout) {
            clearTimeout(_chatToastTimeout);
            _chatToastTimeout = null;
        }
        if (_activeChatToast) {
            _activeChatToast.classList.add('opacity-0', '-translate-y-4');
            const el = _activeChatToast;
            setTimeout(() => {
                try { el.remove(); } catch (_) {}
                // Rétablir les boutons natifs d'en-tête si aucun appel plein écran n'est ouvert
                const isCallFull = (document.getElementById('dt-call-fullscreen') && !document.getElementById('dt-call-fullscreen').classList.contains('hidden')) ||
                                   (document.getElementById('dt-global-call-fullscreen') && !document.getElementById('dt-global-call-fullscreen').classList.contains('hidden'));
                if (!isCallFull) {
                    try {
                        window.ComponentsLoader?.syncNativeHeaderButtonsVisibility?.();
                    } catch (_) {}
                }
            }, 300);
            _activeChatToast = null;
        }
    }

    function _showChatMessageToast(payload) {
        _dismissChatMessageToast();

        // Masquer temporairement les boutons d'en-tête natifs iOS pour laisser flotter le toast sans chevauchement
        try {
            window.Capacitor?.Plugins?.NativeHeaderButtons?.hide?.().catch(() => {});
            window.Capacitor?.Plugins?.NativeHeaderButtons?.hideClose?.().catch(() => {});
        } catch (_) {}

        const senderName = payload.senderName || (payload.role === 'vendor' ? 'Vendeur' : 'Client');
        const senderAvatar = payload.senderAvatar || '';
        const orderId = payload.orderId || '';
        const isAudio = payload.messageType === 'audio';
        const preview = isAudio 
            ? `🎙️ Message vocal (${payload.duration || '0:18'})` 
            : (_escapeHtml(payload.text || 'Nouveau message'));

        const initials = (senderName.charAt(0) || 'U').toUpperCase();

        const toast = document.createElement('div');
        toast.id = 'dt-chat-toast-pill';
        toast.className = 'fixed left-1/2 -translate-x-1/2 w-[340px] max-w-[92vw] min-h-[58px] rounded-full bg-gray-950/80 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/50 text-white flex items-center justify-between px-3.5 py-2 select-none cursor-pointer transform -translate-y-4 opacity-0 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]';
        toast.style.cssText = 'z-index: 2147483647 !important; isolation: isolate; top: max(1.25rem, calc(env(safe-area-inset-top) + 0.5rem));';

        toast.innerHTML = `
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- Avatar miniature -->
                <div class="relative flex-shrink-0">
                    <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border-2 border-emerald-400/90 flex items-center justify-center text-xs font-bold text-emerald-400 shadow-sm">
                        ${senderAvatar 
                            ? `<img src="${senderAvatar}" class="w-full h-full object-cover" alt="Avatar" />` 
                            : `<span>${initials}</span>`
                        }
                    </div>
                    <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-gray-950"></span>
                </div>

                <!-- Text & Message Preview -->
                <div class="min-w-0 flex-1 pr-1.5">
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-xs font-bold text-white truncate leading-tight">${_escapeHtml(senderName)}</span>
                        <span class="text-[10px] text-emerald-400 font-medium shrink-0">À l'instant</span>
                    </div>
                    <div class="text-[11px] ${isAudio ? 'text-emerald-400 font-semibold' : 'text-gray-300'} truncate leading-tight mt-0.5">
                        ${preview}
                    </div>
                </div>
            </div>

            <!-- Bouton de fermeture discret -->
            <button id="dt-chat-toast-close" type="button" class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ml-1" title="Fermer">
                <iconify-icon icon="solar:close-circle-bold" width="16"></iconify-icon>
            </button>
        `;

        // Click sur la capsule -> ouvrir le chat approprié (Vendeur vs Client)
        toast.addEventListener('click', () => {
            _dismissChatMessageToast();
            if (!orderId) return;

            // Détecter si l'utilisateur est sur ou appartient à l'espace vendeur
            const isVendorContext = 
                payload.role === 'customer' || // Si l'émetteur est le client, le récepteur est le vendeur !
                window.location.pathname.includes('vendor-dashboard') ||
                localStorage.getItem('nk_user_role') === 'vendor' ||
                localStorage.getItem('nk_user_role') === 'supplier';

            try {
                localStorage.setItem('nk_auto_open_order_id', orderId);
                localStorage.setItem('nk_auto_open_chat', '1');
            } catch (_) {}

            if (isVendorContext) {
                if (window.location.pathname.includes('vendor-dashboard')) {
                    const openFn = window.openOrderDetailModal || window.openOrderModal;
                    if (typeof openFn === 'function') {
                        openFn(orderId);
                        return;
                    }
                    window.location.hash = `orders?order_id=${encodeURIComponent(orderId)}&open_chat=1`;
                    window.location.reload();
                    return;
                }
                window.location.href = `/vendor-dashboard#orders?order_id=${encodeURIComponent(orderId)}&open_chat=1`;
            } else {
                if (window.location.pathname.includes('customer-dashboard')) {
                    const openFn = window.openOrderModal || window.goToAchatOrder;
                    if (typeof openFn === 'function') {
                        openFn(orderId);
                        return;
                    }
                    window.location.hash = `purchases?order_id=${encodeURIComponent(orderId)}&open_chat=1`;
                    window.location.reload();
                    return;
                }
                window.location.href = `/customer-dashboard#purchases?order_id=${encodeURIComponent(orderId)}&open_chat=1`;
            }
        });

        // Click sur le bouton fermer -> stopper propagation
        const closeBtn = toast.querySelector('#dt-chat-toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _dismissChatMessageToast();
            });
        }

        document.body.appendChild(toast);
        _activeChatToast = toast;

        // Animation d'apparition
        requestAnimationFrame(() => {
            toast.classList.remove('-translate-y-4', 'opacity-0');
        });

        // Son ding discret
        _playChatDingSound();

        // Auto-dismiss 4 secondes
        _chatToastTimeout = setTimeout(() => {
            _dismissChatMessageToast();
        }, 4000);
    }

    // ── Connexion temps réel Supabase ────────────────────────────────────────
    function _init() {
        let _channelSubscribed = false;

        const connectUserRing = (client, userId) => {
            if (_channelSubscribed || !userId || !client) return;
            _channelSubscribed = true;

            const channelName = `user-ring:${userId}`;
            const ringChannel = client.channel(channelName);

            ringChannel
                .on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
                    console.log('[NewKet CallNotifier] incoming-call reçu sur', channelName, payload);

                    // Si l'utilisateur est DÉJÀ en cours d'appel (calling, incoming ou connected), IGNORER le heartbeat de sonnerie !
                    if (_callState !== 'idle') {
                        console.log('[NewKet CallNotifier] incoming-call ignoré (appel déjà en cours, état:', _callState, ')');
                        return;
                    }
                    if (window.deliveryTrackerInstance && window.deliveryTrackerInstance.callState && window.deliveryTrackerInstance.callState !== 'idle') {
                        console.log('[NewKet CallNotifier] incoming-call ignoré (deliveryTracker déjà actif)');
                        return;
                    }

                    // Si on est sur le dashboard et qu'une instance deliveryTracker est déjà active sur cette commande
                    const isTracked = isOnDashboard && window.deliveryTrackerInstance && window.deliveryTrackerInstance.orderId === payload?.orderId;
                    if (isTracked) return;

                    _buildDashboardStyleCallUI(payload || {});
                })
                .on('broadcast', { event: 'cancel-call' }, () => {
                    console.log('[NewKet CallNotifier] cancel-call reçu');
                    _dismissCallUI();
                })
                .on('broadcast', { event: 'incoming-message' }, ({ payload }) => {
                    if (!payload) return;
                    console.log('[NewKet CallNotifier] incoming-message reçu sur', channelName, payload);

                    // Si le chat pour cette commande est déjà ouvert et visible à l'écran, pas de toast
                    const tracker = window.deliveryTrackerInstance;
                    const chatEl = document.getElementById('dt-chat-messages');
                    const isChatVisible = tracker && tracker.orderId === payload.orderId && chatEl && (chatEl.offsetParent !== null || chatEl.offsetHeight > 0);
                    if (isChatVisible) {
                        return;
                    }

                    _showChatMessageToast(payload);
                })
                .subscribe((status) => {
                    console.log('[NewKet CallNotifier] Subscription status:', status, channelName);
                });

            window.addEventListener('pagehide', () => {
                try { client.removeChannel(ringChannel); } catch (_) {}
            });
        };

        const trySubscribe = async () => {
            const client = window.supabaseClient || (window.Supabase && window.Supabase.client);
            if (!client) return false;

            // 1. Récupération synchrone immédiate depuis localStorage
            let userId = localStorage.getItem('newketUserId');
            if (userId) {
                connectUserRing(client, userId);
                return true;
            }

            // 2. Récupération asynchrone depuis la session Supabase
            try {
                const { data } = await client.auth.getSession();
                userId = data?.session?.user?.id;
                if (userId) {
                    connectUserRing(client, userId);
                    return true;
                }
            } catch (_) {}

            return false;
        };

        let attempts = 0;
        const pollTimer = setInterval(async () => {
            attempts++;
            const connected = await trySubscribe();
            if (connected || attempts >= 40) {
                clearInterval(pollTimer);
            }
        }, 200);

        try {
            const client = window.supabaseClient || (window.Supabase && window.Supabase.client);
            if (client?.auth?.onAuthStateChange) {
                client.auth.onAuthStateChange((event, session) => {
                    const uId = session?.user?.id;
                    if (uId) connectUserRing(client, uId);
                });
            }
        } catch (_) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }
})();

// Détection de fermeture ou rechargement de page pour clore l'appel instantanément chez l'interlocuteur
if (typeof window !== 'undefined' && !window.__nk_cn_unload_wired) {
    window.__nk_cn_unload_wired = true;
    const notifyHangupOnUnload = () => {
        try {
            if (_callState !== 'idle' && _orderChannel) {
                _sendOrderSignal({ type: 'hangup', reason: 'page_closed' });
                _endCallWebRTC();
            }
        } catch (_) {}
    };
    window.addEventListener('beforeunload', notifyHangupOnUnload);
    window.addEventListener('pagehide', notifyHangupOnUnload);
}

// ── Garde-fou Anti-Coupure d'Appel (Blocage de navigation externe & Toast Premier Plan) ──
(function setupCallNavigationGuard() {
    let _activeBlockingToast = null;
    let _blockingToastTimeout = null;

    function _dismissCallBlockingToast() {
        if (_blockingToastTimeout) {
            clearTimeout(_blockingToastTimeout);
            _blockingToastTimeout = null;
        }
        if (_activeBlockingToast) {
            _activeBlockingToast.classList.add('opacity-0', '-translate-y-4');
            const el = _activeBlockingToast;
            setTimeout(() => {
                try { el.remove(); } catch (_) {}
                const isCallFull = (document.getElementById('dt-call-fullscreen') && !document.getElementById('dt-call-fullscreen').classList.contains('hidden')) ||
                                   (document.getElementById('dt-global-call-fullscreen') && !document.getElementById('dt-global-call-fullscreen').classList.contains('hidden'));
                if (!isCallFull) {
                    try {
                        window.dispatchEvent(new CustomEvent('nativeOverlayClose'));
                        window.ComponentsLoader?.syncNativeHeaderButtonsVisibility?.();
                        window.ComponentsLoader?.syncNativeTabBarVisibility?.();
                    } catch (_) {}
                }
            }, 300);
            _activeBlockingToast = null;
        }
    }

    function _showCallBlockingToast() {
        _dismissCallBlockingToast();

        // 1. Masquer immédiatement les boutons Liquid Glass natifs iOS pour passer AU-DESSUS de tout
        try {
            window.Capacitor?.Plugins?.NativeHeaderButtons?.hide?.().catch(() => {});
            window.Capacitor?.Plugins?.NativeHeaderButtons?.hideClose?.().catch(() => {});
            window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('nativeOverlayOpen'));

        // 2. Feedback haptique d'avertissement Taptic Engine
        try {
            window.Capacitor?.Plugins?.Haptics?.notification?.({ type: 'WARNING' })?.catch(() => {});
        } catch (_) {}

        // 3. Construction du Toast au premier plan absolu (z-index maximal 2147483647)
        const toast = document.createElement('div');
        toast.id = 'nk-call-blocking-toast';
        toast.className = 'fixed left-1/2 -translate-x-1/2 w-[92vw] max-w-[420px] rounded-3xl bg-gray-950/95 backdrop-blur-2xl border-2 border-red-500/60 shadow-2xl shadow-red-950/80 text-white p-3.5 flex items-center justify-between gap-3 select-none transform -translate-y-4 opacity-0 transition-all duration-300';
        toast.style.cssText = 'z-index: 2147483647 !important; isolation: isolate; top: max(1.25rem, calc(env(safe-area-inset-top) + 0.75rem)); pointer-events: auto;';

        toast.innerHTML = `
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- Icône d'interdiction pulsante -->
                <div class="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <iconify-icon icon="solar:phone-dead-bold" width="22"></iconify-icon>
                </div>

                <!-- Texte d'avertissement -->
                <div class="min-w-0 flex-1">
                    <div class="text-xs font-black tracking-wide uppercase text-red-400 leading-tight">
                        Appel en cours
                    </div>
                    <div class="text-[12px] font-semibold text-gray-200 leading-tight mt-0.5">
                        Raccrochez pour quitter cette page.
                    </div>
                </div>
            </div>

            <!-- Bouton Raccrocher direct -->
            <button id="nk-btn-toast-hangup" type="button" class="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all cursor-pointer flex-shrink-0">
                <iconify-icon icon="solar:phone-dead-bold" width="16"></iconify-icon>
                <span>Raccrocher</span>
            </button>
        `;

        // Action bouton Raccrocher direct depuis le toast
        toast.querySelector('#nk-btn-toast-hangup')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.deliveryTrackerInstance && window.deliveryTrackerInstance.callState !== 'idle') {
                window.deliveryTrackerInstance.endCall();
            }
            const btnHangupGlobal = document.getElementById('dt-global-btn-hangup') || document.getElementById('dt-global-pip-btn-hangup');
            if (btnHangupGlobal) btnHangupGlobal.click();

            _dismissCallBlockingToast();
        });

        document.body.appendChild(toast);
        _activeBlockingToast = toast;

        // Animation d'apparition
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', '-translate-y-4');
            toast.classList.add('opacity-100', 'translate-y-0');
        });

        // Auto-dismiss après 3.8s
        _blockingToastTimeout = setTimeout(() => {
            _dismissCallBlockingToast();
        }, 3800);
    }

    window.showCallBlockingToast = _showCallBlockingToast;

    function _isCallActive() {
        if (window.deliveryTrackerInstance && window.deliveryTrackerInstance.callState && window.deliveryTrackerInstance.callState !== 'idle') {
            return true;
        }
        const fullEl = document.getElementById('dt-call-fullscreen');
        const pipEl = document.getElementById('dt-call-pip');
        if (fullEl && !fullEl.classList.contains('hidden')) return true;
        if (pipEl && !pipEl.classList.contains('hidden')) return true;

        const gFull = document.getElementById('dt-global-call-fullscreen');
        const gPip = document.getElementById('dt-global-call-pip');
        if (gFull && !gFull.classList.contains('hidden')) return true;
        if (gPip && !gPip.classList.contains('hidden')) return true;

        return false;
    }

    if (typeof window !== 'undefined' && !window.__nk_call_nav_guard_wired) {
        window.__nk_call_nav_guard_wired = true;

        document.addEventListener('click', (e) => {
            if (!_isCallActive()) return;

            // Détecter si le clic cible un élément menant à une autre page
            const anchor = e.target.closest('a[href], button[data-navigate], [data-href]');
            if (!anchor) return;

            // Ignorer les contrôles d'appel eux-mêmes !
            if (anchor.closest('#newket-call-ui-root') || anchor.closest('#newket-global-call-ui-root') || anchor.closest('#nk-call-blocking-toast')) {
                return;
            }

            const href = anchor.getAttribute('href') || anchor.getAttribute('data-href');
            if (!href) return;

            // Exceptions autorisées : ancres sur la même page (#leads, #dashboard, modales, javascript, tel, mailto)
            if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:')) {
                return;
            }

            // Vérifier si le lien pointe vers la même page courante (ex: query params ou hash)
            try {
                const targetUrl = new URL(href, window.location.origin);
                if (targetUrl.pathname === window.location.pathname) {
                    return; // Même page : navigation autorisée !
                }
            } catch (_) {}

            // Navigation externe détectée : BLOQUER ABSOLUMENT !
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Déclencher le toast au premier plan absolu
            _showCallBlockingToast();
        }, true); // true = capture phase pour intercepter avant tout autre routeur ou listener
    }
})();

