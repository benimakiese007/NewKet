// Module Lens - Event Delegation (Compatible avec l'injection dynamique du header)

let isSearchingByImage = false;
const VISUAL_SEARCH_DB = 'newket-visual-search';
const VISUAL_SEARCH_STORE = 'pending-image';

function openVisualSearchStore(mode = 'readonly') {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(VISUAL_SEARCH_DB, 1);
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

async function savePendingImage(file) {
    const { database, store, transaction } = await openVisualSearchStore('readwrite');
    store.put(file, 'image');
    await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();
}

async function takePendingImage() {
    const { database, store, transaction } = await openVisualSearchStore('readwrite');
    const request = store.get('image');
    const file = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    store.delete('image');
    await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return file;
}

export async function searchByImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/products/search-by-image', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('Erreur réseau');
    const result = await response.json();
    if (!result || !Array.isArray(result.data)) throw new Error('Réponse Lens invalide');
    return result.data;
}

window.NewKetVisualSearch = {
    takePendingImage,
    searchByImage
};

function setLensLoading(isLoading) {
    const lensBtn = document.getElementById('lens-btn');
    const searchBar = lensBtn?.closest('.search-bar');
    let status = searchBar?.querySelector('.lens-loading-status');

    if (isLoading) {
        if (lensBtn) {
            lensBtn.setAttribute('aria-busy', 'true');
            lensBtn.setAttribute('aria-label', 'Analyse de l’image en cours');
            lensBtn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="18" class="text-white"></iconify-icon>';
        }
        if (searchBar) {
            searchBar.classList.add('lens-is-loading');
            if (!status) {
                status = document.createElement('div');
                status.className = 'lens-loading-status';
                status.setAttribute('role', 'status');
                status.setAttribute('aria-live', 'polite');
                status.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="18"></iconify-icon><span>Analyse de l’image…</span>';
                searchBar.appendChild(status);
            }
        }
        return;
    }

    if (lensBtn) {
        lensBtn.removeAttribute('aria-busy');
        lensBtn.setAttribute('aria-label', 'Rechercher par image');
        lensBtn.innerHTML = '<iconify-icon icon="solar:camera-linear" width="18" class="text-white"></iconify-icon>';
    }
    searchBar?.classList.remove('lens-is-loading');
    status?.remove();
}

export function initGoogleLens() {
    // Le label lié au champ fichier ouvre le sélecteur nativement. Ce handler
    // conserve aussi l'accès clavier quand le header est injecté dynamiquement.
    document.addEventListener('keydown', (e) => {
        const lensBtn = e.target.closest('#lens-btn');
        if (!lensBtn || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        document.getElementById('lens-input')?.click();
    });

    // Écoute du changement de fichier
    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'lens-input') return;

        const file = e.target.files[0];
        if (!file || isSearchingByImage) return;

        isSearchingByImage = true;
        setLensLoading(true);
        
        try {
            // IndexedDB conserve le fichier pendant la navigation. Catalogue fera
            // l'analyse et affichera ses skeletons sans attendre cette page.
            await savePendingImage(file);
            sessionStorage.removeItem('lensResults');

            const catalogPath = window.ComponentLoader?.getAdjustedPath
                ? window.ComponentLoader.getAdjustedPath('pages/catalog')
                : '/catalog';
            window.location.assign(`${catalogPath}?q=Recherche+visuelle&lens=true`);
        } catch (error) {
            console.error('Erreur Google Lens:', error);
            alert('Impossible de chercher par image pour le moment.');
            setLensLoading(false);
            isSearchingByImage = false;
        }
        
        // Reset l'input file pour permettre de reprendre la même photo
        e.target.value = '';
    });
}

// Auto-initialisation robuste
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleLens);
} else {
    initGoogleLens();
}
