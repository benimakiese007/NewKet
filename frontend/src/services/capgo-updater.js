/**
 * NewKet — Self-Hosted OTA Updater (Supabase + Capgo Native Plugin)
 * ================================================================
 * 100% Gratuit, illimité et indépendant des serveurs payants Capgo Cloud.
 *
 * Fonctionnement :
 *  1. Au lancement, notifie le moteur natif que le bundle actuel fonctionne (notifyAppReady)
 *  2. Interroge la table Supabase `app_versions` via fetch direct (sans dépendance globale)
 *  3. Si une version plus récente existe, télécharge silencieusement le zip
 *  4. Enregistre le bundle pour s'activer au prochain redémarrage (next)
 *  5. En cas de bug bloquant, le plugin natif effectue un rollback automatique
 */

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY';

const isNative = () =>
    Boolean(
        window.Capacitor?.isNativePlatform?.() ||
        window.Capacitor?.getPlatform?.() === 'android' ||
        window.Capacitor?.getPlatform?.() === 'ios'
    );

/**
 * Compare deux versions sémantiques (ex: "1.0.2" > "1.0.1")
 */
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

/**
 * Récupère la dernière version active via fetch direct (pas de dépendance à window.supabaseClient)
 */
async function fetchLatestVersion() {
    const url = `${SUPABASE_URL}/rest/v1/app_versions?is_active=eq.true&channel=eq.production&order=created_at.desc&limit=1&select=version,bundle_url,min_native_version`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Accept': 'application/json'
        }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
}

export async function initCapgoUpdater() {
    if (!isNative()) return;

    try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

        // 1. CONFIRMATION DE SANTÉ OBLIGATOIRE (évite le rollback automatique)
        const currentInfo = await CapacitorUpdater.notifyAppReady();
        const currentVersion = currentInfo?.bundle?.version || '1.0.0';

        console.log(`[NewKet OTA] Version active : ${currentVersion}`);

        // 2. Vérification silencieuse 3s après le lancement
        setTimeout(async () => {
            try {
                const latestRelease = await fetchLatestVersion();

                if (!latestRelease?.bundle_url) {
                    console.log('[NewKet OTA] Aucune version disponible sur Supabase.');
                    return;
                }

                console.log(`[NewKet OTA] Dernière version distante : ${latestRelease.version}`);

                if (compareVersions(latestRelease.version, currentVersion) > 0) {
                    const lastDownloaded = localStorage.getItem('newket_ota_pending_version');
                    if (lastDownloaded === latestRelease.version) {
                        console.log(`[NewKet OTA] Version ${latestRelease.version} déjà téléchargée, en attente d'activation.`);
                        return;
                    }

                    console.log(`[NewKet OTA] Nouvelle version ${latestRelease.version} détectée. Téléchargement...`);

                    const bundle = await CapacitorUpdater.download({
                        url: latestRelease.bundle_url,
                        version: latestRelease.version
                    });

                    if (bundle?.id) {
                        await CapacitorUpdater.next({ id: bundle.id });
                        localStorage.setItem('newket_ota_pending_version', latestRelease.version);
                        console.log(`[NewKet OTA] ✅ Version ${latestRelease.version} prête ! Active au prochain lancement.`);
                    }
                } else {
                    console.log(`[NewKet OTA] Déjà à jour (${currentVersion}).`);
                }
            } catch (err) {
                console.warn('[NewKet OTA] Erreur lors de la vérification :', err?.message);
            }
        }, 3000);

    } catch (e) {
        console.warn('[NewKet OTA] Initialisation échouée :', e?.message);
    }
}
