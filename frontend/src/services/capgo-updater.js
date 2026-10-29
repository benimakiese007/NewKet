/**
 * NewKet — Self-Hosted OTA Updater (Supabase + Capgo Native Plugin)
 * ================================================================
 * 100% Gratuit, illimité et indépendant des serveurs payants Capgo Cloud.
 *
 * Fonctionnement :
 *  1. Au lancement, notifie le moteur natif que le bundle actuel fonctionne (notifyAppReady)
 *  2. Interroge la table Supabase `app_versions` pour voir si une version plus récente existe
 *  3. Si oui, télécharge silencieusement le zip depuis Supabase Storage
 *  4. Enregistre le bundle pour s'activer au prochain redémarrage / background (next)
 *  5. En cas de bug bloquant, le plugin natif effectue un rollback automatique
 */

const isNative = () =>
    Boolean(
        window.Capacitor?.isNativePlatform?.() ||
        window.Capacitor?.getPlatform?.() === 'android' ||
        window.Capacitor?.getPlatform?.() === 'ios'
    );

/**
 * Compare deux versions sémantiques (ex: "1.0.2" > "1.0.1")
 * Retourne 1 si v1 > v2, -1 si v1 < v2, 0 si égales
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

export async function initCapgoUpdater() {
    if (!isNative()) return;

    try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

        // 1. CONFIRMATION DE SANTÉ OBLIGATOIRE (Évite le rollback automatique)
        const currentInfo = await CapacitorUpdater.notifyAppReady();
        const currentVersion = currentInfo?.bundle?.version || '1.0.0';

        console.log(`[NewKet OTA] Version active : ${currentVersion}`);

        // 2. Vérification silencieuse en arrière-plan (non-bloquante)
        setTimeout(async () => {
            try {
                // Attendre que Supabase soit initialisé si besoin
                const supabase = window.supabaseClient;
                if (!supabase) return;

                const { data: latestRelease, error } = await supabase
                    .from('app_versions')
                    .select('version, bundle_url, min_native_version')
                    .eq('is_active', true)
                    .eq('channel', 'production')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error || !latestRelease?.bundle_url) {
                    return;
                }

                // Si la version distante est plus récente que la version actuelle
                if (compareVersions(latestRelease.version, currentVersion) > 0) {
                    const lastDownloaded = localStorage.getItem('newket_ota_pending_version');
                    if (lastDownloaded === latestRelease.version) {
                        // Déjà téléchargé et en attente du prochain redémarrage
                        return;
                    }

                    console.log(`[NewKet OTA] Nouvelle version ${latestRelease.version} détectée. Téléchargement en tâche de fond...`);

                    const bundle = await CapacitorUpdater.download({
                        url: latestRelease.bundle_url,
                        version: latestRelease.version
                    });

                    if (bundle?.id) {
                        // Préparer ce bundle pour le prochain redémarrage ou passage en background
                        await CapacitorUpdater.next({ id: bundle.id });
                        localStorage.setItem('newket_ota_pending_version', latestRelease.version);
                        console.log(`[NewKet OTA] Version ${latestRelease.version} prête ! Elle s'activera au prochain mouvement/lancement.`);
                    }
                }
            } catch (err) {
                console.warn('[NewKet OTA] Vérification de mise à jour échouée (sans impact) :', err?.message);
            }
        }, 3000); // Démarre 3s après pour ne pas ralentir le chargement initial

    } catch (e) {
        console.warn('[NewKet OTA] Initialisation échouée :', e?.message);
    }
}
