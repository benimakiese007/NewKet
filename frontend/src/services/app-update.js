/**
 * NewKet — GitHub Releases Updater
 * =================================
 * Détecte, télécharge et installe les mises à jour APK depuis GitHub Releases.
 * Complète capgo-updater.js (OTA web) : ce service gère les mises à jour
 * du binaire natif APK uniquement.
 *
 * Usage :
 *   import { initAppUpdater, checkForUpdate } from './app-update.js';
 *   initAppUpdater(); // au démarrage de l'app
 */

import { Capacitor } from '@capacitor/core';

// ── Configuration centralisée ─────────────────────────────────────────────────
const GITHUB_OWNER = 'benimakiese007';
const GITHUB_REPO  = 'NewKet';
const GITHUB_API   = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Cache : ne pas vérifier plus d'une fois toutes les 6 heures automatiquement
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY         = 'nk_update_last_check';
const DISMISSED_KEY     = 'nk_update_dismissed_version';

// ── Comparateur de version SemVer + suffixe lettre (1.0.72e < 1.0.73) ────────
function compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;
    const clean = (v) => String(v).replace(/^v/, '');
    const parsePart = (p) => {
        const m = String(p).match(/^(\d+)([a-zA-Z]*)$/);
        return m ? { num: parseInt(m[1], 10) || 0, letter: m[2] || '' } : { num: 0, letter: '' };
    };
    const parts1 = clean(v1).split('.');
    const parts2 = clean(v2).split('.');
    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
        const a = parsePart(parts1[i] || '0');
        const b = parsePart(parts2[i] || '0');
        if (a.num !== b.num) return a.num > b.num ? 1 : -1;
        if (a.letter !== b.letter) return a.letter > b.letter ? 1 : -1;
    }
    return 0;
}

// ── Version locale actuelle (depuis package.json via import.meta.env ou meta) ─
function getLocalVersion() {
    // 1. Meta tag injecté par Vite (préféré)
    const metaTag = document.querySelector('meta[name="app-version"]');
    if (metaTag?.content) return metaTag.content;
    // 2. Variable globale exposée par le build
    if (window.__APP_VERSION__) return window.__APP_VERSION__;
    // 3. Fallback localStorage (défini au précédent lancement de l'app)
    return localStorage.getItem('nk_app_version') || '1.0.0';
}

// ── Appel à l'API GitHub Releases ─────────────────────────────────────────────
async function fetchLatestRelease() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const res = await fetch(GITHUB_API, {
            signal: controller.signal,
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        clearTimeout(timeout);
        if (res.status === 404) return null;  // Aucune release publiée
        if (res.status === 403) {
            const retryAfter = res.headers.get('X-RateLimit-Reset');
            console.warn(`[AppUpdate] Rate limit GitHub. Réessai après ${retryAfter}.`);
            return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') {
            console.warn('[AppUpdate] Timeout réseau — vérification ignorée.');
        } else {
            console.warn('[AppUpdate] Erreur réseau GitHub :', e.message);
        }
        return null;
    }
}

// ── Extraction du fichier APK et de son SHA-256 dans les assets de la release ─
function extractApkAssets(release) {
    if (!release?.assets?.length) return null;
    const apkAsset = release.assets.find(a =>
        a.name.toLowerCase().endsWith('.apk') &&
        !a.name.toLowerCase().includes('debug')
    );
    const sha256Asset = release.assets.find(a =>
        a.name.toLowerCase().endsWith('.sha256') ||
        a.name.toLowerCase().endsWith('.sha256sum')
    );
    if (!apkAsset) return null;
    return {
        apkUrl:      apkAsset.browser_download_url,
        apkName:     apkAsset.name,
        apkSize:     apkAsset.size,
        sha256Url:   sha256Asset?.browser_download_url || null,
        tagName:     release.tag_name,
        name:        release.name || release.tag_name,
        body:        release.body || '',
        publishedAt: release.published_at,
    };
}

// ── Récupérer le contenu du SHA-256 depuis son asset GitHub ───────────────────
async function fetchSha256(sha256Url) {
    if (!sha256Url) return '';
    try {
        const res = await fetch(sha256Url);
        if (!res.ok) return '';
        const text = await res.text();
        // Formats supportés : "abc123  fichier.apk" ou juste "abc123"
        return text.trim().split(/\s+/)[0].toLowerCase();
    } catch {
        return '';
    }
}

// ── Vérification principale ────────────────────────────────────────────────────
export async function checkForUpdate(options = {}) {
    const { silent = true, force = false } = options;

    // Sur le web ou iOS : on ne gère pas les APK
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return { available: false, reason: 'non-android' };
    }

    const release = await fetchLatestRelease();
    if (!release) return { available: false, reason: 'no-release' };

    const assets = extractApkAssets(release);
    if (!assets) return { available: false, reason: 'no-apk-asset' };

    const localVersion  = getLocalVersion();
    const remoteVersion = assets.tagName;

    console.log(`[AppUpdate] Local: ${localVersion} | GitHub: ${remoteVersion}`);

    if (compareVersions(remoteVersion, localVersion) <= 0) {
        return { available: false, reason: 'up-to-date', localVersion, remoteVersion };
    }

    // Tant que la version n'est pas installée, la mise à jour est disponible !
    return { available: true, assets, localVersion, remoteVersion };
}

// ── Téléchargement de l'APK via le plugin natif ───────────────────────────────
export async function downloadAndInstall(assets, onProgress) {
    const { AppUpdate } = await importPlugin();

    // 1. Vérifier la permission d'installation
    const { canInstall } = await AppUpdate.canInstallPackages();
    if (!canInstall) {
        // Ouvrir les réglages Android pour autoriser la source inconnue
        await AppUpdate.openInstallPermission();
        // On attend 2 secondes puis on retente (l'utilisateur a peut-être activé)
        await new Promise(r => setTimeout(r, 2000));
        const { canInstall: canNow } = await AppUpdate.canInstallPackages();
        if (!canNow) {
            throw new Error('permission_denied');
        }
    }

    // 2. Récupérer le SHA-256 officiel
    const sha256 = await fetchSha256(assets.sha256Url);
    if (sha256) {
        console.log(`[AppUpdate] SHA-256 attendu : ${sha256.slice(0, 16)}...`);
    } else {
        console.warn('[AppUpdate] SHA-256 absent — intégrité non vérifiable.');
    }

    // 3. Écouter la progression en temps réel
    let progressListener = null;
    if (typeof onProgress === 'function') {
        progressListener = await AppUpdate.addListener('downloadProgress', (data) => {
            onProgress({
                progress: data.progress,
                downloadedBytes: data.downloadedBytes,
                totalBytes: data.totalBytes,
            });
        });
    }

    // 4. Lancer le téléchargement
    try {
        const result = await AppUpdate.downloadApk({
            url:    assets.apkUrl,
            sha256: sha256,
        });

        if (result?.cancelled) {
            throw new Error('download_cancelled');
        }

        // 5. Lancer l'installeur Android
        await AppUpdate.installApk();

    } finally {
        progressListener?.remove();
    }
}

// ── Import dynamique du plugin Capacitor (évite les erreurs sur web) ──────────
async function importPlugin() {
    const { registerPlugin } = await import('@capacitor/core');
    const AppUpdate = registerPlugin('AppUpdate');
    return { AppUpdate };
}

// ── Formatage de la taille en Mo ─────────────────────────────────────────────
export function formatSize(bytes) {
    if (!bytes) return '';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

// ── Formatage de la date de release ───────────────────────────────────────────
export function formatReleaseDate(isoDate) {
    if (!isoDate) return '';
    return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(isoDate));
}

// ── Marquer une version comme ignorée (uniquement pour la session en cours) ──
export function dismissUpdate(version) {
    try {
        sessionStorage.setItem('nk_update_dismissed_session', version);
    } catch (_) {}
}

// ── Initialisation automatique au démarrage ───────────────────────────────────
export async function initAppUpdater() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    // Vérification automatique 3 secondes après le démarrage
    // Tant que l'APK n'est pas à jour, le modal réapparaît à chaque ouverture !
    const checkAndShow = async () => {
        try {
            const result = await checkForUpdate({ force: true });
            if (result.available) {
                // Si l'utilisateur n'a pas explicitement cliqué "Plus tard" dans cette session
                const dismissedThisSession = sessionStorage.getItem('nk_update_dismissed_session');
                if (dismissedThisSession !== result.remoteVersion) {
                    showUpdateModal(result);
                }
            }
        } catch (e) {
            console.warn('[AppUpdate] Vérification silencieuse échouée :', e.message);
        }
    };

    // Premier test rapide à 3s
    setTimeout(checkAndShow, 3000);

    // Et sécurité à 7s au cas où le système OTA Capgo recharge la WebView
    setTimeout(checkAndShow, 7000);
}

// ── Modal de mise à jour ──────────────────────────────────────────────────────
export function showUpdateModal(updateInfo) {
    if (document.getElementById('nk-update-modal')) return; // Déjà affiché

    const { assets, localVersion, remoteVersion } = updateInfo;

    const modal = document.createElement('div');
    modal.id = 'nk-update-modal';
    modal.innerHTML = `
        <div class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4" style="background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">

                <!-- Header -->
                <div class="bg-black px-6 pt-6 pb-5 text-center">
                    <div class="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-3 shadow-lg">
                        <img src="/Images/Logo NewKet PNG.png" alt="NewKet" class="w-full h-full object-cover" onerror="this.style.display='none'">
                    </div>
                    <h2 class="text-white text-xl font-bold">Mise à jour disponible</h2>
                    <p class="text-gray-400 text-sm mt-1">NewKet ${remoteVersion}</p>
                </div>

                <!-- Version badges -->
                <div class="flex items-center justify-center gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <span class="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">v${localVersion}</span>
                    <iconify-icon icon="solar:arrow-right-bold" class="text-gray-400 text-lg"></iconify-icon>
                    <span class="px-3 py-1 rounded-full bg-black text-white text-xs font-bold">v${remoteVersion}</span>
                </div>

                <!-- Notes de mise à jour -->
                <div class="px-6 py-4 max-h-40 overflow-y-auto">
                    <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nouveautés</h3>
                    <div id="nk-update-changelog" class="text-sm text-gray-700 leading-relaxed whitespace-pre-line"></div>
                </div>

                <!-- Barre de progression (cachée par défaut) -->
                <div id="nk-update-progress-wrap" class="px-6 pb-2 hidden">
                    <div class="flex justify-between text-xs text-gray-500 mb-1">
                        <span id="nk-update-progress-label">Téléchargement...</span>
                        <span id="nk-update-progress-pct">0%</span>
                    </div>
                    <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div id="nk-update-progress-bar" class="h-full bg-black rounded-full transition-all duration-300" style="width:0%"></div>
                    </div>
                    <p id="nk-update-progress-size" class="text-xs text-gray-400 mt-1 text-right"></p>
                </div>

                <!-- Actions -->
                <div class="flex flex-col gap-2 px-6 pb-6">
                    <button id="nk-update-btn-install" class="w-full bg-black text-white font-semibold py-3 rounded-xl hover:bg-gray-800 active:scale-95 transition-all">
                        Télécharger la mise à jour
                    </button>
                    <button id="nk-update-btn-later" class="w-full text-gray-500 font-medium py-2 rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-sm">
                        Plus tard
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Remplir le changelog (Markdown simple : sauts de ligne)
    const changelogEl = document.getElementById('nk-update-changelog');
    if (changelogEl) {
        const rawBody = assets.body || 'Améliorations et corrections diverses.';
        // Nettoyer les lignes de titre Markdown pour l'affichage
        const clean = rawBody
            .replace(/^#{1,6}\s+/gm, '')
            .trim()
            .slice(0, 500);
        changelogEl.textContent = clean;
    }

    const btnInstall = document.getElementById('nk-update-btn-install');
    const btnLater   = document.getElementById('nk-update-btn-later');
    const progressWrap = document.getElementById('nk-update-progress-wrap');
    const progressBar  = document.getElementById('nk-update-progress-bar');
    const progressPct  = document.getElementById('nk-update-progress-pct');
    const progressSize = document.getElementById('nk-update-progress-size');
    const progressLabel= document.getElementById('nk-update-progress-label');

    // Bouton Installer
    btnInstall?.addEventListener('click', async () => {
        btnInstall.disabled = true;
        btnInstall.textContent = 'Téléchargement...';
        btnLater && (btnLater.disabled = true);
        progressWrap?.classList.remove('hidden');

        try {
            await downloadAndInstall(assets, ({ progress, downloadedBytes, totalBytes }) => {
                if (progressBar)  progressBar.style.width  = progress + '%';
                if (progressPct)  progressPct.textContent   = progress + '%';
                if (progressLabel) progressLabel.textContent = 'Téléchargement en cours...';
                if (progressSize && totalBytes) {
                    progressSize.textContent =
                        `${formatSize(downloadedBytes)} / ${formatSize(totalBytes)}`;
                }
            });
            // L'installeur Android a été lancé — l'app sera relancée par le système
            progressLabel && (progressLabel.textContent = 'Installation en cours...');
            btnInstall.textContent = 'Installation lancée ✓';
        } catch (e) {
            progressWrap?.classList.add('hidden');
            btnInstall.disabled  = false;
            btnLater && (btnLater.disabled = false);

            if (e.message === 'permission_denied') {
                btnInstall.textContent = 'Autorisation refusée';
                setTimeout(() => { btnInstall.textContent = 'Réessayer'; }, 2000);
            } else if (e.message === 'download_cancelled') {
                btnInstall.textContent = 'Annulé';
            } else if (e.message?.includes('SHA-256')) {
                btnInstall.textContent = 'Fichier corrompu — réessayez';
            } else {
                console.error('[AppUpdate] Erreur :', e.message);
                btnInstall.textContent = 'Erreur — Réessayer';
            }
        }
    });

    // Bouton Plus tard
    btnLater?.addEventListener('click', () => {
        dismissUpdate(remoteVersion);
        modal.remove();
    });
}
