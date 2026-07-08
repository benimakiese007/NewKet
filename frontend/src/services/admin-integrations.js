import { supabaseClient as supabase } from './supabase-client.js';

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

function getAdminApiErrorMessage(status) {
    const code = Number(status) || 0;
    if (code === 401) return 'Votre session a expire. Reconnectez-vous puis reessayez.';
    if (code === 403) return "Vous n'avez pas acces a cette page.";
    if (code === 404) return 'Les donnees demandees sont introuvables.';
    if (code >= 500) return 'Le service rencontre un probleme. Reessayez dans un instant.';
    return 'Une erreur est survenue.';
}

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
            throw new Error(getAdminApiErrorMessage(response.status));
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
                    <div class="text-sm font-bold text-gray-900 admin-table-truncate" title="${vendor.name}">${vendor.name}</div>
                    <div class="admin-table-truncate text-[10px] font-medium text-gray-400" title="${vendor.id}">${vendor.id.slice(0, 8)}...</div>
                </td>
                <td class="px-6 py-4 text-sm font-medium text-gray-500 admin-table-truncate" title="${vendor.email}">${vendor.email}</td>
                <td class="px-6 py-4 text-center">
                    ${vendor.slack 
                        ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20" title="Connecté"><iconify-icon icon="solar:check-read-bold-duotone" width="14"></iconify-icon></span>' 
                        : '<span class="text-gray-300">—</span>'}
                </td>
                <td class="px-6 py-4 text-center">
                    ${vendor.notion && vendor.notion_db_id
                        ? `<a href="https://notion.so/${vendor.notion_db_id.replace(/-/g, '')}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all font-bold text-[10px] border border-emerald-200" title="Ouvrir le catalogue Notion">
                            <iconify-icon icon="solar:link-bold" width="12"></iconify-icon> Voir Catalogue
                           </a>`
                        : vendor.notion 
                            ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20" title="Connecté"><iconify-icon icon="solar:check-read-bold-duotone" width="14"></iconify-icon></span>'
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
            throw new Error(getAdminApiErrorMessage(response.status));
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
