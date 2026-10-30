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

    return { version, pkgVer, isCap, bReady, prodCount, pubCount, sbOk, authRole };
}

function updatePanel() {
    if (!pill) return;
    const s = getDiagnosticState();
    pill.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${s.bReady && s.pubCount > 0 ? '#10b981' : '#ef4444'}; margin-right:6px;"></span>
        <b>v${s.pkgVer}</b> | Prd: ${s.pubCount}/${s.prodCount} | Rdy: ${s.bReady ? 'OUI' : 'NON'}
    `;

    if (panel && isOpen) {
        const infoEl = panel.querySelector('#nk-debug-info');
        const logsEl = panel.querySelector('#nk-debug-logs');
        if (infoEl) {
            infoEl.innerHTML = `
                <div><b>Capacitor :</b> ${s.isCap ? '✅ OUI' : '❌ NON'} (${window.location.protocol}//${window.location.hostname})</div>
                <div><b>BackendReady :</b> ${s.bReady ? '✅ true' : '❌ false'}</div>
                <div><b>Supabase Client :</b> ${s.sbOk ? '✅ OK' : '❌ NULL'}</div>
                <div><b>Produits chargés :</b> ${s.prodCount} (Publics: ${s.pubCount})</div>
                <div><b>Rôle Auth :</b> ${s.authRole}</div>
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

    // Create floating pill
    pill = document.createElement('div');
    pill.id = 'nk-debug-pill';
    pill.style.cssText = `
        position: fixed;
        bottom: calc(84px + env(safe-area-inset-bottom, 0px));
        left: calc(12px + env(safe-area-inset-left, 0px));
        z-index: 999999;
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
    `;

    pill.addEventListener('click', toggleDebugPanel);
    document.body.appendChild(pill);

    // Create modal panel
    panel = document.createElement('div');
    panel.id = 'nk-debug-panel';
    panel.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 1000000;
        background: rgba(0, 0, 0, 0.7);
        display: none;
        flex-direction: column;
        justify-content: flex-end;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    `;

    panel.innerHTML = `
        <div style="background:#0f172a; color:#fff; border-top-left-radius:24px; border-top-right-radius:24px; padding:20px; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 -10px 30px rgba(0,0,0,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                <h3 style="margin:0; font-size:14px; font-weight:800; color:#38bdf8;">🛠️ NewKet Live Diagnostic</h3>
                <div style="display:flex; gap:8px;">
                    <button id="nk-dbg-force-fetch" style="background:#2563eb; color:#fff; border:none; border-radius:8px; padding:4px 10px; font-size:11px; font-weight:bold; cursor:pointer;">Forcer Fetch</button>
                    <button id="nk-dbg-close" style="background:rgba(255,255,255,0.1); color:#fff; border:none; border-radius:8px; padding:4px 10px; font-size:11px; cursor:pointer;">Fermer</button>
                </div>
            </div>
            <div id="nk-debug-info" style="font-size:11px; line-height:1.6; margin-bottom:12px; background:rgba(255,255,255,0.05); padding:10px; border-radius:12px;"></div>
            <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin-bottom:6px;">Console Logs (temps réel) :</div>
            <div id="nk-debug-logs" style="flex:1; overflow-y:auto; background:#020617; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); max-height:350px;"></div>
        </div>
    `;

    panel.querySelector('#nk-dbg-close').addEventListener('click', () => toggleDebugPanel(false));
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

    setInterval(updatePanel, 1500);
    updatePanel();
}

function toggleDebugPanel(force) {
    isOpen = typeof force === 'boolean' ? force : !isOpen;
    if (panel) {
        panel.style.display = isOpen ? 'flex' : 'none';
        updatePanel();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebugOverlay);
} else {
    initDebugOverlay();
}
