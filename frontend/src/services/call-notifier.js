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
                    <h4 class="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-1">APPEL ENTRANT...</h4>
                    <p class="text-xs text-gray-400 mb-3">${_escapeHtml(subtitleText)}</p>

                    <div class="px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-sm font-bold border border-emerald-500/20">
                        Sonnerie...
                    </div>
                </div>

                <!-- Bottom Bar: Commandes Décrocher / Raccrocher -->
                <div class="flex items-center justify-center gap-6 pb-6 w-full max-w-md mx-auto">
                    <!-- Answer Button -->
                    <button id="dt-global-btn-answer" type="button" class="px-7 py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-emerald-500/30 transition-all cursor-pointer">
                        <iconify-icon icon="solar:phone-bold" width="22"></iconify-icon>
                        <span>Décrocher</span>
                    </button>

                    <!-- Decline Button -->
                    <button id="dt-global-btn-hangup" type="button" class="px-7 py-4 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-red-600/30 transition-all cursor-pointer">
                        <iconify-icon icon="solar:phone-dead-bold" width="22"></iconify-icon>
                        <span>Raccrocher</span>
                    </button>
                </div>
            </div>

            <!-- 2. FLOATING PERSISTENT TOAST PILL (PiP Minimisé Draggable & Aimanté) -->
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

                    <!-- Nom & Statut -->
                    <div class="min-w-0 flex-1 truncate">
                        <div class="text-xs font-bold text-white truncate leading-tight">${_escapeHtml(callerName)}</div>
                        <div class="text-[11px] font-mono font-semibold text-emerald-400 leading-tight">Appel entrant...</div>
                    </div>
                </div>

                <!-- Zone Droite : Boutons d'action compacts -->
                <div class="flex items-center gap-1.5 flex-shrink-0 pr-0.5">
                    <button id="dt-global-pip-btn-answer" type="button" class="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white flex items-center justify-center shadow transition-all cursor-pointer" title="Décrocher">
                        <iconify-icon icon="solar:phone-bold" width="16"></iconify-icon>
                    </button>
                    <button id="dt-global-pip-btn-hangup" type="button" class="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow transition-all cursor-pointer" title="Refuser">
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

        // Destination : si l'appelant est 'vendor', je suis le client → customer-dashboard, et inversement
        const targetDashboard = data.role === 'vendor'
            ? '/customer-dashboard'
            : '/vendor-dashboard';
        const targetUrl = orderId
            ? `${targetDashboard}?order=${encodeURIComponent(orderId)}`
            : targetDashboard;

        // Actions Décrocher
        // call-notifier ne tourne JAMAIS sur le dashboard (guard ligne 12)
        // → tout utilisateur qui décroche ici EST hors-dashboard → rediriger vers son dashboard pour WebRTC
        const onAnswer = () => {
            // 1. Afficher un toast de feedback immédiat
            _showAnswerToast();
            // 2. Fermer l'overlay
            _dismissCallUI();
            // 3. Rediriger vers le dashboard après 600ms (le toast reste visible)
            setTimeout(() => { window.location.href = targetUrl; }, 600);
        };

        // Actions Refuser
        const onDecline = () => {
            _dismissCallUI();
        };

        root.querySelector('#dt-global-btn-answer')?.addEventListener('click', onAnswer);
        root.querySelector('#dt-global-pip-btn-answer')?.addEventListener('click', onAnswer);

        root.querySelector('#dt-global-btn-hangup')?.addEventListener('click', onDecline);
        root.querySelector('#dt-global-pip-btn-hangup')?.addEventListener('click', onDecline);

        _playRingTone();

        // Auto-dismiss après 35s
        setTimeout(() => {
            if (_activeIncomingData) {
                _dismissCallUI();
            }
        }, 35000);
    }

    function _dismissCallUI() {
        _activeIncomingData = null;
        const root = document.getElementById('newket-global-call-ui-root');
        if (root) root.remove();
        _stopRingTone();
    }

    function _showAnswerToast() {
        const existing = document.getElementById('nk-answer-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'nk-answer-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 32px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            background: #10b981;
            color: #fff;
            padding: 14px 24px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 600;
            font-family: system-ui, sans-serif;
            box-shadow: 0 8px 32px rgba(16,185,129,0.4);
            display: flex;
            align-items: center;
            gap: 10px;
            white-space: nowrap;
            animation: nkToastIn 0.25s ease;
        `;
        toast.innerHTML = `
            <span style="font-size:20px">📞</span>
            <span>Appel décroché · Connexion en cours...</span>
        `;

        // Inject animation keyframe once
        if (!document.getElementById('nk-toast-style')) {
            const style = document.createElement('style');
            style.id = 'nk-toast-style';
            style.textContent = `@keyframes nkToastIn { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        // Le toast disparaît après 2.5s (la redirection a lieu à 600ms)
        setTimeout(() => toast.remove(), 2500);
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
