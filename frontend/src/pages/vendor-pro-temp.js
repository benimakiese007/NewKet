        // ===== Vendor Pro Certification =====
        document.addEventListener('DOMContentLoaded', async () => {
            const user = window.currentUser || JSON.parse(localStorage.getItem('user'));
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
                    const fileInput = document.getElementById('vRccmDocument');
                    const fileLabel = document.getElementById('vRccmDocumentLabel');

                    if (fileInput) {
                        fileInput.addEventListener('change', (e) => {
                            if (e.target.files.length > 0) {
                                fileLabel.textContent = e.target.files[0].name;
                                fileLabel.classList.remove('text-gray-500');
                                fileLabel.classList.add('text-black');
                            } else {
                                fileLabel.textContent = 'Choisir un fichier...';
                                fileLabel.classList.remove('text-black');
                                fileLabel.classList.add('text-gray-500');
                            }
                        });
                    }

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
