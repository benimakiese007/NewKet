/**
 * NewKet — Self-Hosted OTA Updater (Supabase + Capgo Native Plugin)
 * ================================================================
 * 100% Gratuit, illimité et indépendant des serveurs payants Capgo Cloud.
 */

import { Capacitor } from '@capacitor/core';

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY';

function showToast(msg, bg = '#1e293b') {
    try {
        let el = document.getElementById('ota-toast-indicator');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ota-toast-indicator';
            el.style.position = 'fixed';
            el.style.bottom = '80px';
            el.style.left = '50%';
            el.style.transform = 'translateX(-50%)';
            el.style.zIndex = '999999';
            el.style.padding = '8px 16px';
            el.style.borderRadius = '9999px';
            el.style.color = '#ffffff';
            el.style.fontSize = '12px';
            el.style.fontWeight = 'bold';
            el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            el.style.pointerEvents = 'none';
            el.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(el);
        }
        el.style.background = bg;
        el.textContent = msg;
        el.style.opacity = '1';
        setTimeout(() => { if (el) el.style.opacity = '0'; }, 5000);
    } catch (_) {}
}

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

async function fetchLatestVersion() {
    const url = `${SUPABASE_URL}/rest/v1/app_versions?is_active=eq.true&channel=eq.production&order=created_at.desc&limit=1&select=version,bundle_url,min_native_version`;
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
    if (!isNative) return;

    try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

        // 1. Confirmer au moteur natif que le JS actuel est vivant (anti-rollback)
        const currentInfo = await CapacitorUpdater.notifyAppReady();
        const currentVersion = currentInfo?.bundle?.version || '1.0.0';

        console.log(`[NewKet OTA] Version active : ${currentVersion}`);

        // 2. Vérification silencieuse 3s après démarrage
        setTimeout(async () => {
            try {
                const latestRelease = await fetchLatestVersion();
                if (!latestRelease?.bundle_url) return;

                console.log(`[NewKet OTA] Distante: ${latestRelease.version} | Locale: ${currentVersion}`);

                if (compareVersions(latestRelease.version, currentVersion) > 0) {
                    showToast(`🔄 Mise à jour v${latestRelease.version} en cours...`, '#0284c7');

                    const bundle = await CapacitorUpdater.download({
                        url: latestRelease.bundle_url,
                        version: latestRelease.version
                    });

                    if (bundle?.id) {
                        showToast(`✅ v${latestRelease.version} prête, application...`, '#16a34a');
                        // Recharge immédiatement l'application avec le nouveau bundle
                        await CapacitorUpdater.set({ id: bundle.id });
                    }
                }
            } catch (err) {
                console.warn('[NewKet OTA] Erreur vérification :', err?.message);
                showToast(`⚠️ OTA: ${err?.message || 'Erreur'}`, '#dc2626');
            }
        }, 3000);

    } catch (e) {
        console.warn('[NewKet OTA] Init échec :', e?.message);
    }
}
