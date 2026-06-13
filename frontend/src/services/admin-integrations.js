import { supabase } from '../config/supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    // On n'exécute le code que si on est sur la page settings de l'admin
    const integrationsTableBody = document.getElementById('integrationsTableBody');
    if (!integrationsTableBody) return;

    loadIntegrations();

    const btnExport = document.getElementById('btnExportIntegrationsCsv');
    if (btnExport) {
        btnExport.addEventListener('click', handleCsvExport);
    }
});

async function loadIntegrations() {
    try {
        const integrationsTableBody = document.getElementById('integrationsTableBody');
        
        // On récupère le token d'authentification actuel
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Non authentifié');

        const response = await fetch('/api/integrations/admin', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.length === 0) {
            integrationsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-8 text-center text-sm font-medium text-gray-400">Aucun vendeur trouvé.</td>
                </tr>
            `;
            return;
        }

        integrationsTableBody.innerHTML = data.map(vendor => `
            <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="px-6 py-4">
                    <div class="text-sm font-bold text-gray-900">${vendor.name}</div>
                    <div class="text-[10px] font-medium text-gray-400">${vendor.id.slice(0, 8)}...</div>
                </td>
                <td class="px-6 py-4 text-sm font-medium text-gray-500">${vendor.email}</td>
                <td class="px-6 py-4 text-center">
                    ${vendor.slack 
                        ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20"><iconify-icon icon="solar:check-read-bold-duotone" width="14"></iconify-icon></span>' 
                        : '<span class="text-gray-300">—</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    ${vendor.notion 
                        ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20"><iconify-icon icon="solar:check-read-bold-duotone" width="14"></iconify-icon></span>' 
                        : '<span class="text-gray-300">—</span>'}
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Erreur lors du chargement des intégrations:', error);
        const integrationsTableBody = document.getElementById('integrationsTableBody');
        if (integrationsTableBody) {
            integrationsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-8 text-center text-sm font-medium text-red-500">
                        Erreur lors du chargement des données.
                    </td>
                </tr>
            `;
        }
    }
}

async function handleCsvExport() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Non authentifié');

        const response = await fetch('/api/integrations/admin/csv', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vendor_integrations.csv';
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Erreur lors de l\'export CSV:', error);
        alert('Erreur lors du téléchargement du fichier CSV.');
    }
}
