/**
 * call-notifier.js - Interface d'appel vocal identique au dashboard sur toutes les pages
 * Affiche l'overlay d'appel plein écran & pilule PiP avec le même design, animations et icônes que sur le dashboard.
 */

(function initCallNotifier() {
    'use strict';

    const currentPath = window.location.pathname;
    // Sur les dashboards, delivery-tracking.js gère déjà nativement l'appel WebRTC
    const isOnDashboard = currentPath.includes('customer-dashboard') || currentPath.includes('vendor-dashboard');
    if (isOnDashboard) return;

    let _ringCtx = null;
    let _ringInterval = null;
    let _currentViewMode = 'fullscreen'; // 'fullscreen' | 'pip'
    let _activeIncomingData = null;

    // ── WebRTC state (géré directement ici, sans delivery-tracking.js) ────────
    let _peerConnection = null;
    let _localStream = null;
    let _remoteStream = null;
    let _orderChannel = null;      // Canal Supabase order pour les signaux WebRTC
    let _callState = 'idle';       // 'idle' | 'incoming' | 'connected'
    let _callTimerInterval = null;
    let _callDurationSecs = 0;
    let _isMuted = false;
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
        } else {
            pipEl.classList.add('hidden');
            fullEl.classList.remove('hidden');
        }
    }

    // ── Drag & Snap pour la pilule PiP ───────────────────────────────────────
    function _setupPipDrag(pipEl) {
        if (!pipEl) return;

        const onPointerDown = (e) => {
            if (e.target.closest('button')) return;
            pipDrag.isDragging = true;
            pipDrag.hasMoved = false;
            pipDrag.startX = e.clientX;
            pipDrag.startY = e.clientY;

            const rect = pipEl.getBoundingClientRect();
            pipDrag.initialLeft = rect.left;
            pipDrag.initialTop = rect.top;

            pipEl.style.transition = 'none';
            pipEl.setPointerCapture?.(e.pointerId);
        };

        const onPointerMove = (e) => {
            if (!pipDrag.isDragging) return;
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
            pipEl.releasePointerCapture?.(e.pointerId);

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

        pipEl.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    // ── Construction de l'interface identique au Dashboard ──────────────────
    function _buildDashboardStyleCallUI(data) {
        let root = document.getElementById('newket-global-call-ui-root');
        if (root) root.remove();

        _activeIncomingData = data;

        const callerName = data.callerName || (data.role === 'vendor' ? 'Vendeur' : 'Client');
        const callerAvatar = data.callerAvatar || '';
        const orderId = data.orderId || '';

        const subtitleText = `Le ${data.role === 'vendor' ? 'vendeur' : 'client'} souhaite vous parler`;
        const initials = callerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'NK';

        root = document.createElement('div');
        root.id = 'newket-global-call-ui-root';
        root.innerHTML = `
            <!-- 1. FULLSCREEN CALL OVERLAY (Identique à delivery-tracking.js) -->
            <div id="dt-global-call-fullscreen" class="fixed inset-0 bg-gray-950/95 backdrop-blur-xl z-[99999] flex flex-col justify-between p-6 sm:p-8 text-white select-none transition-opacity duration-200">
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
                    <button id="dt-global-btn-mute" type="button" class="hidden px-6 py-4 rounded-full bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 border border-gray-700 font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer">
                        <iconify-icon id="dt-global-mute-icon" icon="solar:muted-bold" width="20"></iconify-icon>
                        <span id="dt-global-mute-text">Muet</span>
                    </button>

                    <!-- Decline / Hangup Button -->
                    <button id="dt-global-btn-hangup" type="button" class="px-7 py-4 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-red-600/30 transition-all cursor-pointer">
                        <iconify-icon icon="solar:phone-dead-bold" width="22"></iconify-icon>
                        <span>Raccrocher</span>
                    </button>
                </div>
            </div>

            <!-- 2. FLOATING PERSISTENT TOAST PILL (PiP Minimisé Draggable & Aimanté - Identique Dashboard) -->
            <div id="dt-global-call-pip" class="hidden fixed z-[99999] top-5 right-4 w-[280px] max-w-[92vw] h-[54px] rounded-full bg-gray-950/95 backdrop-blur-md border border-white/10 shadow-2xl text-white flex items-center justify-between px-2.5 select-none cursor-grab active:cursor-grabbing transition-transform duration-200">
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
                    <!-- Raccrocher mini -->
                    <button id="dt-global-pip-btn-hangup" type="button" class="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow transition-all cursor-pointer" title="Raccrocher">
                        <iconify-icon icon="solar:phone-dead-bold" width="16"></iconify-icon>
                    </button>
                </div>
            </div>
        `;

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
        const root = document.getElementById('newket-global-call-ui-root');
        if (root) root.remove();
        _stopRingTone();
    }

    // ── WebRTC Engine (fonctionne sur toutes les pages, sans redirection) ─────

    async function _acceptCallWebRTC(data) {
        if (_callState === 'connected') return;
        _callState = 'incoming';

        const client = window.supabaseClient || (window.Supabase && window.Supabase.client);
        if (!client) {
            console.warn('[CallNotifier] Supabase client non disponible');
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

        // Rejoindre le canal order pour les signaux WebRTC
        const orderId = data.orderId || '';
        if (orderId) {
            _orderChannel = client.channel(`order-tracking:${orderId}`);
            _orderChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    _listenOrderSignals(data);
                }
            });
        } else {
            _listenOrderSignals(data);
        }

        // Établir la connexion audio WebRTC
        try {
            _localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            _createPeerConn();

            _localStream.getTracks().forEach(track => {
                _peerConnection.addTrack(track, _localStream);
            });

            if (data.pendingOffer) {
                await _peerConnection.setRemoteDescription(new RTCSessionDescription(data.pendingOffer));
                const answer = await _peerConnection.createAnswer();
                await _peerConnection.setLocalDescription(answer);
                _sendOrderSignal({ type: 'answer', answer });
                _callState = 'connected';
            } else {
                _callState = 'connected';
            }

        } catch (err) {
            console.warn('[CallNotifier] Erreur micro:', err.message);
            _endCallWebRTC();
        }
    }

    function _createPeerConn() {
        _peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        _peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                _sendOrderSignal({ type: 'candidate', candidate: event.candidate });
            }
        };

        _peerConnection.ontrack = (event) => {
            _remoteStream = event.streams[0];
            let audioEl = document.getElementById('nk-notifier-remote-audio');
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = 'nk-notifier-remote-audio';
                audioEl.autoplay = true;
                document.body.appendChild(audioEl);
            }
            audioEl.srcObject = _remoteStream;
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
        }).catch(err => console.warn('[CallNotifier] signal send error:', err));
    }

    function _listenOrderSignals(data) {
        if (!_orderChannel) return;
        _orderChannel.on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
            if (!payload || payload.role === _myRole) return;

            if (payload.type === 'offer' && _peerConnection && !_peerConnection.remoteDescription) {
                try {
                    await _peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
                    const answer = await _peerConnection.createAnswer();
                    await _peerConnection.setLocalDescription(answer);
                    _sendOrderSignal({ type: 'answer', answer });
                } catch (e) { console.warn('[CallNotifier] offer handling error:', e); }

            } else if (payload.type === 'candidate' && _peerConnection) {
                _peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});

            } else if (payload.type === 'answer' && _peerConnection) {
                _peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer)).catch(() => {});

            } else if (payload.type === 'hangup') {
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

        if (btnAnswerPip) btnAnswerPip.classList.add('hidden');
        if (btnMutePip) btnMutePip.classList.remove('hidden');

        if (timerPip) timerPip.textContent = '00:00';
        if (timerFull) timerFull.textContent = '00:00';

        _startCallTimer();
        _updateMuteUI();
        _setViewMode('pip');
    }

    function _startCallTimer() {
        _stopCallTimer();
        _callDurationSecs = 0;
        _callTimerInterval = setInterval(() => {
            _callDurationSecs++;
            const m = String(Math.floor(_callDurationSecs / 60)).padStart(2, '0');
            const s = String(_callDurationSecs % 60).padStart(2, '0');
            const formatted = `${m}:${s}`;
            const fullTimerEl = document.getElementById('dt-global-call-timer');
            const pipTimerEl = document.getElementById('dt-global-pip-timer');
            if (fullTimerEl) fullTimerEl.textContent = formatted;
            if (pipTimerEl) pipTimerEl.textContent = formatted;
        }, 1000);
    }

    function _stopCallTimer() {
        if (_callTimerInterval) {
            clearInterval(_callTimerInterval);
            _callTimerInterval = null;
        }
        _callDurationSecs = 0;
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

    function _endCallWebRTC() {
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
        if (audioEl) audioEl.remove();

        if (_orderChannel) {
            try {
                const client = window.supabaseClient || window.Supabase?.client;
                client?.removeChannel(_orderChannel);
            } catch (_) {}
            _orderChannel = null;
        }

        _callState = 'idle';
        _isMuted = false;
        _dismissCallUI();
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
                    _buildDashboardStyleCallUI(payload || {});
                })
                .on('broadcast', { event: 'cancel-call' }, () => {
                    console.log('[NewKet CallNotifier] cancel-call reçu');
                    _dismissCallUI();
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
