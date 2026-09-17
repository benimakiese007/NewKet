import re

path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\admin\payout-security.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace buildCard to add extra_docs div
old_buildCard_fragment = """                        <div class="grid grid-cols-2 gap-3">
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
                    </div>"""

new_buildCard_fragment = """                        <div class="grid grid-cols-2 gap-3">
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
                        <div id="extra_docs_${t.id}"></div>
                    </div>"""

content = content.replace(old_buildCard_fragment, new_buildCard_fragment)

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
            let otherDocsUrls = [];

            if (userId && window.supabaseClient) {
                const { data: user } = await window.supabaseClient
                    .from('users')
                    .select('identity_document_urls, documents_url')
                    .eq('id', userId)
                    .single();
                
                if (user) {
                    if (user.identity_document_urls?.length >= 1) {
                        origRectoUrl = user.identity_document_urls[0];
                    }
                    if (user.identity_document_urls?.length >= 2) {
                        origVersoUrl = user.identity_document_urls[1];
                    }
                    
                    if (Array.isArray(user.documents_url)) {
                        otherDocsUrls = user.documents_url.filter(Boolean);
                    } else if (typeof user.documents_url === 'string' && user.documents_url.trim()) {
                        try {
                            const parsed = JSON.parse(user.documents_url);
                            if (Array.isArray(parsed)) otherDocsUrls = parsed.filter(Boolean);
                        } catch (_) {}
                    }
                }
            }

            renderPhoto('recto_' + t.id, rectoUrl);
            renderPhoto('verso_' + t.id, versoUrl);
            renderPhoto('selfie_' + t.id, selfieUrl);
            
            renderPhoto('orig_recto_' + t.id, origRectoUrl);
            renderPhoto('orig_verso_' + t.id, origVersoUrl);
            
            const extraDocsEl = document.getElementById('extra_docs_' + t.id);
            if (extraDocsEl && otherDocsUrls.length > 0) {
                let html = `<p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 mt-5 pt-4 border-t border-gray-200">Documents Boutique Supplémentaires (${otherDocsUrls.length})</p>`;
                html += `<div class="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">`;
                otherDocsUrls.forEach((url, idx) => {
                    const finalUrl = url.startsWith('http') ? url : `https://kuygjocnnlvjtoaquicq.supabase.co/storage/v1/object/public/vendor-docs/${url}`;
                    html += `<a href="${finalUrl}" target="_blank" class="flex items-center gap-2 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 hover:text-black transition-colors"><iconify-icon icon="solar:document-bold" class="text-gray-400"></iconify-icon> Document ${idx + 1}</a>`;
                });
                html += `</div>`;
                extraDocsEl.innerHTML = html;
            }
        }

        """

content = content[:old_load_start] + new_load + content[old_load_end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Payout security page updated with extra docs")
