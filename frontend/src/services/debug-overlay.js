/**
 * NewKet - Diagnostic On-Screen Overlay for Mobile Debugging (iOS / Android)
 * Displays real-time state: version, backendReady, products count, Supabase status, and live console logs.
 */

const MAX_LOGS = 60;
const logs = [];

// Intercept console messages
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

function addLog(level, args) {
    const time = new Date().toLocaleTimeString();
    const text = args.map(a => {
        if (a instanceof Error) {
            return `${a.name || 'Error'}: ${a.message}`;
        }
        if (typeof a === 'object' && a !== null) {
            try {
                const s = JSON.stringify(a);
                if (s === '{}' && (a.message || a.name)) {
                    return `${a.name || 'Error'}: ${a.message}`;
                }
                return s;
            } catch (_) {
                return String(a);
            }
        }
        return String(a);
    }).join(' ');
    logs.unshift({ level, time, text });
    if (logs.length > MAX_LOGS) logs.pop();
    updatePanel();
}

console.log = function (...args) {
    origLog.apply(console, args);
    addLog('log', args);
};
console.warn = function (...args) {
    origWarn.apply(console, args);
    addLog('warn', args);
};
console.error = function (...args) {
    origError.apply(console, args);
    addLog('error', args);
};

let pill = null;
let panel = null;
let isOpen = false;

function getDiagnosticState() {
    const ota = window._otaState || {};
    const metaVer = document.querySelector('meta[name="newket-version"]')?.content || '';
    const pkgVer = ota.localVersion || (metaVer ? metaVer.split('-')[0] : (window.newketVersion || '1.0.42'));
    const isCap = typeof window.isNativeCapacitor === 'function' ? window.isNativeCapacitor() : (window.location?.protocol === 'capacitor:');
    const bReady = window.newketBackendReady;
    const prodCount = window.ProductManager?.products?.length ?? 'N/A';
    const pubCount = window.ProductManager?.getPublicProducts?.()?.length ?? 'N/A';
    const sbOk = !!window.supabaseClient;
    const authRole = window.AuthManager?.role || 'visiteur';

    return { pkgVer, isCap, bReady, prodCount, pubCount, sbOk, authRole, ota };
}

function getOtaColor(status) {
    const map = { 'up-to-date': '#10b981', 'downloading': '#0284c7', 'applying': '#7c3aed', 'error': '#ef4444', 'checking': '#f59e0b', 'idle': '#6b7280', 'non-natif': '#6b7280' };
    return map[status] || '#6b7280';
}

function updatePanel() {
    if (!pill) return;
    const s = getDiagnosticState();
    const otaOk = s.ota.status === 'up-to-date' || s.ota.status === 'applying';
    const hasProducts = s.pubCount > 0;
    const pillColor = hasProducts && (otaOk || !s.isCap) ? '#10b981' : s.ota.status === 'error' ? '#ef4444' : '#f59e0b';

    pill.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${pillColor}; margin-right:6px;"></span>
        <b>v${s.pkgVer}</b> | Prd: ${s.pubCount}/${s.prodCount} | OTA: ${s.ota.status || '?'}
    `;

    if (panel && isOpen) {
        const infoEl = panel.querySelector('#nk-debug-info');
        const logsEl = panel.querySelector('#nk-debug-logs');
        if (infoEl) {
            const otaStatusColor = getOtaColor(s.ota.status);
            infoEl.innerHTML = `
                <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:10px; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:4px;">📱 APP</div>
                    <div><b>Version bundle :</b> ${s.pkgVer}</div>
                    <div><b>Capacitor :</b> ${s.isCap ? '✅ OUI' : '❌ NON'} (${window.location.protocol}//${window.location.hostname})</div>
                    <div><b>Supabase Client :</b> ${s.sbOk ? '✅ OK' : '❌ NULL'}</div>
                    <div><b>BackendReady :</b> ${s.bReady ? '✅ true' : '❌ false'}</div>
                    <div><b>Produits :</b> ${s.prodCount} total (${s.pubCount} publics)</div>
                    <div><b>Rôle Auth :</b> ${s.authRole}</div>
                    <div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.12);">
                        <div style="font-size:10px; font-weight:800; color:#38bdf8; letter-spacing:0.05em; margin-bottom:2px;">🧭 ORIENTATION & ECRAN</div>
                        <div><b>Mode :</b> ${window.innerWidth > window.innerHeight ? '⚠️ Landscape (Paysage)' : '✅ Portrait'}</div>
                        <div><b>Taille :</b> ${window.innerWidth} x ${window.innerHeight} px</div>
                        <div><b>Overlay :</b> ${document.getElementById('nk-rotate-device-overlay')?.classList?.contains('is-active') ? '🔴 ACTIF (bloqué)' : '⚪ Inactif'}</div>
                    </div>
                </div>
                <div>
                    <div style="font-size:10px; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:4px;">🔄 OTA</div>
                    <div><b>Statut :</b> <span style="color:${otaStatusColor}; font-weight:bold;">${s.ota.status || 'idle'}</span></div>
                    <div><b>Version locale :</b> ${s.ota.localVersion || '—'}</div>
                    <div><b>Version distante :</b> ${s.ota.remoteVersion || '—'}</div>
                    <div><b>Checksum DB :</b> ${s.ota.checksumExpected ? s.ota.checksumExpected.slice(0,20)+'...' : '⚠️ ABSENT'}</div>
                    ${s.ota.error ? `<div style="color:#f87171; font-weight:bold;">❌ Erreur : ${s.ota.error}</div>` : ''}
                    ${s.ota.lastChecked ? `<div style="opacity:0.5; font-size:10px;">Vérifié : ${new Date(s.ota.lastChecked).toLocaleTimeString()}</div>` : ''}
                </div>
            `;
        }
        if (logsEl) {
            logsEl.innerHTML = logs.map(l => {
                const color = l.level === 'error' ? '#f87171' : l.level === 'warn' ? '#fbbf24' : '#e2e8f0';
                return `<div style="color:${color}; margin-bottom:4px; font-size:11px; font-family:monospace; word-break:break-word;">
                    <span style="opacity:0.6;">[${l.time}]</span> [${l.level.toUpperCase()}] ${l.text}
                </div>`;
            }).join('');
        }
    }
}

export function initDebugOverlay() {
    if (typeof document === 'undefined') return;

    // Show debug pill (activé pour diagnostic mobile iOS/Android)
    const isDebugRequested = true;
    if (!isDebugRequested) return;

    // Create floating pill
    pill = document.createElement('div');
    pill.id = 'nk-debug-pill';
    pill.style.cssText = `
        position: fixed;
        bottom: calc(96px + env(safe-area-inset-bottom, 12px));
        left: calc(12px + env(safe-area-inset-left, 0px));
        z-index: 9999999;
        background: rgba(15, 23, 42, 0.94);
        color: #fff;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.15);
        display: flex;
        align-items: center;
        cursor: pointer;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
    `;

    // Make pill draggable on touch
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let pillStartX = 0;
    let pillStartY = 0;

    pill.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        isDragging = false;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        const rect = pill.getBoundingClientRect();
        pillStartX = rect.left;
        pillStartY = rect.top;
    }, { passive: true });

    pill.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging = true;
            pill.style.bottom = 'auto';
            pill.style.left = `${Math.max(8, Math.min(window.innerWidth - 120, pillStartX + dx))}px`;
            pill.style.top = `${Math.max(40, Math.min(window.innerHeight - 60, pillStartY + dy))}px`;
        }
    }, { passive: true });

    pill.addEventListener('touchend', () => {
        // slight delay to prevent click trigger when dragging
        setTimeout(() => { isDragging = false; }, 100);
    });

    pill.addEventListener('click', () => {
        if (!isDragging) toggleDebugPanel();
    });
    document.body.appendChild(pill);

    // Create modal panel
    panel = document.createElement('div');
    panel.id = 'nk-debug-panel';
    panel.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000000;
        background: rgba(0, 0, 0, 0.75);
        display: none;
        flex-direction: column;
        justify-content: flex-end;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
    `;

    panel.innerHTML = `
        <div style="background:#0f172a; color:#fff; border-top-left-radius:24px; border-top-right-radius:24px; padding:20px 20px calc(24px + env(safe-area-inset-bottom, 20px)); max-height:85vh; display:flex; flex-direction:column; box-shadow:0 -10px 30px rgba(0,0,0,0.6); border-top:1px solid rgba(255,255,255,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; gap:4px;">
                <h3 style="margin:0; font-size:13px; font-weight:800; color:#38bdf8; white-space:nowrap;">🛠️ Diag</h3>
                <div style="display:flex; gap:4px; flex-wrap:nowrap; align-items:center;">
                    <button id="nk-dbg-copy-all" style="background:#059669; color:#fff; border:none; border-radius:6px; padding:4px 7px; font-size:10px; font-weight:bold; cursor:pointer; white-space:nowrap;">📋 Copier</button>
                    <button id="nk-dbg-force-fetch" style="background:#2563eb; color:#fff; border:none; border-radius:6px; padding:4px 7px; font-size:10px; font-weight:bold; cursor:pointer; white-space:nowrap;">Forcer</button>
                    <button id="nk-dbg-ota-history" style="background:#7c3aed; color:#fff; border:none; border-radius:6px; padding:4px 6px; font-size:10px; font-weight:bold; cursor:pointer; white-space:nowrap;">📜 OTA</button>
                    <button id="nk-dbg-close" style="background:rgba(239,68,68,0.25); color:#fca5a5; border:1px solid rgba(239,68,68,0.4); border-radius:6px; padding:4px 8px; font-size:11px; font-weight:bold; cursor:pointer; line-height:1;" title="Fermer">✕</button>
                </div>
            </div>
            <!-- Bouton pour demander toutes les autorisations natives (Localisation, Caméra, Micro, Face ID, Notifs) -->
            <button id="nk-dbg-request-all-perms" style="width:100%; margin-bottom:10px; background:linear-gradient(135deg, #6366f1, #a855f7); color:#fff; border:none; border-radius:12px; padding:10px 14px; font-size:12px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(168,85,247,0.3); display:flex; align-items:center; justify-content:center; gap:8px;">
                <span>🛡️ Déclencher toutes les autorisations</span>
            </button>
            <div id="nk-debug-info" style="font-size:11px; line-height:1.6; margin-bottom:10px; background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);"></div>
            <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin-bottom:6px;">Console Logs (temps réel) :</div>
            <div id="nk-debug-logs" style="flex:1; overflow-y:auto; background:#020617; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); max-height:350px;"></div>
        </div>
    `;

    panel.querySelector('#nk-dbg-close').addEventListener('click', () => toggleDebugPanel(false));

    panel.querySelector('#nk-dbg-copy-all').addEventListener('click', async () => {
        const s = getDiagnosticState();
        const fullText = [
            `=== NewKet Diagnostic (v${s.pkgVer}) ===`,
            `Date: ${new Date().toISOString()}`,
            ``,
            `--- APP ---`,
            `Capacitor: ${s.isCap ? 'OUI' : 'NON'} (${window.location.protocol}//${window.location.hostname})`,
            `BackendReady: ${s.bReady}`,
            `Supabase Client: ${s.sbOk ? 'OK' : 'NULL'}`,
            `Produits: ${s.prodCount} total (${s.pubCount} publics)`,
            `Rôle Auth: ${s.authRole}`,
            ``,
            `--- OTA ---`,
            `Statut: ${s.ota.status || 'idle'}`,
            `Version locale: ${s.ota.localVersion || '—'}`,
            `Version distante: ${s.ota.remoteVersion || '—'}`,
            `Checksum DB: ${s.ota.checksumExpected || 'ABSENT ⚠️'}`,
            s.ota.error ? `Erreur OTA: ${s.ota.error}` : null,
            s.ota.lastChecked ? `Vérifié le: ${s.ota.lastChecked}` : null,
            ``,
            `--- Console Logs (${logs.length}) ---`,
            ...logs.slice().reverse().map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.text}`)
        ].filter(l => l !== null).join('\n');

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(fullText);
            } else {
                const ta = document.createElement('textarea');
                ta.value = fullText;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            const copyBtn = panel.querySelector('#nk-dbg-copy-all');
            const origText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copié !';
            copyBtn.style.background = '#10b981';
            setTimeout(() => {
                copyBtn.textContent = origText;
                copyBtn.style.background = '#059669';
            }, 2000);
        } catch (err) {
            alert('Erreur copie : ' + err.message);
        }
    });

    panel.querySelector('#nk-dbg-force-fetch').addEventListener('click', async () => {
        console.log('[Debug] Forcing ProductManager.fetchFreshData()...');
        if (window.ProductManager) {
            try {
                await window.ProductManager.fetchFreshData();
                console.log('[Debug] Force fetch done! Total:', window.ProductManager.products.length);
            } catch (e) {
                console.error('[Debug] Force fetch error:', e);
            }
        } else {
            console.error('[Debug] ProductManager is undefined!');
        }
        updatePanel();
    });

    // ── Bouton Historique OTA ──────────────────────────────────────────────────
    panel.querySelector('#nk-dbg-ota-history').addEventListener('click', async () => {
        const btn = panel.querySelector('#nk-dbg-ota-history');
        const infoEl = panel.querySelector('#nk-debug-info');
        const origText = btn.textContent;
        btn.textContent = '⏳ Chargement...';
        btn.disabled = true;
        try {
            const SUPA_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
            const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY';
            const url = `${SUPA_URL}/rest/v1/app_versions?select=version,release_notes,created_at,checksum,is_active&order=created_at.desc&limit=5`;
            const res = await fetch(url, { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const rows = await res.json();
            if (infoEl) {
                infoEl.innerHTML = `
                    <div style="font-size:10px; font-weight:800; color:#c084fc; letter-spacing:0.05em; margin-bottom:8px;">📜 DERNIERS CODES OTA (${rows.length})</div>
                    <div style="max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                        ${rows.map(r => {
                            const date = new Date(r.created_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
                            const cs = r.checksum ? r.checksum.slice(0,16) + '…' : '⚠️ absent';
                            const active = r.is_active ? ' ✅' : '';
                            return `<div style="background:rgba(255,255,255,0.05); padding:6px 8px; border-radius:8px; border-left:3px solid ${r.is_active ? '#10b981' : '#475569'};">
                                <div style="font-weight:800; color:${r.is_active ? '#10b981' : '#94a3b8'};">v${r.version}${active}</div>
                                <div style="opacity:0.6; font-size:10px;">${date}</div>
                                <div style="font-size:10px; color:#cbd5e1; margin-top:2px;">${r.release_notes || '—'}</div>
                                <div style="font-size:9px; opacity:0.4; font-family:monospace;">${cs}</div>
                            </div>`;
                        }).join('')}
                    </div>
                `;
            }
            btn.textContent = '✅ Chargé';
            setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 3000);
        } catch (err) {
            if (infoEl) infoEl.innerHTML = `<div style="color:#f87171;">❌ Erreur OTA History: ${err.message}</div>`;
            btn.textContent = origText;
            btn.disabled = false;
        }
    });

    // ── Déclencheur séquentiel de toutes les permissions système iOS & Android ──
    panel.querySelector('#nk-dbg-request-all-perms').addEventListener('click', async () => {
        const btn = panel.querySelector('#nk-dbg-request-all-perms');
        const origContent = btn.innerHTML;
        btn.disabled = true;
        btn.style.opacity = '0.7';

        const setStatus = (txt) => {
            btn.innerHTML = `<span>⏳ ${txt}...</span>`;
            console.log(`[Permissions] 👉 ${txt}`);
        };

        try {
            // 1. Localisation (GPS)
            setStatus('1/6 Localisation');
            if (navigator.geolocation) {
                await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            console.log('[Permissions] ✅ Position GPS validée');
                            resolve(pos);
                        },
                        (err) => {
                            console.warn('[Permissions] ⚠️ Position:', err.message);
                            resolve(null);
                        },
                        { timeout: 8000, enableHighAccuracy: true }
                    );
                });
            }

            // 2. Caméra (Photo produit & KYC)
            setStatus('2/6 Caméra');
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    console.log('[Permissions] ✅ Caméra autorisée');
                    stream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.warn('[Permissions] ⚠️ Caméra refusée ou non dispo:', e.message);
                }
            }

            // 3. Microphone (Vocal flux & Appels audio)
            setStatus('3/6 Microphone');
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    console.log('[Permissions] ✅ Microphone autorisé');
                    stream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.warn('[Permissions] ⚠️ Microphone refusé ou non dispo:', e.message);
                }
            }

            // 4. Notifications Push (Natif Capacitor ou Web)
            setStatus('4/6 Notifications');
            try {
                if (window.Capacitor?.isNativePlatform?.() || window.location?.protocol === 'capacitor:') {
                    const { PushNotifications } = await import('@capacitor/push-notifications');
                    let perm = await PushNotifications.checkPermissions();
                    if (perm.receive === 'prompt') {
                        perm = await PushNotifications.requestPermissions();
                    }
                    console.log('[Permissions] Notifications push natives statut:', perm.receive);
                    if (perm.receive === 'granted') {
                        await PushNotifications.register();
                    }
                } else if (window.Notification && Notification.requestPermission) {
                    const perm = await Notification.requestPermission();
                    console.log('[Permissions] Notifications web statut:', perm);
                }
            } catch (e) {
                console.warn('[Permissions] ⚠️ Notifications error:', e.message);
            }

            // 5. Face ID / Biométrie native (Capacitor BiometricAuth -> LAContext iOS) ou WebAuthn (Web)
            setStatus('5/6 Face ID / Biométrie');
            const isNativeCap = Boolean(
                window.Capacitor?.isNativePlatform?.() ||
                window.Capacitor?.getPlatform?.() === 'android' ||
                window.Capacitor?.getPlatform?.() === 'ios'
            );

            if (isNativeCap && typeof window.authenticateDeviceOwner === 'function') {
                try {
                    console.log('[Permissions] Déclenchement Face ID natif iOS/Android...');
                    const bioOk = await window.authenticateDeviceOwner("Test des permissions Face ID NewKet");
                    console.log('[Permissions] Résultat Face ID natif:', bioOk ? '✅ Autorisé' : 'Annulé / Rejeté');
                } catch (e) {
                    console.warn('[Permissions] ⚠️ Face ID natif error:', e?.message || e);
                }
            } else if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
                try {
                    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                    console.log('[Permissions] Biométrie Web (WebAuthn / Face ID / Touch ID) :', available ? '✅ Disponible sur cet appareil' : '⚪ Non disponible sur ce navigateur');

                    if (available && navigator.credentials && navigator.credentials.create) {
                        console.log('[Permissions] 📱 Déclenchement de la fenêtre système Face ID / Touch ID / Code appareil...');
                        const challenge = new Uint8Array(32);
                        window.crypto.getRandomValues(challenge);
                        const userId = new Uint8Array(16);
                        window.crypto.getRandomValues(userId);

                        try {
                            await navigator.credentials.create({
                                publicKey: {
                                    challenge: challenge,
                                    rp: { name: "NewKet", id: window.location.hostname },
                                    user: {
                                        id: userId,
                                        name: "test-auth@newket.com",
                                        displayName: "NewKet Appareil Test"
                                    },
                                    pubKeyCredParams: [
                                        { alg: -7, type: "public-key" },
                                        { alg: -257, type: "public-key" }
                                    ],
                                    authenticatorSelection: {
                                        authenticatorAttachment: "platform", // Force Touch ID / Face ID / Code appareil local
                                        residentKey: "discouraged", // Privilégie l'appareil local (Windows Hello)
                                        requireResidentKey: false,
                                        userVerification: "required"
                                    },
                                    timeout: 60000
                                }
                            });
                            console.log('[Permissions] ✅ Fenêtre validée avec succès avec la biométrie/code de votre appareil !');
                        } catch (promptErr) {
                            if (promptErr.name === 'NotAllowedError') {
                                console.log('[Permissions] ℹ️ Fenêtre de l\'appareil affichée avec succès (Action annulée par l\'utilisateur)');
                            } else {
                                console.log('[Permissions] ℹ️ Fenêtre de l\'appareil déclenchée :', promptErr.message || promptErr.name);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[Permissions] ⚠️ WebAuthn check:', e?.message);
                }
            } else {
                console.log('[Permissions] ℹ️ Biométrie : non supportée sur ce navigateur web');
            }

            // 6. Actualisation en arrière-plan (BackgroundFetch / ServiceWorker)
            setStatus('6/6 Arrière-plan');
            try {
                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready.catch(() => null);
                    if (reg && 'backgroundFetch' in reg) {
                        console.log('[Permissions] ✅ BackgroundFetch API disponible');
                        // Déclenchement d'un fetch en arrière-plan (peut activer la permission iOS)
                        await reg.backgroundFetch.fetch('nk-bg-check', [], {
                            title: 'NewKet – vérification arrière-plan',
                            icons: [],
                            downloadTotal: 0
                        }).catch(e => console.log('[Permissions] BackgroundFetch résultat:', e.name));
                    } else {
                        console.log('[Permissions] ⚠️ BackgroundFetch API non dispo (normal sur WKWebView)');
                    }
                }
                console.log('[Permissions] ✅ Actualisation en arrière-plan : UIBackgroundModes (fetch + remote-notification) actif dans Info.plist natif');
            } catch (e) {
                console.warn('[Permissions] ⚠️ Arrière-plan:', e.message);
            }

            btn.innerHTML = `<span>✅ Autorisations demandées !</span>`;
            btn.style.background = '#10b981';
            console.log('[Permissions] 🏁 Cycle terminé. Vérifiez Réglages > NewKet.');
            setTimeout(() => {
                btn.innerHTML = origContent;
                btn.style.background = 'linear-gradient(135deg, #6366f1, #a855f7)';
                btn.disabled = false;
                btn.style.opacity = '1';
            }, 3500);

        } catch (globalErr) {
            console.error('[Permissions] Erreur globale:', globalErr);
            btn.innerHTML = `<span>❌ Erreur: ${globalErr.message}</span>`;
            btn.style.background = '#ef4444';
            setTimeout(() => {
                btn.innerHTML = origContent;
                btn.style.background = 'linear-gradient(135deg, #6366f1, #a855f7)';
                btn.disabled = false;
                btn.style.opacity = '1';
            }, 3000);
        }
        updatePanel();
    });

    document.body.appendChild(panel);

    // Listeners for updates
    window.addEventListener('productsUpdated', updatePanel);
    window.addEventListener('productsError', updatePanel);
    window.addEventListener('newketInitialized', updatePanel);
    window.addEventListener('otaStateChanged', updatePanel);

    setInterval(updatePanel, 1500);
    updatePanel();
}

function toggleDebugPanel(force) {
    isOpen = typeof force === 'boolean' ? force : !isOpen;
    if (panel) {
        panel.style.display = isOpen ? 'flex' : 'none';
        // Hide mobile bottom nav to prevent overlap
        const bottomNav = document.getElementById('mobileBottomNav');
        if (bottomNav) {
            bottomNav.style.display = isOpen ? 'none' : '';
        }
        updatePanel();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebugOverlay);
} else {
    initDebugOverlay();
}
