import re

path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\admin\payout-security.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace buildCard
old_buildCard_start = content.find('function buildCard(t) {')
old_buildCard_end = content.find('async function loadPhotosForCard(t) {')

new_buildCard = """function buildCard(t) {
            const m = t.metadata || {};
            const isResolved = t.status === 'resolu';
            const isRejected = t.status === 'rejete';
            const isPending = !isResolved && !isRejected;

            const badgeClass = isResolved ? 'badge-resolved' : isRejected ? 'badge-rejected' : 'badge-pending';
            const badgeText = isResolved ? 'Approuvé' : isRejected ? 'Rejeté' : 'En attente';

            const date = new Date(t.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            return `
            <div id="card_${t.id}" class="ticket-card p-6">
                <!-- Header -->
                <div class="flex flex-wrap items-center gap-2 mb-4">
                    <span class="text-[10px] font-black text-gray-400 uppercase">#${t.id.slice(0,8)}</span>
                    <span class="badge badge-pending text-[9px]">PAYOUT_CHANGE</span>
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    <span class="ml-auto text-[10px] text-gray-400">${date}</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                    <!-- LEFT: Profil Original -->
                    <div class="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                        <div class="flex items-center gap-2 mb-4 border-b border-gray-200 pb-3">
                            <iconify-icon icon="solar:folder-with-files-bold-duotone" class="text-gray-400" width="18"></iconify-icon>
                            <h4 class="text-xs font-black uppercase tracking-widest text-gray-500">Profil Actuel (Au dossier)</h4>
                        </div>
                        
                        <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Identité du Vendeur</p>
                        <p class="font-black text-gray-900 mb-1">${t.customer_name || '—'}</p>
                        <p class="text-xs text-gray-500 mb-5">${t.customer_email || '—'}</p>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Recto (Dossier)</p>
                                <div class="photo-box bg-white border-gray-200" id="orig_recto_${t.id}">
                                    <div class="empty"><iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon><br>Chargement...</div>
                                </div>
                            </div>
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Verso (Dossier)</p>
                                <div class="photo-box bg-white border-gray-200" id="orig_verso_${t.id}">
                                    <div class="empty"><iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon><br>Chargement...</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT: Nouvelle Demande -->
                    <div class="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                        <div class="flex items-center gap-2 mb-4 border-b border-blue-200 pb-3">
                            <iconify-icon icon="solar:shield-check-bold-duotone" class="text-blue-500" width="18"></iconify-icon>
                            <h4 class="text-xs font-black uppercase tracking-widest text-blue-600">Nouvelle Soumission</h4>
                        </div>
                        
                        <p class="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Nouveau Compte Demandé</p>
                        <p class="font-black text-gray-900 mb-1">${m.new_provider || '—'} — ${m.new_account_id || '—'}</p>
                        <p class="text-xs text-gray-600 mb-5">Nom: ${m.new_account_name || '—'}</p>

                        <div class="grid grid-cols-3 gap-3">
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Nouv. Recto</p>
                                <div class="photo-box bg-white border-blue-200" id="recto_${t.id}">
                                    <div class="empty"><iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon><br>Chargement...</div>
                                </div>
                            </div>
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Nouv. Verso</p>
                                <div class="photo-box bg-white border-blue-200" id="verso_${t.id}">
                                    <div class="empty"><iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon><br>Chargement...</div>
                                </div>
                            </div>
                            <div>
                                <p class="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Selfie (Live)</p>
                                <div class="photo-box bg-white border-blue-400 border-2 shadow-sm" id="selfie_${t.id}">
                                    <div class="empty"><iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon><br>Chargement...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                ${isPending ? `
                <div class="flex flex-wrap gap-3 items-center">
                    <button onclick="approveRequest('${t.id}', '${m.new_provider}', '${m.new_account_id}', '${m.new_account_name?.replace(/'/g, "\\\\'")}')" class="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow-lg hover:-translate-y-0.5">
                        <iconify-icon icon="solar:check-circle-bold" width="16"></iconify-icon> Approuver
                    </button>
                    <button onclick="rejectRequest('${t.id}')" class="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
                        <iconify-icon icon="solar:close-circle-bold" width="16"></iconify-icon> Rejeter
                    </button>
                    <div id="action_msg_${t.id}" class="text-xs font-medium ml-3 hidden"></div>
                </div>
                ` : ''}
            </div>`;
        }

        """

content = content[:old_buildCard_start] + new_buildCard + content[old_buildCard_end:]

# Replace loadPhotosForCard
old_load_start = content.find('async function loadPhotosForCard(t) {')
old_load_end = content.find('function renderPhoto(containerId, url) {')

new_load = """async function loadPhotosForCard(t) {
            const m = t.metadata || {};
            const userId = t.user_id || t.customer_id;

            let rectoUrl = m.recto_url || null;
            let versoUrl = m.verso_url || null;
            let selfieUrl = m.selfie_url || null;
            
            let origRectoUrl = null;
            let origVersoUrl = null;

            if (userId && window.supabaseClient) {
                const { data: user } = await window.supabaseClient
                    .from('users')
                    .select('identity_document_urls')
                    .eq('id', userId)
                    .single();
                if (user?.identity_document_urls?.length >= 1) {
                    origRectoUrl = user.identity_document_urls[0];
                }
                if (user?.identity_document_urls?.length >= 2) {
                    origVersoUrl = user.identity_document_urls[1];
                }
            }

            renderPhoto('recto_' + t.id, rectoUrl);
            renderPhoto('verso_' + t.id, versoUrl);
            renderPhoto('selfie_' + t.id, selfieUrl);
            
            renderPhoto('orig_recto_' + t.id, origRectoUrl);
            renderPhoto('orig_verso_' + t.id, origVersoUrl);
        }

        """

content = content[:old_load_start] + new_load + content[old_load_end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Payout security page updated with side-by-side design")
