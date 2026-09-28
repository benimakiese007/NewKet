// Module Lens - Event Delegation (Compatible avec l'injection dynamique du header)

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
        if (!file) return;

        const lensBtn = document.getElementById('lens-btn');
        
        // Afficher un état de chargement visuel
        if (lensBtn) {
            lensBtn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="18" class="text-white"></iconify-icon>';
        }
        
        try {
            const formData = new FormData();
            formData.append('image', file);

            // Appel à l'API via fetch natif (pour que le navigateur gère le multipart/form-data)
            const response = await fetch('/api/products/search-by-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Erreur réseau');
            }
            
            const result = await response.json();

            if (result && result.data) {
                // Stocker les résultats pour la page de recherche
                sessionStorage.setItem('lensResults', JSON.stringify(result.data));
                
                // Afficher les correspondances dans la vraie page Catalogue.
                const catalogPath = window.ComponentLoader?.getAdjustedPath
                    ? window.ComponentLoader.getAdjustedPath('pages/catalog')
                    : '/catalog';
                const urlParams = new URLSearchParams();
                urlParams.set('q', 'Recherche visuelle');
                urlParams.set('lens', 'true');
                window.location.assign(`${catalogPath}?${urlParams.toString()}`);
            }
        } catch (error) {
            console.error('Erreur Google Lens:', error);
            alert('Impossible de chercher par image pour le moment.');
            // Remettre l'icône normale
            if (lensBtn) {
                lensBtn.innerHTML = '<iconify-icon icon="solar:camera-linear" width="18" class="text-white"></iconify-icon>';
            }
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
