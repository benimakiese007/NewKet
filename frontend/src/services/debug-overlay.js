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
        if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch (_) { return String(a); }
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
    const metaVer = document.querySelector('meta[name="newket-version"]')?.content || '';
    const pkgVer = metaVer ? metaVer.split('-')[0] : (window.newketVersion || '1.0.11');
    const isCap = typeof window.isNativeCapacitor === 'function' ? window.isNativeCapacitor() : (window.location?.protocol === 'capacitor:');
    const bReady = window.newketBackendReady;
    const prodCount = window.ProductManager?.products?.length ?? 'N/A';
    const pubCount = window.ProductManager?.getPublicProducts?.()?.length ?? 'N/A';
    const sbOk = !!window.supabaseClient;
    const authRole = window.AuthManager?.role || 'visiteur';
    const ota = window._otaState || {};

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

    // Show debug pill only if explicitly requested (?debug=1 or localStorage.nk_debug = '1')
    const isDebugRequested = window.location.search.includes('debug=1') || localStorage.getItem('nk_debug') === '1';
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; gap:8px;">
                <h3 style="margin:0; font-size:14px; font-weight:800; color:#38bdf8; white-space:nowrap;">🛠️ Diagnostic</h3>
                <div style="display:flex; gap:6px; flex-wrap:nowrap;">
                    <button id="nk-dbg-copy-all" style="background:#059669; color:#fff; border:none; border-radius:8px; padding:6px 10px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;">📋 Tout copier</button>
                    <button id="nk-dbg-force-fetch" style="background:#2563eb; color:#fff; border:none; border-radius:8px; padding:6px 10px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;">Forcer</button>
                    <button id="nk-dbg-close" style="background:rgba(255,255,255,0.15); color:#fff; border:none; border-radius:8px; padding:6px 10px; font-size:11px; font-weight:bold; cursor:pointer;">✕</button>
                </div>
            </div>
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
