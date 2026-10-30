/**
 * NewKet — Self-Hosted OTA Updater (Supabase + Capgo Native Plugin)
 * ================================================================
 * 100% Gratuit, illimité et indépendant des serveurs payants Capgo Cloud.
 */

import { Capacitor } from '@capacitor/core';

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY';

// Mode silencieux : aucune notification visuelle intrusive n'est affichée à l'utilisateur.
function showToast() {}

function compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;
    const p1 = String(v1).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const p2 = String(v2).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(p1.length, p2.length);
    for (let i = 0; i < maxLen; i++) {
        const num1 = p1[i] || 0;
        const num2 = p2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

// ── OTA State (exposé globalement pour le debug overlay) ─────────────────────
window._otaState = {
    status: 'idle',       // idle | checking | up-to-date | downloading | applying | error
    localVersion: null,
    remoteVersion: null,
    checksumExpected: null,
    error: null,
    lastChecked: null,
};

function otaLog(level, ...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console[level](...args);
    window._otaState.lastLog = `[${new Date().toLocaleTimeString()}] ${msg}`;
    window.dispatchEvent(new CustomEvent('otaStateChanged'));
}

async function fetchLatestVersion() {
    const url = `${SUPABASE_URL}/rest/v1/app_versions?is_active=eq.true&channel=eq.production&order=created_at.desc&limit=1&select=version,bundle_url,checksum,min_native_version`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Accept': 'application/json'
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.[0] || null;
}

export async function initCapgoUpdater() {
    const isNative = Capacitor.isNativePlatform();
    window._otaState.status = isNative ? 'checking' : 'non-natif';
    if (!isNative) {
        otaLog('log', '[NewKet OTA] Non-natif (web/localhost) — OTA désactivé.');
        return;
    }

    try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

        // 1. Confirmer au moteur natif que le JS actuel est vivant (anti-rollback)
        const currentInfo = await CapacitorUpdater.notifyAppReady();
        const currentVersion = currentInfo?.bundle?.version || '1.0.0';
        window._otaState.localVersion = currentVersion;
        otaLog('log', `[NewKet OTA] ✅ notifyAppReady() OK — Version active : ${currentVersion}`);

        // 2. Vérification silencieuse 3s après démarrage
        setTimeout(async () => {
            try {
                window._otaState.status = 'checking';
                window._otaState.lastChecked = new Date().toISOString();
                window.dispatchEvent(new CustomEvent('otaStateChanged'));

                const latestRelease = await fetchLatestVersion();
                if (!latestRelease?.bundle_url) {
                    window._otaState.status = 'error';
                    window._otaState.error = 'Pas de bundle actif en DB';
                    otaLog('warn', '[NewKet OTA] ❌ Aucune version active trouvée en DB.');
                    return;
                }

                window._otaState.remoteVersion = latestRelease.version;
                window._otaState.checksumExpected = latestRelease.checksum || null;
                otaLog('log', `[NewKet OTA] DB → Distante: ${latestRelease.version} | Locale: ${currentVersion} | Checksum DB: ${latestRelease.checksum ? latestRelease.checksum.slice(0,16)+'...' : 'ABSENT ⚠️'}`);

                if (compareVersions(latestRelease.version, currentVersion) <= 0) {
                    window._otaState.status = 'up-to-date';
                    otaLog('log', `[NewKet OTA] ✅ Déjà à jour (v${currentVersion})`);
                    window.dispatchEvent(new CustomEvent('otaStateChanged'));
                    return;
                }

                window._otaState.status = 'downloading';
                window.dispatchEvent(new CustomEvent('otaStateChanged'));
                showToast(`🔄 Mise à jour v${latestRelease.version} en cours...`, '#0284c7');

                let checksum = latestRelease.checksum;
                if (!checksum) {
                    try {
                        otaLog('warn', '[NewKet OTA] ⚠️ Checksum absent en DB — calcul à la volée (lent)...');
                        const resp = await fetch(latestRelease.bundle_url);
                        const buf = await resp.arrayBuffer();
                        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
                        checksum = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
                        window._otaState.checksumExpected = checksum;
                        otaLog('log', '[NewKet OTA] ✅ Checksum calculé en fallback:', checksum.slice(0,16)+'...');
                    } catch (e) {
                        otaLog('warn', '[NewKet OTA] ❌ Échec calcul checksum:', e?.message);
                    }
                }

                const downloadOptions = {
                    url: latestRelease.bundle_url,
                    version: latestRelease.version
                };
                if (checksum) {
                    downloadOptions.checksum = checksum;
                } else {
                    otaLog('error', '[NewKet OTA] ❌ AUCUN CHECKSUM — le plugin iOS va rejeter le bundle!');
                }

                otaLog('log', `[NewKet OTA] 📥 Téléchargement → ${latestRelease.bundle_url}`);
                const bundle = await CapacitorUpdater.download(downloadOptions);
                otaLog('log', `[NewKet OTA] ✅ Bundle téléchargé — id: ${bundle?.id}`);

                if (bundle?.id) {
                    window._otaState.status = 'applying';
                    window.dispatchEvent(new CustomEvent('otaStateChanged'));
                    showToast(`✅ v${latestRelease.version} prête, application...`, '#16a34a');
                    await CapacitorUpdater.set({ id: bundle.id });
                }
            } catch (err) {
                window._otaState.status = 'error';
                window._otaState.error = err?.message || 'Erreur inconnue';
                window.dispatchEvent(new CustomEvent('otaStateChanged'));
                otaLog('error', '[NewKet OTA] ❌ Erreur :', err?.message);
                showToast(`⚠️ OTA: ${err?.message || 'Erreur'}`, '#dc2626');
            }
        }, 3000);

    } catch (e) {
        window._otaState.status = 'error';
        window._otaState.error = e?.message || 'Init échec';
        window.dispatchEvent(new CustomEvent('otaStateChanged'));
        otaLog('error', '[NewKet OTA] ❌ Init échec :', e?.message);
    }
}
