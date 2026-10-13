/**
 * call-notifier.js - Notificateur d'appel entrant universel (toutes les pages)
 * Permet à un utilisateur (client ou vendeur) de recevoir un toast d'appel entrant
 * avec sonnerie et boutons Décrocher / Refuser, même s'il est sur l'accueil, le catalogue, etc.
 */

(function initCallNotifier() {
    'use strict';

    const TOAST_ID = 'nk-incoming-call-toast';
    const PILL_ID = 'nk-global-call-pill';
    const DASH_PAGES = ['customer-dashboard.html', 'vendor-dashboard.html'];
    const currentPath = window.location.pathname;
    const isOnDashboard = DASH_PAGES.some(p => currentPath.endsWith(p));

    let _ringCtx = null;
    let _ringInterval = null;

    // ── 1. Injection des styles CSS ──────────────────────────────────────────
    function _injectStyles() {
        if (document.getElementById('nk-call-notif-style')) return;
        const s = document.createElement('style');
        s.id = 'nk-call-notif-style';
        s.textContent = `
            @keyframes nk-toast-in {
                from { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0.94); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
            @keyframes nk-toast-out {
                from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                to   { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.94); }
            }
            @keyframes nk-ring-pulse {
                0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
                70%  { transform: scale(1.05); box-shadow: 0 0 0 14px rgba(34, 197, 94, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
            }
            @keyframes nk-bell-wiggle {
                0%, 100% { transform: rotate(0); }
                20% { transform: rotate(-14deg); }
                40% { transform: rotate(14deg); }
                60% { transform: rotate(-10deg); }
                80% { transform: rotate(10deg); }
            }
            @keyframes nk-glow-dot {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.85); }
            }
            .nk-toast-bounce {
                animation: nk-toast-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            }
            .nk-toast-dismissing {
                animation: nk-toast-out 0.25s ease-in forwards !important;
            }
        `;
        document.head.appendChild(s);
    }

    // ── 2. Sonnerie Web Audio API (aucun fichier MP3 externe nécessaire) ─────
    function _playRingTone() {
        try {
            if (_ringInterval) return;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            _ringCtx = new AudioCtx();

            const playDualTone = () => {
                if (!_ringCtx) return;
                try {
                    // Fréquences standard téléphone (440Hz + 480Hz)
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

    // ── 3. Affichage du Toast Appel Entrant ───────────────────────────────────
    function _showIncomingCallToast(data) {
        if (document.getElementById(TOAST_ID)) return;
        _injectStyles();

        const callerName = data.callerName || (data.role === 'vendor' ? 'Vendeur' : 'Client');
        const callerAvatar = data.callerAvatar || '';
        const orderId = data.orderId || '';

        // Destination vers le bon dashboard
        const targetDashboard = data.role === 'vendor'
            ? '/src/pages/customer-dashboard.html'
            : '/src/pages/vendor-dashboard.html';
        const targetUrl = orderId
            ? `${targetDashboard}?order=${encodeURIComponent(orderId)}`
            : targetDashboard;

        const roleLabel = data.role === 'vendor' ? 'Vendeur NewKet' : 'Client NewKet';

        const toast = document.createElement('div');
        toast.id = TOAST_ID;
        toast.className = 'nk-toast-bounce';
        toast.style.cssText = [
            'position: fixed',
            'bottom: 96px',
            'left: 50%',
            'transform: translateX(-50%)',
            'z-index: 9999999',
            'width: min(360px, calc(100vw - 32px))',
            'background: linear-gradient(145deg, #090d16 0%, #151d2f 100%)',
            'border: 1px solid rgba(52, 211, 153, 0.45)',
            'border-radius: 24px',
            'box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)',
            'padding: 16px 18px',
            'display: flex',
            'flex-direction: column',
            'gap: 14px',
            'user-select: none',
            'font-family: inherit'
        ].join(';');

        const avatarMarkup = callerAvatar
            ? `<img src="${callerAvatar}" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2.5px solid #34d399;flex-shrink:0;">`
            : `<div style="width:52px;height:52px;border-radius:50%;background:#1e293b;border:2.5px solid #34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;font-weight:800;color:#6ee7b7;">${(callerName[0] || '?').toUpperCase()}</div>`;

        toast.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="position:relative;flex-shrink:0;">
                    ${avatarMarkup}
                    <div style="position:absolute;bottom:0;right:0;width:16px;height:16px;border-radius:50%;background:#22c55e;border:2px solid #090d16;animation:nk-ring-pulse 1.8s infinite;"></div>
                </div>
                <div style="min-width:0;flex:1;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                        <span style="font-size:10px;font-weight:800;color:#34d399;letter-spacing:0.06em;text-transform:uppercase;">Appel Entrant</span>
                        <span style="font-size:10px;color:#94a3b8;font-weight:600;">• ${roleLabel}</span>
                    </div>
                    <p style="font-size:16px;font-weight:800;color:#ffffff;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2;">
                        ${callerName}
                    </p>
                    <p style="font-size:11px;color:#cbd5e1;margin:3px 0 0;font-weight:500;">
                        Appel vocal chiffré en direct
                    </p>
                </div>
                <div style="font-size:24px;animation:nk-bell-wiggle 1s ease infinite;flex-shrink:0;">
                    📞
                </div>
            </div>

            <div style="display:flex;gap:10px;">
                <button id="nk-btn-decline-call" type="button" style="flex:1;padding:12px 14px;border-radius:14px;background:#ef4444;color:#fff;border:none;font-size:13px;font-weight:800;letter-spacing:0.02em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 12px rgba(239,68,68,0.35);transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">
                    <span>✕ Refuser</span>
                </button>
                <button id="nk-btn-accept-call" type="button" style="flex:1.4;padding:12px 16px;border-radius:14px;background:#10b981;color:#fff;border:none;font-size:13px;font-weight:800;letter-spacing:0.02em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 14px rgba(16,185,129,0.4);transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">
                    <span>📞 Décrocher</span>
                </button>
            </div>
        `;

        document.body.appendChild(toast);
        _playRingTone();

        const autoDismissTimer = setTimeout(() => {
            _dismissToast();
        }, 35000);

        const btnAccept = toast.querySelector('#nk-btn-accept-call');
        const btnDecline = toast.querySelector('#nk-btn-decline-call');

        btnAccept?.addEventListener('click', () => {
            clearTimeout(autoDismissTimer);
            _dismissToast();
            window.location.href = targetUrl;
        });

        btnDecline?.addEventListener('click', () => {
            clearTimeout(autoDismissTimer);
            _dismissToast();
        });
    }

    function _dismissToast() {
        const toast = document.getElementById(TOAST_ID);
        if (toast) {
            toast.classList.add('nk-toast-dismissing');
            setTimeout(() => toast.remove(), 250);
        }
        _stopRingTone();
    }

    // ── 4. Pilule flottante pour appel en cours (cross-page navigation) ───────
    function _renderPill(data) {
        let pill = document.getElementById(PILL_ID);
        if (!data || data.state === 'idle' || !data.state) {
            if (pill) pill.remove();
            return;
        }
        _injectStyles();

        if (!pill) {
            pill = document.createElement('div');
            pill.id = PILL_ID;
            pill.style.cssText = [
                'position: fixed',
                'bottom: 84px',
                'left: 50%',
                'transform: translateX(-50%)',
                'z-index: 999999',
                'display: flex',
                'align-items: center',
                'gap: 10px',
                'padding: 10px 18px',
                'border-radius: 999px',
                'background: linear-gradient(135deg, #111827 0%, #1f2937 100%)',
                'border: 1px solid rgba(52, 211, 153, 0.4)',
                'box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5)',
                'cursor: pointer',
                'user-select: none',
                'animation: nk-toast-in 0.28s ease both'
            ].join(';');
            document.body.appendChild(pill);
        }

        const peerName = data.peerName || (data.role === 'vendor' ? 'Client' : 'Vendeur');
        const avatarUrl = data.peerAvatar || '';
        const dashUrl = data.dashboardUrl || (data.role === 'vendor' ? '/src/pages/vendor-dashboard.html' : '/src/pages/customer-dashboard.html');
        const label = data.state === 'connected' ? '📞 En communication' : '📞 Appel en cours';

        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #34d399;flex-shrink:0;">`
            : `<div style="width:28px;height:28px;border-radius:50%;background:#374151;border:2px solid #34d399;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:#6ee7b7;">${(peerName[0] || '?').toUpperCase()}</div>`;

        pill.innerHTML = `
            ${avatarHtml}
            <div style="display:flex;flex-direction:column;min-width:0;">
                <span style="font-size:10px;font-weight:800;color:#6ee7b7;letter-spacing:0.04em;">${label}</span>
                <span style="font-size:12px;font-weight:700;color:#ffffff;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${peerName}</span>
            </div>
            <div style="width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;flex-shrink:0;animation:nk-glow-dot 1.2s ease infinite;"></div>
        `;

        pill.onclick = () => { window.location.href = dashUrl; };
    }

    // ── 5. Initialisation du canal Supabase user-ring ─────────────────────────
    async function _init() {
        // A) Afficher la pilule si un appel est actif dans sessionStorage
        if (!isOnDashboard) {
            try {
                const saved = sessionStorage.getItem('newket_active_call');
                if (saved) {
                    const data = JSON.parse(saved);
                    _renderPill(data);
                }
            } catch (_) {}

            if (typeof BroadcastChannel !== 'undefined') {
                try {
                    const bc = new BroadcastChannel('newket-call-state');
                    bc.onmessage = (evt) => _renderPill(evt.data || {});
                } catch (_) {}
            }
        }

        // B) Abonnement Supabase au canal user-ring:{userId}
        let _channelSubscribed = false;

        const connectUserRing = (client, userId) => {
            if (_channelSubscribed || !userId || !client) return;
            _channelSubscribed = true;

            const channelName = `user-ring:${userId}`;
            const ringChannel = client.channel(channelName);

            ringChannel
                .on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
                    console.log('[NewKet CallNotifier] Reçu incoming-call:', payload);
                    if (isOnDashboard) return;
                    _showIncomingCallToast(payload || {});
                })
                .on('broadcast', { event: 'cancel-call' }, () => {
                    console.log('[NewKet CallNotifier] Reçu cancel-call');
                    _dismissToast();
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

        // Boucle d'attente (polling léger jusqu'à 8 secondes)
        let attempts = 0;
        const pollTimer = setInterval(async () => {
            attempts++;
            const connected = await trySubscribe();
            if (connected || attempts >= 40) {
                clearInterval(pollTimer);
            }
        }, 200);

        // Écouter aussi l'événement auth change en secours
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
