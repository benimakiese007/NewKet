/**
 * lens.js — Recherche visuelle côté navigateur
 * Le modèle CLIP tourne directement dans le navigateur (WebAssembly).
 * Aucune API externe payante n'est nécessaire.
 * Le vecteur est généré localement puis envoyé à Supabase pour la comparaison.
 */

import { generateEmbedding } from './clip-embedder.js';

let isSearchingByImage = false;
const VISUAL_SEARCH_DB = 'newket-visual-search';
const VISUAL_SEARCH_STORE = 'pending-image';

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openVisualSearchStore(mode = 'readonly') {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(VISUAL_SEARCH_DB, 2);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(VISUAL_SEARCH_STORE)) {
                request.result.createObjectStore(VISUAL_SEARCH_STORE);
            }
        };
        request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction(VISUAL_SEARCH_STORE, mode);
            resolve({ database, store: transaction.objectStore(VISUAL_SEARCH_STORE), transaction });
        };
        request.onerror = () => reject(request.error || new Error('Stockage de recherche visuelle indisponible'));
    });
}

async function savePendingEmbedding(vector) {
    const { database, store, transaction } = await openVisualSearchStore('readwrite');
    store.put(vector, 'embedding');
    await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();
}

export async function takePendingEmbedding() {
    const { database, store, transaction } = await openVisualSearchStore('readwrite');
    const request = store.get('embedding');
    const vector = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    store.delete('embedding');
    await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return vector;
}

// ─── Supabase visual search (direct, pas de backend) ─────────────────────────

export async function searchByEmbedding(queryEmbedding) {
    // Appel Supabase RPC directement depuis le frontend (lecture publique)
    const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/search_products_by_image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnon,
            'Authorization': `Bearer ${supabaseAnon}`
        },
        body: JSON.stringify({
            query_embedding: queryEmbedding,
            match_threshold: 0.65,
            match_count: 20
        })
    });

    if (!res.ok) throw new Error(`Supabase RPC error: ${res.status}`);
    return res.json(); // Retourne directement le tableau de produits
}

// Compat avec l'ancien code catalog.html qui appelle searchByImage(file)
export async function searchByImage(file) {
    const vector = await generateEmbedding(file);
    return searchByEmbedding(vector);
}

window.NewKetVisualSearch = {
    takePendingEmbedding,
    searchByEmbedding,
    searchByImage
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

function setLensStatus(text) {
    const lensBtn = document.getElementById('lens-btn');

    if (text) {
        if (lensBtn) {
            lensBtn.setAttribute('aria-busy', 'true');
            lensBtn.setAttribute('aria-label', text);
            lensBtn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="18" class="text-white"></iconify-icon>';
        }
        return;
    }

    if (lensBtn) {
        lensBtn.removeAttribute('aria-busy');
        lensBtn.setAttribute('aria-label', 'Rechercher par image');
        lensBtn.innerHTML = '<iconify-icon icon="solar:camera-linear" width="18" style="color: #f97316 !important;"></iconify-icon>';
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initGoogleLens() {
    // Force navigation to /lens on click, even if old cached header with label+input is used
    document.addEventListener('click', (e) => {
        const lensBtn = e.target.closest('#lens-btn');
        if (lensBtn) {
            e.preventDefault();
            const lensPath = window.ComponentLoader?.getAdjustedPath
                ? window.ComponentLoader.getAdjustedPath('pages/lens')
                : '/lens';
            window.location.assign(lensPath);
        }
    });

    document.addEventListener('keydown', (e) => {
        const lensBtn = e.target.closest('#lens-btn');
        if (!lensBtn || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        const lensPath = window.ComponentLoader?.getAdjustedPath
            ? window.ComponentLoader.getAdjustedPath('pages/lens')
            : '/lens';
        window.location.assign(lensPath);
    });

    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'lens-input') return;

        const file = e.target.files[0];
        if (!file || isSearchingByImage) return;

        isSearchingByImage = true;

        // ─── 1. Affiche l'overlay IMMÉDIATEMENT sur la page courante ────────
        // On lit l'image en premier pour un affichage instantané (avant tout traitement IA)
        const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.readAsDataURL(file);
        });

        // Injecte les styles du scanner si pas encore présents
        if (!document.getElementById('lens-scanner-styles')) {
            const style = document.createElement('style');
            style.id = 'lens-scanner-styles';
            style.textContent = `
                #lens-instant-scanner{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.95);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:opacity .3s ease}
                #lens-instant-scanner .lens-scanner-container{position:relative;width:85vw;max-width:400px;aspect-ratio:3/4;border-radius:16px;overflow:hidden;box-shadow:0 0 30px rgba(0,0,0,.5)}
                #lens-instant-scanner .lens-scanner-img{width:100%;height:100%;object-fit:cover;filter:brightness(.6)}
                #lens-instant-scanner .lens-scanner-frame{position:absolute;top:10px;left:10px;right:10px;bottom:10px}
                #lens-instant-scanner .lens-scanner-frame::before,#lens-instant-scanner .lens-scanner-frame::after{content:'';position:absolute;width:40px;height:40px;border-color:rgba(255,255,255,.8);border-style:solid}
                #lens-instant-scanner .lens-scanner-frame::before{top:0;left:0;border-width:3px 0 0 3px;border-top-left-radius:12px}
                #lens-instant-scanner .lens-scanner-frame::after{bottom:0;right:0;border-width:0 3px 3px 0;border-bottom-right-radius:12px}
                #lens-instant-scanner .lens-scanner-frame-inner::before,#lens-instant-scanner .lens-scanner-frame-inner::after{content:'';position:absolute;width:40px;height:40px;border-color:rgba(255,255,255,.8);border-style:solid}
                #lens-instant-scanner .lens-scanner-frame-inner::before{top:0;right:0;border-width:3px 3px 0 0;border-top-right-radius:12px}
                #lens-instant-scanner .lens-scanner-frame-inner::after{bottom:0;left:0;border-width:0 0 3px 3px;border-bottom-left-radius:12px}
                #lens-instant-scanner .lens-laser{position:absolute;left:0;width:100%;height:3px;background:#f97316;box-shadow:0 0 15px 5px rgba(249,115,22,.4);animation:scan-laser 2s cubic-bezier(.4,0,.2,1) infinite alternate}
                @keyframes scan-laser{0%{top:5%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:95%;opacity:0}}
                #lens-instant-scanner .lens-scanner-text{margin-top:2rem;color:#fff;font-size:1.1rem;font-weight:500;text-align:center;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif}
                #lens-instant-scanner .lens-scanner-text iconify-icon{color:#f97316}
            `;
            document.head.appendChild(style);
        }

        // Crée et affiche l'overlay
        const overlay = document.createElement('div');
        overlay.id = 'lens-instant-scanner';
        overlay.innerHTML = `
            <div class="lens-scanner-container">
                <img class="lens-scanner-img" src="${dataUrl}" alt="Scan" />
                <div class="lens-scanner-frame"><div class="lens-scanner-frame-inner"></div></div>
                <div class="lens-laser"></div>
            </div>
            <div class="lens-scanner-text">
                <iconify-icon icon="solar:camera-bold" width="24"></iconify-icon>
                Analyse visuelle en cours...
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });

        try {
            setLensStatus('Analyse en cours…');

            // ─── 2. Génère l'embedding en arrière-plan (WebAssembly) ─────────
            const vector = await generateEmbedding(file, ({ message }) => {
                setLensStatus(message || 'Analyse en cours…');
            });

            // Sauvegarde le vecteur et l'image pour catalog.html
            await savePendingEmbedding(vector);
            sessionStorage.removeItem('lensResults');
            sessionStorage.setItem('lensScanImage', dataUrl);

            const catalogPath = window.ComponentLoader?.getAdjustedPath
                ? window.ComponentLoader.getAdjustedPath('pages/catalog')
                : '/catalog';

            // ─── 3. Navigue — l'overlay reste visible pendant le chargement ──
            window.location.assign(`${catalogPath}?q=Recherche+visuelle&lens=true`);
        } catch (error) {
            console.error('[Lens] Erreur:', error);
            setLensStatus(null);
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 400);
            alert('Impossible de chercher par image pour le moment.');
            isSearchingByImage = false;
        }

        e.target.value = '';
    });
}

// Auto-initialisation robuste
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleLens);
} else {
    initGoogleLens();
}
