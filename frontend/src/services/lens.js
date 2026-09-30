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
    document.addEventListener('keydown', (e) => {
        const lensBtn = e.target.closest('#lens-btn');
        if (!lensBtn || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        document.getElementById('lens-input')?.click();
    });

    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'lens-input') return;

        const file = e.target.files[0];
        if (!file || isSearchingByImage) return;

        isSearchingByImage = true;

        try {
            setLensStatus('Chargement du modèle IA…');

            // Génère l'embedding dans le navigateur (WebAssembly)
            const vector = await generateEmbedding(file, ({ message }) => {
                setLensStatus(message || 'Analyse en cours…');
            });

            // Sauvegarde le vecteur dans IndexedDB pour catalog.html
            await savePendingEmbedding(vector);
            sessionStorage.removeItem('lensResults');

            const catalogPath = window.ComponentLoader?.getAdjustedPath
                ? window.ComponentLoader.getAdjustedPath('pages/catalog')
                : '/catalog';
            window.location.assign(`${catalogPath}?q=Recherche+visuelle&lens=true`);
        } catch (error) {
            console.error('[Lens] Erreur:', error);
            setLensStatus(null);
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
