        // ===== Vendor Pro Certification =====
        document.addEventListener('DOMContentLoaded', async () => {
            const fileInput = document.getElementById('vRccmDocument');
            const fileLabel = document.getElementById('vRccmDocumentLabel');
            const MAX_RCCM_FILES = 5;

            const syncRccmFileLabel = () => {
                if (!fileInput || !fileLabel) return;
                const files = Array.from(fileInput.files || []);
                const count = files.length;
                const hasFile = count > 0;
                const firstName = files[0]?.name || '';
                const labelText = !hasFile
                    ? `Choisir jusqu'a ${MAX_RCCM_FILES} fichiers...`
                    : count === 1
                        ? firstName
                        : `${count} fichiers selectionnes`;
                fileLabel.textContent = labelText;
                fileLabel.title = files.map((file) => file.name).join('\n');
                fileLabel.dataset.hasFile = hasFile ? '1' : '0';
                fileLabel.classList.toggle('text-black', hasFile);
                fileLabel.classList.toggle('text-gray-500', !hasFile);
                fileLabel.classList.toggle('font-semibold', hasFile);
            };

            if (fileInput && fileLabel) {
                fileInput.addEventListener('change', syncRccmFileLabel);
                fileInput.addEventListener('change', enforceMaxFiles);
                syncRccmFileLabel();
            }

            const enforceMaxFiles = () => {
                if (!fileInput) return;
                const files = Array.from(fileInput.files || []);
                if (files.length <= MAX_RCCM_FILES) return;

                const dt = new DataTransfer();
                files.slice(0, MAX_RCCM_FILES).forEach((file) => dt.items.add(file));
                fileInput.files = dt.files;
                syncRccmFileLabel();
                alert(`Tu as selectionne ${files.length} fichiers. Seuls les ${MAX_RCCM_FILES} premiers ont ete conserves.`);
            };
            let user = window.currentUser;
            if (!user) {
                try {
                    const rawUser = localStorage.getItem('user');
                    user = rawUser ? JSON.parse(rawUser) : null;
                } catch (error) {
                    console.warn('[VendorPro] Invalid stored user payload', error);
                    user = null;
                }
            }
            if (!user) return;

            try {
                const response = await fetch('/api/verification/rccm/status/' + user.id);
                if (response.ok) {
                    const data = await response.json();
                    
                    const banner = document.getElementById('vendorProStatusBanner');
                    const form = document.getElementById('vendorProCertificationForm');
                    const icon = document.getElementById('vendorProStatusIcon');
                    const iconContainer = document.getElementById('vendorProStatusIconContainer');
                    const title = document.getElementById('vendorProStatusTitle');
                    const desc = document.getElementById('vendorProStatusDesc');
                    const status = data.business_verification_status;
                    const rccm = data.rccm_number;

                    if (banner && form) {
                        if (status === 'verified' || data.is_verified_business) {
                            banner.classList.remove('hidden');
                            banner.classList.add('bg-green-50', 'border-green-100');
                            iconContainer.classList.add('bg-green-100', 'text-green-600');
                            icon.setAttribute('icon', 'solar:shield-check-bold');
                            title.textContent = 'Vendeur Pro (Vérifié)';
                            title.classList.add('text-green-800');
                            desc.textContent = 'RCCM: ' + (rccm || 'N/A');
                            desc.classList.add('text-green-600');
                            form.classList.add('hidden');
                        } else if (status === 'pending') {
                            banner.classList.remove('hidden');
                            banner.classList.add('bg-yellow-50', 'border-yellow-100');
                            iconContainer.classList.add('bg-yellow-100', 'text-yellow-600');
                            icon.setAttribute('icon', 'solar:hourglass-line-bold');
                            title.textContent = 'Vérification en cours';
                            title.classList.add('text-yellow-800');
                            desc.textContent = 'Vos documents sont en cours de révision par notre équipe.';
                            desc.classList.add('text-yellow-600');
                            form.classList.add('hidden');
                        } else if (status === 'rejected') {
                            banner.classList.remove('hidden');
                            banner.classList.add('bg-red-50', 'border-red-100');
                            iconContainer.classList.add('bg-red-100', 'text-red-600');
                            icon.setAttribute('icon', 'solar:close-circle-bold');
                            title.textContent = 'Demande rejetée';
                            title.classList.add('text-red-800');
                            desc.textContent = 'Motif: ' + (data.business_rejection_reason || 'Document invalide. Veuillez réessayer.');
                            desc.classList.add('text-red-600');
                            form.classList.remove('hidden');
                        } else {
                            form.classList.remove('hidden');
                        }
                    }

                    if (form) {
                        form.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const btn = document.getElementById('vendorProSubmitBtn');
                            const originalContent = btn.innerHTML;
                            btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Soumission en cours...';
                            btn.disabled = true;

                            const formData = new FormData(form);
                            formData.append('userId', user.id);

                            try {
                                const res = await fetch('/api/verification/rccm/submit', {
                                    method: 'POST',
                                    body: formData
                                });

                                const result = await res.json();
                                
                                if (res.ok) {
                                    window.location.reload();
                                } else {
                                    alert(result.error || 'Une erreur est survenue.');
                                    btn.innerHTML = originalContent;
                                    btn.disabled = false;
                                }
                            } catch (error) {
                                console.error(error);
                                alert('Erreur réseau. Veuillez réessayer.');
                                btn.innerHTML = originalContent;
                                btn.disabled = false;
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching verification status', error);
            }
        });
