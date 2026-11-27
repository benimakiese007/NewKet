// Auto-hide debug pill & test panels by default from t=0ms
if (typeof document !== 'undefined') {
    const _initHideStyle = document.createElement('style');
    _initHideStyle.id = 'nk-debug-visibility-style';
    _initHideStyle.textContent = '#nk-debug-pill, #nk-live-activity-test-panel, #nk-vendor-live-activity-panel, #nk-settings-live-activity-section { display: none !important; }';
    if (document.head) {
        document.head.appendChild(_initHideStyle);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (!document.getElementById('nk-debug-visibility-style') && document.head) {
                document.head.appendChild(_initHideStyle);
            }
        });
    }
}
/* nk-debug-visibility-style-init */
/**
 * NewKet - Diagnostic On-Screen Overlay for Mobile Debugging (iOS / Android)
 * Displays real-time state: version, backendReady, products count, Supabase status, and live console logs.
 */

const MAX_LOGS = 120;
const logs = [];
let isLogsExpanded = false;

let _overlayAppUpdate = null;
async function getAppUpdatePlugin() {
    if (_overlayAppUpdate) return _overlayAppUpdate;
    if (window.Capacitor?.Plugins?.AppUpdate) {
        _overlayAppUpdate = window.Capacitor.Plugins.AppUpdate;
        return _overlayAppUpdate;
    }
    try {
        const { registerPlugin } = await import('@capacitor/core');
        _overlayAppUpdate = registerPlugin('AppUpdate');
    } catch (_) {
        _overlayAppUpdate = window.Capacitor?.Plugins?.AppUpdate;
    }
    return _overlayAppUpdate;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Intercept console messages
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

let _isUpdatingPanel = false;
function addLog(level, args) {
    const time = new Date().toLocaleTimeString();
    const text = args.map(a => {
        if (a instanceof Error) return `${a.name || 'Error'}: ${a.message}`;
        if (typeof a === 'object' && a !== null) {
            try {
                const s = JSON.stringify(a);
                if (s === '{}' && (a.message || a.name)) return `${a.name || 'Error'}: ${a.message}`;
                return s;
            } catch (_) {
                return String(a);
            }
        }
        return String(a);
    }).join(' ');

    if (text.includes('Content Security Policy') || text.includes('connect-src') || text.includes('violates the following')) {
        return;
    }

    logs.unshift({ level, time, text });
    if (logs.length > MAX_LOGS) logs.pop();
    if (!_isUpdatingPanel) {
        _isUpdatingPanel = true;
        try {
            updatePanel();
        } finally {
            _isUpdatingPanel = false;
        }
    }
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

function getPlatform() {
    if (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
        return window.Capacitor.getPlatform(); // 'android', 'ios', 'web'
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'web';
}

function getDiagnosticState() {
    const ota = window._otaState || {};
    const metaVer = document.querySelector('meta[name="newket-version"]')?.content || '';
    const metaAppVer = document.querySelector('meta[name="app-version"]')?.content || '';
    let rawVer = metaVer;
    if (rawVer && (rawVer.startsWith('dpl_') || /^[a-f0-9]{7,40}$/i.test(rawVer))) {
        rawVer = metaAppVer || ota.remoteVersion || ota.localVersion || '1.0.79r';
    } else if (rawVer && rawVer.includes('-')) {
        rawVer = rawVer.split('-')[0];
    }
    const pkgVer = rawVer || metaAppVer || ota.localVersion || ota.remoteVersion || '1.0.79r';
    const isCap = typeof window.isNativeCapacitor === 'function' ? window.isNativeCapacitor() : (window.location?.protocol === 'capacitor:');
    const bReady = window.newketBackendReady;
    const prodCount = window.ProductManager?.products?.length ?? 'N/A';
    const pubCount = window.ProductManager?.getPublicProducts?.()?.length ?? 'N/A';
    const sbOk = !!window.supabaseClient;
    const authRole = window.AuthManager?.role || 'visiteur';
    const notifCount = window.NotificationManager?.notifications?.length ?? 0;
    const notifUnread = window.NotificationManager?.getUnreadCount ? window.NotificationManager.getUnreadCount() : 0;
    const platform = getPlatform();
    const isAndroid = platform === 'android';
    const isIos = platform === 'ios';

    return { pkgVer, isCap, bReady, prodCount, pubCount, sbOk, authRole, notifCount, notifUnread, ota, platform, isAndroid, isIos };
}

function getOtaColor(status) {
    const map = { 'up-to-date': '#10b981', 'downloading': '#0284c7', 'applying': '#7c3aed', 'error': '#ef4444', 'checking': '#f59e0b', 'idle': '#6b7280', 'non-natif': '#6b7280' };
    return map[status] || '#6b7280';
}

// ── Formateurs de version universels selon la nomenclature convenue ───────────
function formatOtaCode(v) {
    if (!v) return 'OTA-?';
    const clean = String(v).replace(/^v/i, '').trim();
    // Ex: "1.0.79a" -> "OTA-79a"
    const m = clean.match(/(?:^|\.)(\d+[a-z]+)$/i);
    if (m) return `OTA-${m[1].toLowerCase()}`;
    const m2 = clean.match(/(?:^|\.)(\d+)$/);
    if (m2) return `OTA-${m2[1]}a`;
    if (clean.startsWith('dpl_')) return `OTA-${clean.slice(4, 10)}`;
    return `OTA-${clean}`;
}

function formatApkCode(v) {
    if (!v) return 'APK-?';
    const clean = String(v).replace(/^v/i, '').trim();
    // Ex: "1.0.79" -> "APK-79"
    const m = clean.match(/(?:^|\.)(\d+)(?:[a-z].*)?$/i);
    if (m) return `APK-${m[1]}`;
    return `APK-${clean}`;
}

function formatTfCode(v) {
    if (!v || v === 'none' || v === 'null') return 'TF-Non configuré';
    const clean = String(v).replace(/^v/i, '').trim();
    const m = clean.match(/(?:^|\.)(\d+)$/);
    if (m) return `TF-${m[1]}`;
    return `TF-${clean}`;
}

function formatWebCode(v) {
    if (!v) return 'WEB-?';
    const clean = String(v).replace(/^v/i, '').trim();
    const m = clean.match(/(?:^|\.)(\d+[a-z]+)$/i);
    if (m) return `WEB-${m[1].toLowerCase()}`;
    const m2 = clean.match(/(?:^|\.)(\d+)$/);
    if (m2) return `WEB-${m2[1]}`;
    if (clean.startsWith('dpl_')) return `WEB-${clean.slice(4, 10)}`;
    return `WEB-${clean}`;
}

function updatePanel() {
    if (!pill) return;
    const s = getDiagnosticState();
    const otaOk = s.ota.status === 'up-to-date' || s.ota.status === 'applying';
    const hasProducts = s.pubCount > 0;
    const pillColor = hasProducts && (otaOk || !s.isCap) ? '#10b981' : s.ota.status === 'error' ? '#ef4444' : '#f59e0b';

    // Pastille universelle : juste le code OTA pour tout le monde
    const activeOtaVer = s.ota.localVersion || s.ota.remoteVersion || s.pkgVer || '1.0.79r';
    const otaPillText = formatOtaCode(activeOtaVer);

    pill.innerHTML = `
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${pillColor}; margin-right:6px; box-shadow:0 0 5px ${pillColor};"></span>
        <b style="letter-spacing:0.04em;">${otaPillText}</b>
    `;

    // Rafraîchir dynamiquement la release GitHub (Android APK) une seule fois pour TOUS les supports (Web, iOS, Android)
    const isCapacitorNative = typeof window.isNativeCapacitor === 'function' ? window.isNativeCapacitor() : (window.location?.protocol === 'capacitor:');
    if (isCapacitorNative && !window.__REMOTE_APK_VERSION__ && !window.__fetchingRemoteApk) {
        window.__fetchingRemoteApk = true;
        const stored = localStorage.getItem('nk_remote_apk_version');
        if (stored) window.__REMOTE_APK_VERSION__ = stored;
        (async () => {
            try {
                const res = await fetch('https://api.github.com/repos/benimakiese007/NewKet/releases/latest', {
                    headers: { 'Accept': 'application/vnd.github+json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.tag_name) {
                        window.__REMOTE_APK_VERSION__ = data.tag_name;
                        localStorage.setItem('nk_remote_apk_version', data.tag_name);
                        const el = document.getElementById('nk-dbg-matrice-apk-val');
                        if (el) el.textContent = formatApkCode(data.tag_name);
                    }
                }
            } catch (_) {}
            finally {
                window.__fetchingRemoteApk = false;
            }
        })();
    }

    if (panel && isOpen) {
        const infoEl = panel.querySelector('#nk-debug-info');
        const logsEl = panel.querySelector('#nk-debug-logs');
        const apkBtn = panel.querySelector('#nk-dbg-check-apk');
        if (apkBtn) {
            apkBtn.style.display = s.isAndroid ? 'inline-block' : 'none';
        }

        if (infoEl) {
            const otaStatusColor = getOtaColor(s.ota.status);
            const nativeVer = window.__NATIVE_APK_VERSION__ || localStorage.getItem('nk_native_apk_version') || '1.0.79';
            const remoteVer = window.__REMOTE_APK_VERSION__ || localStorage.getItem('nk_remote_apk_version') || 'v1.0.79';

            let platformSpecificDetails = '';
            if (s.isAndroid) {
                platformSpecificDetails = `
                    <div style="margin-top:8px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.12);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <div style="font-size:10px; font-weight:800; color:#38bdf8; letter-spacing:0.05em;">📡 MOUCHARD APPELS NATIFS ANDROID</div>
                            <button id="nk-dbg-refresh-mouchard-btn" style="background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:4px; padding:1px 6px; font-size:9px; font-weight:700; cursor:pointer;">🔄 Rafraîchir</button>
                        </div>
                        <div id="nk-dbg-call-logs-box" style="background:#020617; padding:6px; border-radius:8px; font-family:monospace; font-size:10px; color:#a5f3fc; max-height:120px; overflow-y:auto; white-space:pre-wrap; border:1px solid rgba(56,189,248,0.2); line-height:1.4;">${window.__NATIVE_CALL_LOGS__ || 'En attente de logs natifs...'}</div>
                    </div>
                `;

                // Rafraîchir les logs du mouchard natif Android
                if (!window.__fetchingCallLogs) {
                    window.__fetchingCallLogs = true;
                    (async () => {
                        try {
                            const AppUpdate = await getAppUpdatePlugin();
                            if (AppUpdate) {
                                const res = await AppUpdate.getCallLogs();
                                if (res?.logs && res.logs.trim().length > 0) {
                                    window.__NATIVE_CALL_LOGS__ = res.logs.trim();
                                } else {
                                    window.__NATIVE_CALL_LOGS__ = `ℹ️ Aucun événement natif enregistré pour l'instant.`;
                                }
                                const box = document.getElementById('nk-dbg-call-logs-box');
                                if (box) box.textContent = window.__NATIVE_CALL_LOGS__;
                            }
                        } catch (err) {
                            window.__NATIVE_CALL_LOGS__ = `⚠️ Mouchard non disponible sur cet APK (${err?.message || 'Erreur'}).`;
                            const box = document.getElementById('nk-dbg-call-logs-box');
                            if (box) box.textContent = window.__NATIVE_CALL_LOGS__;
                        }
                        finally {
                            setTimeout(() => { window.__fetchingCallLogs = false; }, 3000);
                        }
                    })();
                }

                // Rafraîchir dynamiquement depuis le PackageManager natif Android (une seule fois)
                if (!window.__NATIVE_APK_VERSION__ && !window.__fetchingNativeVersion) {
                    window.__fetchingNativeVersion = true;
                    (async () => {
                        try {
                            const AppUpdate = await getAppUpdatePlugin();
                            if (AppUpdate) {
                                const nativeInfo = await AppUpdate.getNativeVersion();
                                if (nativeInfo?.versionName) {
                                    window.__NATIVE_APK_VERSION__ = nativeInfo.versionName;
                                    localStorage.setItem('nk_native_apk_version', nativeInfo.versionName);
                                    const el = document.getElementById('nk-dbg-matrice-apk-sub');
                                    if (el) el.innerHTML = `Installé : <b>${formatApkCode(nativeInfo.versionName)}</b>`;
                                }
                            }
                        } catch (_) {}
                        finally {
                            window.__fetchingNativeVersion = false;
                        }
                    })();
                }
            } else if (s.isIos) {
                platformSpecificDetails = `
                    <div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.12); font-size:11px;">
                        <div style="font-size:10px; font-weight:800; color:#38bdf8; letter-spacing:0.05em; margin-bottom:2px;">🍏 ARCHITECTURE APPLE NATIVE</div>
                        <div><b>PushKit & CallKit :</b> Intégrés dans NewKetPushKitHandler.swift</div>
                        <div><b>Live Activities :</b> Intégrées dans LiveActivityPlugin.swift</div>
                    </div>
                `;
            }

            infoEl.innerHTML = `
                <!-- 1. Matrice universelle des versions des autres supports -->
                <div style="margin-bottom:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px;">
                    <div style="font-size:10px; font-weight:800; color:#38bdf8; letter-spacing:0.06em; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span>🌐 VERSIONS DES DIFFÉRENTS SUPPORTS</span>
                        <span style="font-size:9px; color:#94a3b8; font-weight:600;">Ici : <b style="color:#fff;">${s.platform.toUpperCase()}</b></span>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                        <!-- Carte 1 : OTA -->
                        <div style="background:rgba(2,132,199,0.12); border:1px solid rgba(56,189,248,0.25); border-radius:8px; padding:6px 8px;">
                            <div style="font-size:9px; color:#7dd3fc; font-weight:700;">📡 OTA (Supabase)</div>
                            <div style="font-size:13px; font-weight:900; color:#38bdf8;">${formatOtaCode(s.ota.localVersion || s.ota.remoteVersion || s.pkgVer)}</div>
                            <div style="font-size:9px; color:${otaStatusColor}; font-weight:600;">Statut : ${s.ota.status || 'actif'}</div>
                        </div>

                        <!-- Carte 2 : Android APK -->
                        <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); border-radius:8px; padding:6px 8px;">
                            <div style="font-size:9px; color:#6ee7b7; font-weight:700;">🤖 ANDROID (GitHub)</div>
                            <div id="nk-dbg-matrice-apk-val" style="font-size:13px; font-weight:900; color:#10b981;">${formatApkCode(remoteVer)}</div>
                            <div id="nk-dbg-matrice-apk-sub" style="font-size:9px; color:#94a3b8;">${s.isAndroid ? `Installé : <b>${formatApkCode(nativeVer)}</b>` : 'Release GitHub'}</div>
                        </div>

                        <!-- Carte 3 : iOS TestFlight -->
                        <div style="background:rgba(168,85,247,0.12); border:1px solid rgba(168,85,247,0.25); border-radius:8px; padding:6px 8px;">
                            <div style="font-size:9px; color:#d8b4fe; font-weight:700;">🍏 APPLE (TestFlight)</div>
                            <div style="font-size:13px; font-weight:900; color:#c084fc;">${s.isIos ? formatTfCode(window.__NATIVE_IOS_VERSION__ || '1') : 'TF-Non configuré'}</div>
                            <div style="font-size:9px; color:#94a3b8;">${s.isIos ? 'Coque iOS' : 'En attente compte dev'}</div>
                        </div>

                        <!-- Carte 4 : Web / PWA -->
                        <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.25); border-radius:8px; padding:6px 8px;">
                            <div style="font-size:9px; color:#fde68a; font-weight:700;">🌐 WEB / PWA</div>
                            <div style="font-size:13px; font-weight:900; color:#fbbf24;">${formatWebCode(s.pkgVer)}</div>
                            <div style="font-size:9px; color:#94a3b8;">Hôte : ${window.location.hostname}</div>
                        </div>
                    </div>
                    <div id="nk-dbg-apk-feedback" style="font-size:10px; color:#10b981; margin-top:4px;"></div>
                </div>

                <!-- 2. Diagnostic Système de l'App -->
                <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:10px; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:4px;">📱 ÉTAT SYSTÈME</div>
                    <div><b>Environnement :</b> ${s.platform.toUpperCase()} (${s.isCap ? 'Natif Capacitor' : 'Navigateur Web'})</div>
                    <div><b>Supabase Client :</b> ${s.sbOk ? '✅ OK' : '❌ NULL'}</div>
                    <div><b>BackendReady :</b> ${s.bReady ? '✅ true' : '❌ false'}</div>
                    <div><b>Produits :</b> ${s.prodCount} total (${s.pubCount} publics)</div>
                    <div><b>Rôle Auth :</b> ${s.authRole}</div>
                    <div style="margin-top:4px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.08);">
                        <div><b>🔔 Notifications :</b> ${s.notifCount} total (<span style="color:${s.notifUnread > 0 ? '#f87171' : '#4ade80'}; font-weight:bold;">${s.notifUnread} non lues</span>)</div>
                    </div>
                    <div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.12);">
                        <div style="font-size:10px; font-weight:800; color:#38bdf8; letter-spacing:0.05em; margin-bottom:2px;">🧭 ORIENTATION & ÉCRAN</div>
                        <div><b>Mode :</b> ${window.innerWidth > window.innerHeight ? '⚠️ Landscape (Paysage)' : '✅ Portrait'}</div>
                        <div><b>Taille :</b> ${window.innerWidth} x ${window.innerHeight} px</div>
                        <div><b>Overlay Rotation :</b> ${document.getElementById('nk-rotate-device-overlay')?.classList?.contains('is-active') ? '🔴 ACTIF (bloqué)' : '⚪ Inactif'}</div>
                    </div>
                </div>

                <!-- 3. Détails OTA Supabase -->
                <div>
                    <div style="font-size:10px; font-weight:800; color:#94a3b8; letter-spacing:0.05em; margin-bottom:4px;">🔄 DÉTAILS OTA SUPABASE</div>
                    <div><b>Version locale :</b> ${s.ota.localVersion || (s.isCap ? '—' : `${s.pkgVer} (Web)`)}</div>
                    <div><b>Version distante :</b> ${s.ota.remoteVersion || (s.isCap ? '—' : s.pkgVer)}</div>
                    <div><b>Checksum DB :</b> ${s.ota.checksumExpected ? s.ota.checksumExpected.slice(0,20)+'...' : '⚠️ ABSENT'}</div>
                    ${s.ota.error ? `<div style="color:#f87171; font-weight:bold;">❌ Erreur : ${s.ota.error}</div>` : ''}
                    ${s.ota.lastChecked ? `<div style="opacity:0.5; font-size:10px;">Vérifié : ${new Date(s.ota.lastChecked).toLocaleTimeString()}</div>` : ''}
                </div>

                ${platformSpecificDetails}
            `;
        }
        if (logsEl) {
            const countEl = panel.querySelector('#nk-dbg-logs-count');
            if (countEl) countEl.textContent = String(logs.length);
            const tabCountEl = panel.querySelector('#nk-dbg-tab-logs-count');
            if (tabCountEl) tabCountEl.textContent = String(logs.length);

            if (logs.length === 0) {
                logsEl.innerHTML = `<div style="color:#64748b; font-size:11px; text-align:center; padding:24px 0; font-family:monospace;">Aucun log pour le moment...</div>`;
            } else {
                logsEl.innerHTML = logs.map(l => {
                    const badgeBg = l.level === 'error' ? 'rgba(239,68,68,0.25)' : l.level === 'warn' ? 'rgba(245,158,11,0.25)' : 'rgba(148,163,184,0.15)';
                    const badgeColor = l.level === 'error' ? '#fca5a5' : l.level === 'warn' ? '#fcd34d' : '#94a3b8';
                    const textColor = l.level === 'error' ? '#fecaca' : l.level === 'warn' ? '#fef08a' : '#f1f5f9';
                    const fontSize = isLogsExpanded ? '12px' : '11px';
                    return `
                        <div style="margin-bottom:5px; padding:4px 8px; border-radius:6px; background:rgba(255,255,255,0.03); font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:${fontSize}; line-height:1.5; word-break:break-word;">
                            <span style="color:#64748b; font-size:10px;">${l.time}</span>
                            <span style="display:inline-block; margin:0 4px; padding:1px 5px; border-radius:4px; font-size:9px; font-weight:800; background:${badgeBg}; color:${badgeColor};">${l.level.toUpperCase()}</span>
                            <span style="color:${textColor};">${escapeHtml(l.text)}</span>
                        </div>
                    `;
                }).join('');
            }
        }
    }
}

// ── Contrôleur de Visibilité Universel : Mode Diagnostic & Raccourci Secret ──
let _debugStyleEl = null;
function getDebugStyleTag() {
    if (_debugStyleEl) return _debugStyleEl;
    _debugStyleEl = document.getElementById('nk-debug-visibility-style');
    if (!_debugStyleEl && typeof document !== 'undefined' && document.head) {
        _debugStyleEl = document.createElement('style');
        _debugStyleEl.id = 'nk-debug-visibility-style';
        document.head.appendChild(_debugStyleEl);
    }
    return _debugStyleEl;
}

function isDebugActive() {
    try {
        const localOverride = localStorage.getItem('nk_debug_override');
        if (localOverride === 'true') return true;
        if (localOverride === 'false') return false;
    } catch (_) {}
    if (window.ConfigManager && typeof window.ConfigManager.isDebugMode === 'function') {
        return window.ConfigManager.isDebugMode();
    }
    if (window.ConfigManager?.config?.debugMode !== undefined) {
        return Boolean(window.ConfigManager.config.debugMode);
    }
    return false; // Par défaut : PROPRE (mode présentation investisseurs)
}

function syncDebugVisibility() {
    const active = isDebugActive();
    const styleTag = getDebugStyleTag();
    if (styleTag) {
        if (!active) {
            styleTag.textContent = '#nk-debug-pill, #nk-live-activity-test-panel, #nk-vendor-live-activity-panel, #nk-settings-live-activity-section { display: none !important; }';
        } else {
            styleTag.textContent = '#nk-debug-pill { display: flex !important; }';
        }
    }
    if (pill) {
        pill.style.setProperty('display', active ? 'flex' : 'none', 'important');
    }
    if (!active && panel && isOpen) {
        toggleDebugPanel(false);
    }
    const testSelectors = ['#nk-live-activity-test-panel', '#nk-vendor-live-activity-panel', '#nk-settings-live-activity-section'];
    testSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            if (active) {
                el.style.removeProperty('display');
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        });
    });
}
window.syncDebugVisibility = syncDebugVisibility;

// ── Option B : Raccourci Secret (5 taps sur logo ou Ctrl+Alt+D) ───────────────
let _logoTapCount = 0;
let _lastLogoTapTime = 0;
function triggerSecretDebugToggle() {
    const current = isDebugActive();
    const next = !current;
    try {
        localStorage.setItem('nk_debug_override', next ? 'true' : 'false');
    } catch (_) {}
    syncDebugVisibility();
    try {
        window.Capacitor?.Plugins?.Haptics?.notification?.({ type: next ? 'SUCCESS' : 'WARNING' });
    } catch (_) {}
    const msg = next
        ? '🛠️ Mode Diagnostic Déverrouillé (Logs et bancs de test visibles)'
        : '🔒 Mode Diagnostic Masqué (Mode Présentation Pro)';
    if (typeof window.showToast === 'function') {
        window.showToast(msg, next ? 'info' : 'success');
    } else {
        console.log('[NewKet Debug Toggle]', msg);
    }
}

function setupSecretLogoListener() {
    const handleTap = (e) => {
        const logoTarget = e.target.closest('#newket-logo, .brand-logo, [data-brand-logo], img[src*="logo-newket"], img[src*="logo"], .navbar-brand');
        if (!logoTarget) return;
        const now = Date.now();
        if (now - _lastLogoTapTime < 800) {
            _logoTapCount++;
        } else {
            _logoTapCount = 1;
        }
        _lastLogoTapTime = now;
        if (_logoTapCount >= 5) {
            _logoTapCount = 0;
            triggerSecretDebugToggle();
        }
    };
    document.addEventListener('touchend', handleTap, { passive: true });
    document.addEventListener('click', (e) => {
        const logoTarget = e.target.closest('#newket-logo, .brand-logo, [data-brand-logo], img[src*="logo-newket"], img[src*="logo"], .navbar-brand');
        if (!logoTarget) return;
        const now = Date.now();
        if (now - _lastLogoTapTime < 700) {
            _logoTapCount++;
        } else {
            _logoTapCount = 1;
        }
        _lastLogoTapTime = now;
        if (_logoTapCount >= 5) {
            _logoTapCount = 0;
            triggerSecretDebugToggle();
        }
    }, true);

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            triggerSecretDebugToggle();
        }
    });
}

function initDebugOverlay() {
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
        display: none !important;
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
    syncDebugVisibility();
    setupSecretLogoListener();
    window.addEventListener('configUpdated', () => syncDebugVisibility());
    window.addEventListener('debugModeChanged', (e) => {
        if (e && e.detail && e.detail.debugMode !== undefined) {
            try {
                localStorage.setItem('nk_debug_override', e.detail.debugMode ? 'true' : 'false');
            } catch (_) {}
        }
        syncDebugVisibility();
    });
    // Réapplication préventive après chargement des composants asynchrones
    setTimeout(syncDebugVisibility, 500);
    setTimeout(syncDebugVisibility, 1500);
    setTimeout(syncDebugVisibility, 3000);

    // Create modal panel
    panel = document.createElement('div');
    panel.id = 'nk-debug-panel';
    panel.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        z-index: 2147483647 !important;
        background: transparent !important;
        pointer-events: none !important;
        display: none;
        flex-direction: column !important;
        justify-content: flex-end !important;
        align-items: stretch !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
    `;

    panel.innerHTML = `
        <div id="nk-debug-card" style="background:#0f172a; color:#fff; border-top-left-radius:0px; border-top-right-radius:0px; height:100dvh; max-height:100dvh; width:100%; box-sizing:border-box; display:flex; flex-direction:column; box-shadow:0 -10px 40px rgba(0,0,0,0.8); border-top:1px solid rgba(255,255,255,0.18); transition:height 0.2s cubic-bezier(0.2, 0.9, 0.4, 1); overflow:hidden; padding-top:env(safe-area-inset-top, 0px); pointer-events:auto;">
            <!-- Poignée tactile de tirage (Drag Handle) : tirer de haut en bas ou de bas en haut -->
            <div id="nk-dbg-drag-handle" style="width:100%; padding:10px 0 8px; display:flex; justify-content:center; align-items:center; cursor:ns-resize; touch-action:none; -webkit-user-select:none; user-select:none;">
                <div id="nk-dbg-drag-bar" style="width:44px; height:5px; border-radius:999px; background:rgba(255,255,255,0.4); transition:background 0.2s ease, width 0.2s ease;"></div>
            </div>

            <!-- Contenu défilable interne -->
            <div id="nk-debug-card-scroll" style="flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:0 16px calc(24px + env(safe-area-inset-bottom, 20px)); display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; gap:4px; position:sticky; top:0; background:#0f172a; z-index:10;">
                    <h3 style="margin:0; font-size:13px; font-weight:800; color:#38bdf8; white-space:nowrap;">🛠️ Diag</h3>
                    <div style="display:flex; gap:4px; flex-wrap:nowrap; align-items:center;">
                        <button id="nk-dbg-check-apk" style="background:#10b981; color:#0f172a; border:none; border-radius:6px; padding:4px 7px; font-size:10px; font-weight:800; cursor:pointer; white-space:nowrap;">🚀 MàJ APK</button>
                        <button id="nk-dbg-copy-all" style="background:#059669; color:#fff; border:none; border-radius:6px; padding:4px 7px; font-size:10px; font-weight:bold; cursor:pointer; white-space:nowrap;">📋 Copier</button>
                        <button id="nk-dbg-force-fetch" style="background:#2563eb; color:#fff; border:none; border-radius:6px; padding:4px 7px; font-size:10px; font-weight:bold; cursor:pointer; white-space:nowrap;">Forcer</button>
                        <button id="nk-dbg-ota-history" style="background:#7c3aed; color:#fff; border:none; border-radius:6px; padding:4px 6px; font-size:10px; font-weight:bold; cursor:pointer; white-space:nowrap;">📜 OTA</button>
                        <button id="nk-dbg-lock" style="background:rgba(255,255,255,0.08); color:#94a3b8; border:1px solid rgba(255,255,255,0.15); border-radius:8px; width:30px; height:28px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; padding:0; flex-shrink:0; font-size:14px;" title="Épingler la hauteur">🔓</button>
                        <button id="nk-dbg-close" style="background:rgba(239,68,68,0.22); color:#fca5a5; border:1px solid rgba(239,68,68,0.4); border-radius:8px; width:30px; height:28px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; padding:0; flex-shrink:0;" title="Fermer">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <!-- Onglets de bascule : État & Mouchard VS Console Logs -->
                <div style="display:flex; gap:6px; margin-bottom:10px; background:rgba(255,255,255,0.06); padding:3px; border-radius:10px;">
                    <button id="nk-dbg-tab-btn-info" style="flex:1; padding:7px; font-size:11px; font-weight:800; border-radius:8px; border:none; cursor:pointer; background:#0284c7; color:#fff; transition:all 0.15s ease;">📊 État & Mouchard</button>
                    <button id="nk-dbg-tab-btn-logs" style="flex:1; padding:7px; font-size:11px; font-weight:800; border-radius:8px; border:none; cursor:pointer; background:transparent; color:#94a3b8; transition:all 0.15s ease;">💻 Console Logs (<span id="nk-dbg-tab-logs-count">0</span>)</button>
                </div>

                <!-- Onglet 1 : Diagnostic & Mouchard -->
                <div id="nk-debug-info-wrap">
                    <button id="nk-dbg-request-all-perms" style="width:100%; margin-bottom:8px; background:linear-gradient(135deg, #6366f1, #a855f7); color:#fff; border:none; border-radius:12px; padding:10px 14px; font-size:12px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(168,85,247,0.3); display:flex; align-items:center; justify-content:center; gap:8px;">
                        <span>🛡️ Déclencher toutes les autorisations</span>
                    </button>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:10px;">
                        <button id="nk-dbg-test-call-ui" style="background:#0f766e; color:#fff; border:1px solid #14b8a6; border-radius:8px; padding:8px 4px; font-size:10px; font-weight:700; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;" title="Tester l'interface appel in-app">
                            <span>📞 Test In-App</span>
                        </button>
                        <button id="nk-dbg-test-native-fullscreen" style="background:#0284c7; color:#fff; border:1px solid #38bdf8; border-radius:8px; padding:8px 4px; font-size:10px; font-weight:700; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;" title="Tester le réveil plein écran et Heads-up (délai 5s pour verrouiller)">
                            <span>🚨 Plein Écran (5s)</span>
                        </button>
                        <button id="nk-dbg-test-fcm-call" style="background:#b45309; color:#fff; border:1px solid #f59e0b; border-radius:8px; padding:8px 4px; font-size:10px; font-weight:700; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;" title="Envoyer un vrai push (FCM sous Android / VoIP sous iOS) avec 3s de délai pour verrouiller l'écran">
                            <span>🔔 Push (3s)</span>
                        </button>
                    </div>
                    <div id="nk-debug-info" style="font-size:11px; line-height:1.6; margin-bottom:10px; background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);"></div>
                </div>

                <!-- Onglet 2 : Console Logs Noir Dédié -->
                <div id="nk-debug-logs-wrap" style="display:none; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:11px; font-weight:800; color:#38bdf8; letter-spacing:0.04em;">LOGS CONSOLE EN DIRECT</span>
                            <span id="nk-dbg-logs-count" style="background:rgba(255,255,255,0.1); color:#38bdf8; font-size:9px; font-weight:700; padding:1px 6px; border-radius:999px;">0</span>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button id="nk-dbg-copy-logs-only" style="background:#1e293b; color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:8px; padding:4px 9px; font-size:10px; font-weight:700; cursor:pointer;">📋 Copier Logs</button>
                            <button id="nk-dbg-clear-logs" style="background:rgba(239,68,68,0.15); color:#fca5a5; border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:4px 8px; font-size:10px; font-weight:700; cursor:pointer;" title="Vider les logs">🗑️</button>
                        </div>
                    </div>
                    <div id="nk-debug-logs" style="background:#020617; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.12); height:55vh; max-height:60vh; overflow-y:auto; -webkit-overflow-scrolling:touch;"></div>
                </div>
            </div>
        </div>
    `;

    // ── Gestion des Onglets Diag ──────────────────────────────────────────────
    let activeTab = 'info'; // 'info' | 'logs'
    function switchTab(tab) {
        activeTab = tab;
        const infoWrap = panel.querySelector('#nk-debug-info-wrap');
        const logsWrap = panel.querySelector('#nk-debug-logs-wrap');
        const btnInfo = panel.querySelector('#nk-dbg-tab-btn-info');
        const btnLogs = panel.querySelector('#nk-dbg-tab-btn-logs');

        if (tab === 'info') {
            if (infoWrap) infoWrap.style.display = 'block';
            if (logsWrap) logsWrap.style.display = 'none';
            if (btnInfo) { btnInfo.style.background = '#0284c7'; btnInfo.style.color = '#fff'; }
            if (btnLogs) { btnLogs.style.background = 'transparent'; btnLogs.style.color = '#94a3b8'; }
        } else {
            if (infoWrap) infoWrap.style.display = 'none';
            if (logsWrap) logsWrap.style.display = 'flex';
            if (btnInfo) { btnInfo.style.background = 'transparent'; btnInfo.style.color = '#94a3b8'; }
            if (btnLogs) { btnLogs.style.background = '#0284c7'; btnLogs.style.color = '#fff'; }
        }
        updatePanel();
    }

    panel.querySelector('#nk-dbg-tab-btn-info')?.addEventListener('click', () => switchTab('info'));
    panel.querySelector('#nk-dbg-tab-btn-logs')?.addEventListener('click', () => switchTab('logs'));

    panel.querySelector('#nk-dbg-clear-logs')?.addEventListener('click', () => {
        logs.length = 0;
        updatePanel();
    });

    panel.querySelector('#nk-dbg-copy-logs-only')?.addEventListener('click', async () => {
        const text = logs.slice().reverse().map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.text}`).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            const btn = panel.querySelector('#nk-dbg-copy-logs-only');
            if (btn) btn.textContent = '✅ Copié !';
            setTimeout(() => { if (btn) btn.textContent = '📋 Copier Logs'; }, 2000);
        } catch (_) {}
    });

    // Click-outside removed: panel is now pointer-events:none (passthrough)

    panel.querySelector('#nk-dbg-close').addEventListener('click', () => toggleDebugPanel(false));

    // ── Bouton lock / unlock ───────────────────────────────────────────────────
    let isPanelLocked = false;
    try { isPanelLocked = localStorage.getItem('nk_debug_lock') === '1'; } catch(_) {}

    const lockBtn = panel.querySelector('#nk-dbg-lock');
    function updateLockBtn() {
        if (!lockBtn) return;
        lockBtn.textContent = isPanelLocked ? '🔒' : '🔓';
        lockBtn.title = isPanelLocked ? 'Épinglé (clic pour libérer)' : 'Libre Apple Music (clic pour épingler)';
        lockBtn.style.color = isPanelLocked ? '#38bdf8' : '#94a3b8';
        lockBtn.style.borderColor = isPanelLocked ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.15)';
        lockBtn.style.background = isPanelLocked ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.08)';
    }
    updateLockBtn();
    lockBtn?.addEventListener('click', () => {
        isPanelLocked = !isPanelLocked;
        try { localStorage.setItem('nk_debug_lock', isPanelLocked ? '1' : '0'); } catch(_) {}
        updateLockBtn();

        // Si on passe en mode DÉCADENASSÉ (🔓) : TOP DIRECT (100% plein écran) !
        if (!isPanelLocked && card) {
            card.style.transition = 'height 0.25s cubic-bezier(0.2, 0.9, 0.4, 1), border-radius 0.2s ease';
            card.style.height = '100dvh';
            card.style.borderTopLeftRadius = '0px';
            card.style.borderTopRightRadius = '0px';
            try { localStorage.setItem('nk_debug_panel_height', '100dvh'); } catch(_) {}
        }
    });

    // ── Poignée de réglage de hauteur libre ("caler partout") ─────────────
    const card = panel.querySelector('#nk-debug-card');
    const handle = panel.querySelector('#nk-dbg-drag-handle');
    const bar = panel.querySelector('#nk-dbg-drag-bar');
    let isResizing = false;
    let sheetDragStartY = 0;
    let startCardH = 0;

    function startResize(clientY) {
        if (!card) return;
        isResizing = true;
        sheetDragStartY = clientY;
        startCardH = card.getBoundingClientRect().height || window.innerHeight;
        card.style.transition = 'none';
        if (bar) {
            bar.style.background = '#38bdf8';
            bar.style.width = '52px';
        }
    }

    function moveResize(clientY) {
        if (!isResizing || !card) return;
        const deltaY = sheetDragStartY - clientY; // Vers le haut = agrandit, vers le bas = rétrécit
        let newH = startCardH + deltaY;
        const minH = 100;
        const maxH = window.innerHeight;
        newH = Math.max(minH, Math.min(maxH, newH));
        card.style.height = `${newH}px`;
        if (newH >= window.innerHeight - 20) {
            card.style.borderTopLeftRadius = '0px';
            card.style.borderTopRightRadius = '0px';
        } else {
            card.style.borderTopLeftRadius = '24px';
            card.style.borderTopRightRadius = '24px';
        }
    }

    function endResize() {
        if (!isResizing || !card) return;
        isResizing = false;
        card.style.transition = 'height 0.2s cubic-bezier(0.2, 0.9, 0.4, 1)';
        if (bar) {
            bar.style.background = 'rgba(255,255,255,0.4)';
            bar.style.width = '44px';
        }
        const currentH = card.getBoundingClientRect().height;
        const dragDistance = startCardH - currentH; // positif = tiré vers le bas

        if (isPanelLocked) {
            // 🔒 Mode épinglé : ferme seulement si quasi tout en bas
            if (currentH < 120) {
                toggleDebugPanel(false);
            } else if (currentH >= window.innerHeight - 25) {
                card.style.height = '100dvh';
                card.style.borderTopLeftRadius = '0px';
                card.style.borderTopRightRadius = '0px';
                try { localStorage.setItem('nk_debug_panel_height', '100dvh'); } catch (_) {}
            } else {
                // Reste EXACTEMENT là où le doigt l'a calé !
                card.style.height = `${currentH}px`;
                try { localStorage.setItem('nk_debug_panel_height', `${currentH}px`); } catch (_) {}
            }
        } else {
            // 🔓 Mode Décadenassé (Apple Music) : STRICTEMENT BINAIRE (0% ou 100%)
            // Si on glisse vers le bas (> 40px ou hauteur baissée), fermeture immédiate animée vers 0
            if (dragDistance > 40 || currentH < window.innerHeight - 80) {
                card.style.transition = 'height 0.18s cubic-bezier(0.2, 0.9, 0.4, 1)';
                card.style.height = '0px';
                setTimeout(() => {
                    toggleDebugPanel(false);
                }, 180);
            } else {
                // Annulé ou repoussé vers le haut -> rebond propre à 100% Top
                card.style.height = '100dvh';
                card.style.borderTopLeftRadius = '0px';
                card.style.borderTopRightRadius = '0px';
            }
        }
    }

    handle?.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) startResize(e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (isResizing && e.touches.length === 1) moveResize(e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchend', endResize);

    // Support souris (Web desktop)
    handle?.addEventListener('mousedown', (e) => {
        startResize(e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
        if (isResizing) moveResize(e.clientY);
    });
    window.addEventListener('mouseup', endResize);

    panel.querySelector('#nk-dbg-check-apk')?.addEventListener('click', async () => {
        const btn = panel.querySelector('#nk-dbg-check-apk');
        const feedback = panel.querySelector('#nk-dbg-apk-feedback');
        btn.disabled = true;
        btn.textContent = '⏳ Check...';
        if (feedback) feedback.textContent = 'Appel API GitHub Releases...';

        try {
            const { checkForUpdate, showUpdateModal } = await import('./app-update.js');
            const res = await checkForUpdate({ force: true });
            if (res.available) {
                btn.textContent = '🚀 Dispo !';
                if (feedback) feedback.textContent = `Nouvelle version ${res.remoteVersion} prête !`;
                toggleDebugPanel(false);
                showUpdateModal(res);
            } else if (res.reason === 'up-to-date') {
                btn.textContent = '✅ À jour';
                if (feedback) feedback.textContent = `Votre APK (${formatApkCode(res.localVersion || '1.0.79')}) est à jour.`;
                const elRem = document.getElementById('nk-dbg-matrice-apk-val');
                if (elRem && res.remoteVersion) elRem.textContent = formatApkCode(res.remoteVersion);
                const elSub = document.getElementById('nk-dbg-matrice-apk-sub');
                if (elSub && res.localVersion) elSub.innerHTML = `Installé : <b>${formatApkCode(res.localVersion)}</b>`;
            } else {
                btn.textContent = 'ℹ️ ' + (res.reason || 'OK');
                if (feedback) feedback.textContent = 'Statut : ' + res.reason;
            }
        } catch (err) {
            btn.textContent = '❌ Erreur';
            if (feedback) feedback.textContent = err.message;
        } finally {
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = '🚀 MàJ APK';
            }, 3000);
        }
    });

    panel.querySelector('#nk-dbg-copy-all').addEventListener('click', async () => {
        const s = getDiagnosticState();

        let nativeCallLogs = '';
        try {
            const AppUpdate = await getAppUpdatePlugin();
            if (AppUpdate) {
                const res = await AppUpdate.getCallLogs();
                if (res && res.logs) {
                    nativeCallLogs = res.logs;
                }
            }
        } catch (_) {}

        const fullText = [
            `=== NewKet Diagnostic (OTA: ${formatOtaCode(s.ota.localVersion || s.pkgVer)}) ===`,
            `Date: ${new Date().toISOString()}`,
            ``,
            `--- VERSIONS SUPPORTS ---`,
            `OTA (Supabase): ${formatOtaCode(s.ota.localVersion || s.pkgVer)} (statut: ${s.ota.status || 'actif'})`,
            `Android (GitHub): ${formatApkCode(window.__REMOTE_APK_VERSION__ || localStorage.getItem('nk_remote_apk_version') || '1.0.79')}${s.isAndroid ? ` | Installé: ${formatApkCode(window.__NATIVE_APK_VERSION__ || localStorage.getItem('nk_native_apk_version') || '1.0.79')}` : ''}`,
            `iOS (TestFlight): ${s.isIos ? formatTfCode(window.__NATIVE_IOS_VERSION__ || '1') : 'TF-Non configuré'}`,
            `Web / PWA: ${formatWebCode(s.pkgVer)}`,
            ``,
            `--- APP ---`,
            `Capacitor: ${s.isCap ? 'OUI' : 'NON'} (${window.location.protocol}//${window.location.hostname})`,
            `BackendReady: ${s.bReady}`,
            `Supabase Client: ${s.sbOk ? 'OK' : 'NULL'}`,
            `Produits: ${s.prodCount} total (${s.pubCount} publics)`,
            `Rôle Auth: ${s.authRole}`,
            ``,
            `--- APPELS NATIFS (MOUCHARD ANDROID) ---`,
            nativeCallLogs ? nativeCallLogs.trim() : 'Aucun log natif enregistré ou non-disponible sur cette plateforme.',
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

    // ── Bouton 1 : Test UI Appel In-App ─────────────────────────────────────────
    panel.querySelector('#nk-dbg-test-call-ui')?.addEventListener('click', () => {
        console.log('[Debug] 📞 Déclenchement test UI appel plein écran in-app...');
        toggleDebugPanel(false);
        window.dispatchEvent(new CustomEvent('newket:trigger_test_call', {
            detail: {
                callerName: 'Livreur Test NewKet',
                callerAvatar: '',
                orderId: 'CMD-TEST-78',
                role: 'vendor'
            }
        }));
    });

    // ── Bouton 2 : Test Réveil Plein Écran & Heads-up (Natif / Délai 5s pour verrouiller) ──
    panel.querySelector('#nk-dbg-test-native-fullscreen')?.addEventListener('click', async () => {
        const btn = panel.querySelector('#nk-dbg-test-native-fullscreen');
        if (!btn) return;
        btn.disabled = true;
        console.log('[Debug] 🚨 Démarrage du test Plein Écran / Heads-Up (5s pour verrouiller votre écran)...');

        let countdown = 5;
        btn.textContent = `⏳ ${countdown}s`;
        btn.style.background = '#dc2626';

        // Fermer le panneau après 1.5s pour que l'utilisateur puisse verrouiller l'écran
        setTimeout(() => {
            toggleDebugPanel(false);
        }, 1500);

        const timer = setInterval(async () => {
            countdown--;
            if (countdown > 0) {
                btn.textContent = `⏳ ${countdown}s`;
            } else {
                clearInterval(timer);
                btn.textContent = '🔔 DÉCLENCHÉ !';
                btn.style.background = '#10b981';

                console.log('[Debug] 🚀 Exécution du test Plein Écran / Heads-Up...');

                // 1. Tenter le déclencheur natif Java via AppUpdatePlugin (si présent dans l'APK)
                try {
                    const AppUpdate = await getAppUpdatePlugin();
                    if (AppUpdate && typeof AppUpdate.triggerNativeCallTest === 'function') {
                        await AppUpdate.triggerNativeCallTest();
                        console.log('[Debug] ✅ triggerNativeCallTest exécuté avec succès côté Java natif.');
                    } else {
                        console.log('[Debug] ℹ️ triggerNativeCallTest non présent dans cet APK (nécessite APK v1.0.78).');
                    }
                } catch (e) {
                    console.warn('[Debug] ⚠️ triggerNativeCallTest erreur:', e.message);
                }

                // 2. Déclencher l'UI in-app plein écran (JavaScript)
                window.dispatchEvent(new CustomEvent('newket:trigger_test_call', {
                    detail: {
                        callerName: 'Livreur Test NewKet (Plein Écran)',
                        callerAvatar: '',
                        orderId: 'CMD-HEADS-UP',
                        role: 'vendor'
                    }
                }));

                // 3. Tenter une notification système locale
                if ('Notification' in window && Notification.permission === 'granted') {
                    try {
                        new Notification('📞 Appel de Livreur Test NewKet', {
                            body: 'Appel vocal entrant • Commande #CMD-HEADS-UP',
                            icon: '/favicon.ico',
                            tag: 'test-call-notification',
                            requireInteraction: true,
                        });
                    } catch (_) {}
                }

                setTimeout(() => {
                    btn.disabled = false;
                    btn.textContent = '🚨 Plein Écran (5s)';
                    btn.style.background = '#0284c7';
                }, 3000);
            }
        }, 1000);
    });

    // ── Bouton 3 : Test Réveil FCM (Envoi immédiat au serveur avec délai 3.5s) ──
    panel.querySelector('#nk-dbg-test-fcm-call')?.addEventListener('click', async () => {
        const btn = panel.querySelector('#nk-dbg-test-fcm-call');
        btn.disabled = true;

        try {
            const client = window.supabaseClient || window.Supabase?.client;
            let token = null;
            let userId = null;

            try {
                const sessionData = await client?.auth?.getSession();
                token = sessionData?.data?.session?.access_token || null;
                userId = sessionData?.data?.session?.user?.id || null;
            } catch (_) {}

            if (!token || !userId) {
                try {
                    const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                    if (sbKey) {
                        const parsed = JSON.parse(localStorage.getItem(sbKey) || '{}');
                        token = token || parsed?.access_token || null;
                        userId = userId || parsed?.user?.id || null;
                    }
                } catch (_) {}
            }

            if (!userId) {
                userId = localStorage.getItem('newketUserId') || null;
            }

            if (!userId) {
                alert('Vous devez être connecté pour recevoir un push FCM.');
                btn.disabled = false;
                return;
            }

            btn.textContent = '🚀 Envoi au serveur...';
            console.log(`[Debug] 🔔 Envoi requête push FCM (délai serveur 3.5s) pour user ${userId}...`);

            const isCap = typeof window !== 'undefined' && (window.location?.protocol === 'capacitor:' || !!window.Capacitor?.isNativePlatform?.());
            const apiBase = typeof window.getApiBaseUrl === 'function' ? window.getApiBaseUrl() : (isCap ? 'https://newket.vercel.app/api' : '/api');
            const url = apiBase.replace(/\/$/, '') + '/push/call-ring';

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    target_user_id: userId,
                    caller_name: 'Test Réveil Écran',
                    order_id: 'TEST-REVEIL',
                    caller_avatar: '',
                    delay_ms: 3500 // Le serveur attend 3.5s avant de propager FCM !
                })
            });

            const data = await res.json().catch(() => ({}));
            console.log('[Debug] 📩 Réponse serveur FCM:', res.status, JSON.stringify(data));

            if (!res.ok) {
                btn.textContent = '❌ Erreur ' + res.status;
                btn.style.background = '#dc2626';
                alert('Erreur serveur (' + res.status + '): ' + (data.error || 'Échec'));
                setTimeout(() => {
                    btn.disabled = false;
                    btn.textContent = '🔔 Push (3s)';
                    btn.style.background = '#b45309';
                }, 3000);
                return;
            }

            const pushCount = (data.fcm_sent || 0) + (data.voip_sent || 0);
            if (pushCount === 0) {
                btn.textContent = '⚠️ 0 push envoyé';
                btn.style.background = '#ea580c';
                alert('⚠️ Le serveur a répondu 200 OK mais aucun push n\'a été envoyé (fcm_sent=0, voip_sent=0). Vérifiez que votre appareil a un token actif.');
                setTimeout(() => {
                    btn.disabled = false;
                    btn.textContent = '🔔 Push (3s)';
                    btn.style.background = '#b45309';
                }, 3000);
                return;
            }

            const label = data.voip_sent > 0 ? `🔒 ${data.voip_sent} VoIP envoyé !` : `🔒 ${data.fcm_sent} push envoyé !`;
            btn.textContent = `${label} Verrouille !`;
            btn.style.background = '#10b981';

            // Fermer le panneau après 1s pour que l'utilisateur soit sur l'écran et puisse verrouiller
            setTimeout(() => {
                toggleDebugPanel(false);
            }, 1000);

            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = '🔔 Push (3s)';
                btn.style.background = '#b45309';
            }, 6000);

        } catch (err) {
            console.error('[Debug] ❌ Erreur déclenchement push:', err);
            alert('Erreur: ' + err.message);
            btn.disabled = false;
            btn.textContent = '🔔 Push (3s)';
        }
    });

    // ── Rafraîchir manuellement le mouchard d'appels natifs ──────────────────
    panel.addEventListener('click', async (e) => {
        if (e.target && (e.target.id === 'nk-dbg-refresh-mouchard-btn' || e.target.closest('#nk-dbg-refresh-mouchard-btn'))) {
            const btn = panel.querySelector('#nk-dbg-refresh-mouchard-btn');
            const box = panel.querySelector('#nk-dbg-call-logs-box');
            if (btn) btn.textContent = '⏳ ...';
            try {
                const AppUpdate = await getAppUpdatePlugin();
                if (AppUpdate) {
                    const res = await AppUpdate.getCallLogs();
                    if (res?.logs) {
                        window.__NATIVE_CALL_LOGS__ = res.logs.trim();
                        if (box) box.textContent = window.__NATIVE_CALL_LOGS__;
                        console.log('[NewKet CallDiag] 📱 Logs natifs rechargés:\n' + window.__NATIVE_CALL_LOGS__);
                    }
                }
            } catch (err) {
                if (box) box.textContent = 'Erreur: ' + err.message;
            } finally {
                if (btn) btn.textContent = '🔄 Rafraîchir';
            }
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

function getBottomNavHeight() {
    const nav = document.getElementById('mobileBottomNav');
    if (nav && window.getComputedStyle(nav).display !== 'none') {
        return nav.offsetHeight || 62;
    }
    return 0;
}

function toggleDebugPanel(force) {
    isOpen = typeof force === 'boolean' ? force : !isOpen;
    if (panel) {
        if (isOpen) {
            // Masquer la tabbar HTML (Android / Web) — forcer via style inline !important
            const htmlNav = document.getElementById('mobileBottomNav');
            if (htmlNav) {
                htmlNav.dataset.debugHidden = '1';
                htmlNav.setAttribute('style', (htmlNav.getAttribute('style') || '') + '; display: none !important; visibility: hidden !important; pointer-events: none !important;');
            }

            // Sur iOS : masquer aussi la NativeTabBar native ET les boutons Liquid Glass (Burger / Recherche / Bouton Close natif)
            try {
                window.Capacitor?.Plugins?.NativeTabBar?.hide?.().catch(() => {});
                window.Capacitor?.Plugins?.NativeHeaderButtons?.hide?.().catch(() => {});
                window.Capacitor?.Plugins?.NativeHeaderButtons?.hideClose?.().catch(() => {});
            } catch (_) {}

            panel.style.setProperty('display', 'flex', 'important');
            panel.style.setProperty('bottom', '0px', 'important');
            panel.style.setProperty('top', '0px', 'important');
            panel.style.setProperty('height', '100dvh', 'important');
            panel.style.setProperty('justify-content', 'flex-end', 'important');

            // Initialiser ou restaurer la hauteur du volet (plein écran par défaut)
            const card = panel.querySelector('#nk-debug-card');
            if (card) {
                let isLocked = false;
                try { isLocked = localStorage.getItem('nk_debug_lock') === '1'; } catch(_) {}
                // En mode 🔓 (décadenassé) : STRICTEMENT 100dvh (jamais de hauteur partielle)
                const savedH = isLocked ? (localStorage.getItem('nk_debug_panel_height') || '100dvh') : '100dvh';
                card.style.transition = 'none';
                card.style.height = savedH;
                if (savedH === '100dvh') {
                    card.style.borderTopLeftRadius = '0px';
                    card.style.borderTopRightRadius = '0px';
                } else {
                    card.style.borderTopLeftRadius = '24px';
                    card.style.borderTopRightRadius = '24px';
                }
            }
        } else {
            panel.style.setProperty('display', 'none', 'important');

            // Restaurer la tabbar HTML (Android / Web)
            const htmlNav = document.getElementById('mobileBottomNav');
            if (htmlNav && htmlNav.dataset.debugHidden === '1') {
                // Supprimer les styles forcés et restaurer le style original
                const currentStyle = htmlNav.getAttribute('style') || '';
                const cleaned = currentStyle
                    .replace(/;?\s*display\s*:[^;]*/gi, '')
                    .replace(/;?\s*visibility\s*:[^;]*/gi, '')
                    .replace(/;?\s*pointer-events\s*:[^;]*/gi, '')
                    .trim();
                htmlNav.setAttribute('style', cleaned);
                delete htmlNav.dataset.debugHidden;
            }

            // Sur iOS : restaurer la NativeTabBar et les boutons Liquid Glass (Burger / Recherche)
            try {
                if (window.ComponentsLoader && typeof window.ComponentsLoader.syncNativeTabBarVisibility === 'function') {
                    window.ComponentsLoader.syncNativeTabBarVisibility();
                } else {
                    window.Capacitor?.Plugins?.NativeTabBar?.show?.().catch(() => {});
                }
                if (window.ComponentsLoader && typeof window.ComponentsLoader.syncNativeHeaderButtons === 'function') {
                    window.ComponentsLoader.syncNativeHeaderButtons();
                } else {
                    window.Capacitor?.Plugins?.NativeHeaderButtons?.show?.().catch(() => {});
                }
            } catch (_) {}
        }
        updatePanel();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebugOverlay);
} else {
    initDebugOverlay();
}
