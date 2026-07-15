

                    // ============================================================
                    // INLINE ERROR UTILITY — showInlineError(anchor, message, ms)
                    // Injects a red error <p> directly after `anchor` in the DOM.
                    // No HTML changes needed — fully JS-driven and scalable.
                    // ============================================================
                    (function() {
                        const ATTR = 'data-inline-err-id';

                        /**
                         * Show a red inline error message just below `anchor`.
                         * @param {HTMLElement} anchor   - The button or input to attach to.
                         * @param {string}      message  - The error text to display.
                         * @param {number}      [duration=5000] - Auto-hide after ms (0 = never).
                         */
                        window.showInlineError = function(anchor, message, duration = 5000) {
                            if (!anchor) return;

                            // Reuse or create the error element
                            let errId = anchor.getAttribute(ATTR);
                            let el = errId ? document.getElementById(errId) : null;

                            if (!el) {
                                el = document.createElement('p');
                                el.id = 'inline-err-' + Math.random().toString(36).slice(2, 9);
                                el.setAttribute('role', 'alert');
                                el.style.cssText = [
                                    'color:#ef4444',
                                    'font-size:0.78rem',
                                    'margin-top:6px',
                                    'font-weight:500',
                                    'display:flex',
                                    'align-items:center',
                                    'gap:4px',
                                    'opacity:0',
                                    'transition:opacity 0.2s ease'
                                ].join(';');
                                el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span></span>';
                                anchor.setAttribute(ATTR, el.id);
                                anchor.parentNode.insertBefore(el, anchor.nextSibling);
                            }

                            // Update text
                            el.querySelector('span').textContent = message;
                            el.style.opacity = '1';

                            // Clear previous auto-hide timer
                            if (el._hideTimer) clearTimeout(el._hideTimer);

                            // Auto-hide
                            if (duration > 0) {
                                el._hideTimer = setTimeout(() => window.clearInlineError(anchor), duration);
                            }

                            // Also clear on next user interaction with the anchor
                            const clearOnce = () => {
                                window.clearInlineError(anchor);
                                anchor.removeEventListener('click', clearOnce);
                                anchor.removeEventListener('input', clearOnce);
                                anchor.removeEventListener('change', clearOnce);
                            };
                            anchor.addEventListener('click',  clearOnce, { once: true });
                            anchor.addEventListener('input',  clearOnce, { once: true });
                            anchor.addEventListener('change', clearOnce, { once: true });
                        };

                        /**
                         * Programmatically clear the inline error attached to `anchor`.
                         * @param {HTMLElement} anchor
                         */
                        window.clearInlineError = function(anchor) {
                            if (!anchor) return;
                            const errId = anchor.getAttribute(ATTR);
                            const el = errId ? document.getElementById(errId) : null;
                            if (el) {
                                el.style.opacity = '0';
                                if (el._hideTimer) clearTimeout(el._hideTimer);
                            }
                        };
                    })();
                    // ============================================================


                    document.addEventListener('newketInitialized', function() {
                        if (document.getElementById('vSetStoreName')) {
                            var profile = window.ProfileManager ? window.ProfileManager.getProfile() : {};
                            var boutiqueName = profile.company_name || '';
                            var resolvedPhone = profile.store_phone || profile.phone || '';
                            document.getElementById('vSetStoreName').value = boutiqueName;
                        }
                        if (document.getElementById('vSetEmail')) {
                            var profile = window.ProfileManager ? window.ProfileManager.getProfile() : {};
                            document.getElementById('vSetEmail').value = localStorage.getItem('newketUserEmail') || profile.email || '';
                        }
                        if (document.getElementById('vSetPhone')) {
                            var profile = window.ProfileManager ? window.ProfileManager.getProfile() : {};
                            document.getElementById('vSetPhone').value = profile.store_phone || profile.phone || '';
                        }
                        if (document.getElementById('vSetShipping')) {
                            var profile = window.ProfileManager ? window.ProfileManager.getProfile() : {};
                            if (profile.shipping_time) document.getElementById('vSetShipping').value = profile.shipping_time;
                        }
                        if (document.getElementById('vSetStoreDescription')) {
                            var profile = window.ProfileManager ? window.ProfileManager.getProfile() : {};
                            if (profile.store_description) document.getElementById('vSetStoreDescription').value = profile.store_description;
                        }
                    });
                    


                    const updateVendorName = () => {
                        const profile = ProfileManager.getProfile();
                        const boutiqueName = profile.company_name || 'Ma Boutique';
                        const resolvedPhone = profile.store_phone || profile.phone || '';

                        if (document.getElementById('vSetStoreName')) document.getElementById('vSetStoreName').value = boutiqueName || '';
                        if (document.getElementById('vSetEmail')) document.getElementById('vSetEmail').value = localStorage.getItem('newketUserEmail') || profile.email;
                        if (document.getElementById('vSetPhone')) {
                            document.getElementById('vSetPhone').value = resolvedPhone;
                        }
                        
                        // Load extra settings from profile (synced with Supabase)
                        if (profile.shipping_time && document.getElementById('vSetShipping')) {
                            document.getElementById('vSetShipping').value = profile.shipping_time;
                        }
                        if (profile.store_description && document.getElementById('vSetStoreDescription')) {
                            document.getElementById('vSetStoreDescription').value = profile.store_description;
                        }
                    };

                    updateVendorName();
                    window.addEventListener('profileUpdated', updateVendorName);

                    // ===== AVATAR PHOTO LOGIC =====
                    let _selectedAvatarFile = null;

                    const _loadExistingAvatar = async () => {
                        try {
                            const profile = ProfileManager.getProfile();
                            if (profile && profile.avatar) {
                                _setAvatarPreview(profile.avatar);
                            } else {
                                const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                                if (!user) return;
                                const vendor = await window.SupabaseAdapter.fetchWithFilters('users', {
                                    eq: [['id', user.id]],
                                    select: 'avatar',
                                    single: true,
                                    skipCache: true
                                });
                                if (vendor && vendor.avatar) {
                                    _setAvatarPreview(vendor.avatar);
                                }
                            }
                        } catch(e) { console.warn('[Avatar] Could not load existing avatar', e); }
                    };

                    const _setAvatarPreview = (src) => {
                        const img = document.getElementById('avatarPreviewImg');
                        const placeholder = document.getElementById('avatarPlaceholder');
                        const overlay = document.getElementById('avatarOverlay');
                        if (!img) return;
                        img.src = src;
                        img.classList.remove('hidden');
                        if (placeholder) placeholder.classList.add('hidden');
                        if (overlay) overlay.classList.remove('hidden');
                        const btn = document.getElementById('saveAvatarBtn');
                        if (btn) btn.disabled = false;
                    };

                    const avatarInput = document.getElementById('avatarPhotoInput');
                    if (avatarInput) {
                        avatarInput.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) {
                                const _avatarInput = document.getElementById('avatarPhotoInput');
                                if (window.showInlineError) window.showInlineError(_avatarInput, 'Image trop lourde. Max 2 Mo.');
                                return;
                            }
                            _selectedAvatarFile = file;
                            const url = URL.createObjectURL(file);
                            _setAvatarPreview(url);
                        });
                    }

                    const saveAvatarBtn = document.getElementById('saveAvatarBtn');
                    if (saveAvatarBtn) {
                        saveAvatarBtn.addEventListener('click', async () => {
                            if (!_selectedAvatarFile) return;
                            const progressDiv = document.getElementById('avatarUploadProgress');
                            const progressBar = document.getElementById('avatarProgressBar');
                            saveAvatarBtn.disabled = true;
                            if (progressDiv) progressDiv.classList.remove('hidden');
                            if (progressBar) progressBar.style.width = '30%';

                            try {
                                const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                                if (!user) throw new Error('Non authentifié');

                                const ext = _selectedAvatarFile.name.split('.').pop();
                                const filePath = `avatars/${user.id}_${Date.now()}.${ext}`;

                                if (progressBar) progressBar.style.width = '60%';

                                const publicUrl = await window.SupabaseAdapter.uploadFile('user-assets', filePath, _selectedAvatarFile);
                                if (!publicUrl) throw new Error('Upload échoué');

                                if (progressBar) progressBar.style.width = '85%';

                                // 1. Update database
                                await window.SupabaseAdapter.update('users', user.id, { avatar: publicUrl });
                                
                                // 2. Update Auth metadata (for sync with customer profile)
                                await window.SupabaseAdapter.getClient().auth.updateUser({
                                    data: { avatar_url: publicUrl }
                                });

                                // 3. Update ProfileManager
                                ProfileManager.saveProfile({ ...ProfileManager.getProfile(), avatar: publicUrl });

                                if (progressBar) progressBar.style.width = '100%';
                                setTimeout(() => { if (progressDiv) progressDiv.classList.add('hidden'); }, 1500);
                                if (window.showToast) showToast('Logo mis à jour avec succès !', 'success');
                                _selectedAvatarFile = null;
                                updateVendorName(); // Refresh sidebar

                            } catch(err) {
                                console.error('[Avatar] Upload error:', err);
                                const uploadError = window.SupabaseAdapter?.getLastUploadError?.() || err;
                                const errorMessage = window.SupabaseAdapter?.getReadableUploadError?.(uploadError) || 'Erreur lors de l\'upload.';
                                if (window.showToast) showToast(errorMessage, 'error');
                                if (progressDiv) progressDiv.classList.add('hidden');
                            } finally {
                                saveAvatarBtn.disabled = false;
                            }
                        });
                    }

                    _loadExistingAvatar();
                    // ===== END AVATAR PHOTO LOGIC =====

                    // ===== COVER PHOTO LOGIC =====
                    let _selectedCoverFile = null;

                    // Load existing cover photo
                    const _loadExistingCover = async () => {
                        try {
                            const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                            if (!user) return;
                            const vendor = await window.SupabaseAdapter.fetchWithFilters('users', {
                                eq: [['id', user.id]],
                                select: 'cover_image',
                                single: true,
                                skipCache: true
                            });
                            if (vendor && vendor.cover_image) {
                                _setCoverPreview(vendor.cover_image);
                            }
                        } catch(e) { console.warn('[Cover] Could not load existing cover', e); }
                    };

                    const _setCoverPreview = (src) => {
                        const img = document.getElementById('coverPreviewImg');
                        const placeholder = document.getElementById('coverPlaceholder');
                        const overlay = document.getElementById('coverOverlay');
                        if (!img) return;
                        img.src = src;
                        img.classList.remove('hidden');
                        if (placeholder) placeholder.classList.add('hidden');
                        if (overlay) overlay.classList.remove('hidden');
                        const btn = document.getElementById('saveCoverBtn');
                        if (btn) btn.disabled = false;
                    };

                    const coverInput = document.getElementById('coverPhotoInput');
                    if (coverInput) {
                        coverInput.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            // Validate size (5MB max)
                            if (file.size > 5 * 1024 * 1024) {
                                const _coverInput = document.getElementById('coverPhotoInput');
                                if (window.showInlineError) window.showInlineError(_coverInput, 'Image trop lourde. Max 5 Mo.');
                                return;
                            }

                            _selectedCoverFile = file;
                            const url = URL.createObjectURL(file);
                            _setCoverPreview(url);
                        });
                    }

                    const saveCoverBtn = document.getElementById('saveCoverBtn');
                    if (saveCoverBtn) {
                        saveCoverBtn.addEventListener('click', async () => {
                            if (!_selectedCoverFile) return;

                            const progressDiv = document.getElementById('coverUploadProgress');
                            const progressBar = document.getElementById('coverProgressBar');
                            const progressLabel = document.getElementById('coverUploadLabel');

                            saveCoverBtn.disabled = true;
                            if (progressDiv) progressDiv.classList.remove('hidden');
                            if (progressBar) progressBar.style.width = '30%';
                            if (progressLabel) progressLabel.textContent = 'Préparation...';

                            try {
                                const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                                if (!user) throw new Error('Non authentifié');

                                const ext = _selectedCoverFile.name.split('.').pop();
                                const filePath = `covers/${user.id}.${ext}`;

                                if (progressBar) progressBar.style.width = '60%';
                                if (progressLabel) progressLabel.textContent = 'Upload en cours...';

                                // Upload to Supabase Storage
                                const publicUrl = await window.SupabaseAdapter.uploadFile('vendor-covers', filePath, _selectedCoverFile);

                                if (!publicUrl) throw new Error('Upload échoué');

                                if (progressBar) progressBar.style.width = '85%';
                                if (progressLabel) progressLabel.textContent = 'Sauvegarde...';

                                // Save URL to users table
                                await window.SupabaseAdapter.update('users', user.id, { cover_image: publicUrl });

                                // Update ProfileManager locally
                                ProfileManager.saveProfile({ ...ProfileManager.getProfile(), cover_image: publicUrl });

                                if (progressBar) progressBar.style.width = '100%';
                                if (progressLabel) progressLabel.textContent = 'Terminé !';

                                setTimeout(() => { if (progressDiv) progressDiv.classList.add('hidden'); }, 1500);
                                if (window.showToast) showToast('Photo de couverture mise à jour !', 'success');
                                _selectedCoverFile = null;

                            } catch(err) {
                                console.error('[Cover] Upload error:', err);
                                if (window.showToast) showToast('Erreur lors de l\'upload. Réessayez.', 'error');
                                if (progressDiv) progressDiv.classList.add('hidden');
                            } finally {
                                saveCoverBtn.disabled = false;
                            }
                        });
                    }

                    // Load existing cover on page load
                    _loadExistingCover();
                    // ===== END COVER PHOTO LOGIC =====

                    // Handle Settings Form
                    const settingsForm = document.getElementById('vendorSettingsForm');
                    if (settingsForm) {
                        settingsForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const newName = document.getElementById('vSetStoreName').value;
                            const newEmail = document.getElementById('vSetEmail').value;
                            const newPhone = (document.getElementById('vSetPhone')?.value || '').trim();
                            const newShipping = document.getElementById('vSetShipping').value;
                            const newStoreDescription = document.getElementById('vSetStoreDescription')?.value || '';
                            const newShopSlug = (window.NewKetLinks && window.NewKetLinks.buildShopSlug)
                                ? window.NewKetLinks.buildShopSlug(newName)
                                : null;
                            
                            const newProfile = {
                                ...ProfileManager.getProfile(),
                                company_name: newName,
                                email: newEmail,
                                phone: newPhone,
                                store_phone: newPhone,
                                shipping_time: newShipping,
                                store_description: newStoreDescription,
                                shop_slug: newShopSlug
                            };
                            
                            // 1. Save Locally
                            ProfileManager.saveProfile(newProfile);
                            
                            // 2. Save to Supabase (users table)
                            try {
                                if (window.SupabaseAdapter) {
                                    const user = window.getSupabaseUser ? await window.getSupabaseUser(3000) : null;
                                    if (user && user.id) {
                                        if (newShopSlug) {
                                            const conflicts = await window.SupabaseAdapter.fetchWithFilters('users', {
                                                eq: [['role', 'supplier'], ['shop_slug', newShopSlug]],
                                                limit: 1,
                                                skipCache: true
                                            });
                                            const hasConflict = Array.isArray(conflicts)
                                                && conflicts.length > 0
                                            && conflicts[0]?.id !== user.id;
                                            if (hasConflict) {
                                                if (window.showToast) window.showToast("Ce nom de boutique est déjà utilisé. Choisissez un autre nom unique.", "warning", "Boutique");
                                                return;
                                            }
                                        }
                                        await window.SupabaseAdapter.update('users', user.id, {
                                            company_name: newName,
                                            shop_slug: newShopSlug,
                                            shipping_time: newShipping,
                                            store_phone: newPhone || null,
                                            store_description: newStoreDescription || null
                                        });
                                    }
                                }
                            } catch (err) {
                                console.error('[Settings] Error saving to Supabase:', err);
                            }
                            
                            if (window.showToast) {
                                window.showToast('Paramètres de la boutique enregistrés !', 'success', 'Profil');
                            }

                            // Refresh UI
                            if (document.getElementById('vendorName')) document.getElementById('vendorName').textContent = newProfile.company_name;
                            if (document.getElementById('vendorDisplay')) document.getElementById('vendorDisplay').textContent = newProfile.company_name;
                        });
                    }

                    // Handle Password Update
                    const passwordForm = document.getElementById('vendorPasswordForm');
                    const syncVendorPasswordFormMode = () => {
                        const currentPasswordGroup = document.getElementById('vendorCurrentPasswordGroup');
                        const currentPasswordInput = document.getElementById('vCurrentPassword');
                        const oauthHint = document.getElementById('vendorPasswordOauthHint');
                        const requiresCurrentPassword = !!window.AuthManager?.requiresCurrentPassword?.();
                        const isOauthOnly = !requiresCurrentPassword;

                        if (currentPasswordGroup) currentPasswordGroup.classList.toggle('hidden', isOauthOnly);
                        if (oauthHint) oauthHint.classList.toggle('hidden', !isOauthOnly);
                        if (currentPasswordInput) {
                            currentPasswordInput.required = requiresCurrentPassword;
                            if (isOauthOnly) currentPasswordInput.value = '';
                        }
                    };

                    syncVendorPasswordFormMode();
                    window.addEventListener('newketInitialized', syncVendorPasswordFormMode);
                    if (passwordForm) {
                        passwordForm.addEventListener('submit', async (e) => {
                            e.preventDefault();

                            const btn = document.getElementById('vendorUpdatePasswordBtn');
                            const currentPass = (document.getElementById('vCurrentPassword')?.value || '').trim();
                            const newPass = (document.getElementById('vNewPassword')?.value || '').trim();
                            const confirmPass = (document.getElementById('vConfirmPassword')?.value || '').trim();
                            const requiresCurrentPassword = !!window.AuthManager?.requiresCurrentPassword?.();

                            const _pwdBtn = document.getElementById('vUpdatePasswordBtn');
                            if (requiresCurrentPassword && !currentPass) {
                                if (window.showInlineError) window.showInlineError(_pwdBtn, 'Veuillez saisir votre mot de passe actuel.');
                                return;
                            }
                            if (!newPass) {
                                if (window.showInlineError) window.showInlineError(_pwdBtn, 'Veuillez saisir un nouveau mot de passe.');
                                return;
                            }
                            if (newPass.length < 8) {
                                if (window.showInlineError) window.showInlineError(_pwdBtn, 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
                                return;
                            }
                            if (newPass !== confirmPass) {
                                if (window.showInlineError) window.showInlineError(_pwdBtn, 'Les mots de passe ne correspondent pas.');
                                return;
                            }

                            try {
                                if (btn) btn.disabled = true;

                                if (!window.AuthManager || typeof window.AuthManager.changePassword !== 'function') {
                                    throw new Error("Fonction de changement de mot de passe indisponible (AuthManager.changePassword).");
                                }

                                await window.AuthManager.changePassword(currentPass, newPass);

                                document.getElementById('vCurrentPassword').value = '';
                                document.getElementById('vNewPassword').value = '';
                                document.getElementById('vConfirmPassword').value = '';

                                if (window.showToast) window.showToast('Mot de passe mis à jour avec succès.', 'success', 'Sécurité');
                            } catch (err) {
                                console.error('[Security] Password update error:', err);
                                const msg = (err && err.message) ? err.message : 'Erreur lors de la mise à jour du mot de passe.';
                                if (window.showToast) window.showToast(msg, 'error', 'Sécurité');
                            } finally {
                                if (btn) btn.disabled = false;
                            }
                        });
                    }

                    // Passkeys for Vendor
                    const registerPasskeyBtnVendor = document.getElementById('registerPasskeyBtnVendor');
                    const passkeysListContainer = document.getElementById('vendorPasskeysList');
                    
                    const renderVendorPasskeys = (passkeys) => {
                        if (!passkeysListContainer) return;
                        if (!passkeys || passkeys.length === 0) {
                            passkeysListContainer.classList.add('hidden');
                            passkeysListContainer.innerHTML = '';
                            return;
                        }
                        
                        passkeysListContainer.classList.remove('hidden');
                        passkeysListContainer.innerHTML = passkeys.map(pk => {
                            const date = new Date(pk.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'short', year: 'numeric'
                            });
                            const name = pk.friendly_name || pk.name || 'Appareil inconnu';
                            
                            // Détection du type de clé
                            let pkType = 'WebAuthn / Biométrie';
                            let icon = 'solar:key-minimalistic-bold';
                            const lowerName = name.toLowerCase();
                            
                            if (lowerName.includes('apple') || lowerName.includes('mac') || lowerName.includes('iphone') || lowerName.includes('ipad')) {
                                pkType = 'Passkey Apple (Face ID / Touch ID)';
                                icon = 'bi:apple';
                            } else if (lowerName.includes('windows')) {
                                pkType = 'Windows Hello (Empreinte / Code)';
                                icon = 'bi:windows';
                            } else if (lowerName.includes('android')) {
                                pkType = 'Passkey Android';
                                icon = 'bi:android2';
                            } else if (lowerName.includes('yubikey') || lowerName.includes('security key')) {
                                pkType = 'Clé de sécurité physique';
                                icon = 'solar:usb-bold';
                            }
                            
                            return `
                                <div class="flex flex-wrap sm:flex-nowrap items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50 gap-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 text-gray-500 shrink-0">
                                            <iconify-icon icon="${icon}" width="18"></iconify-icon>
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-sm font-bold text-gray-900 truncate">${name}</p>
                                            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Ajoutée le ${date}</p>
                                                <span class="text-[10px] text-gray-300 hidden sm:inline">•</span>
                                                <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Type : ${pkType}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-green-100 text-green-800 rounded">
                                        Opérationnelle
                                    </div>
                                </div>
                            `;
                        }).join('');
                    };

                    const loadVendorPasskeys = () => {
                        // Vérifier si une clé existe déjà
                        if (window.supabaseClient && window.supabaseClient.auth.passkey) {
                            window.supabaseClient.auth.passkey.list().then(({ data }) => {
                                renderVendorPasskeys(data);
                                if (data && data.length > 0) {
                                    const title = registerPasskeyBtnVendor.closest('div').querySelector('h2');
                                    if (title && !title.innerHTML.includes('Activée')) {
                                        title.innerHTML += ' <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-green-100 text-green-800 normal-case tracking-normal">Activée</span>';
                                    }
                                    registerPasskeyBtnVendor.innerHTML = '<iconify-icon icon="solar:fingerprint-bold" width="20"></iconify-icon> Créer une autre clé d\'accès';
                                } else {
                                    const title = registerPasskeyBtnVendor.closest('div').querySelector('h2');
                                    if (title && title.innerHTML.includes('Activée')) {
                                        title.innerHTML = "Clé d'accès (Passkey)";
                                    }
                                    registerPasskeyBtnVendor.innerHTML = '<iconify-icon icon="solar:fingerprint-bold" width="20"></iconify-icon> Créer une clé d\'accès';
                                }
                            }).catch(err => console.error("Erreur passkeys:", err));
                        }
                    };

                    loadVendorPasskeys();

                    if (registerPasskeyBtnVendor) {
                        registerPasskeyBtnVendor.addEventListener('click', async () => {
                            if (!window.supabaseClient || !window.supabaseClient.auth.registerPasskey) {
                                if (window.showToast) window.showToast("Votre navigateur ne supporte pas encore cette fonctionnalité.", "error", "Sécurité");
                                return;
                            }
                            const originalText = registerPasskeyBtnVendor.innerHTML;
                            registerPasskeyBtnVendor.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="20"></iconify-icon> Création...';
                            registerPasskeyBtnVendor.disabled = true;
                            try {
                                const { data, error } = await window.supabaseClient.auth.registerPasskey();
                                if (error) throw error;
                                if (window.showToast) window.showToast("Clé d'accès créée avec succès !", "success", "Sécurité");
                                loadVendorPasskeys(); // Rafraichir la liste
                            } catch (err) {
                                console.error('Passkey registration error:', err);
                                let msg = err.message || "Erreur lors de la création de la clé d'accès.";
                                if (msg.includes('cancelled') || msg.includes('cancel')) {
                                    msg = "Création annulée.";
                                }
                                if (window.showToast) window.showToast(msg, 'error', 'Sécurité');
                            } finally {
                                registerPasskeyBtnVendor.innerHTML = originalText;
                                registerPasskeyBtnVendor.disabled = false;
                            }
                        });
                    }

                    const getVendorReferralLink = (code) => {
                        const loginPath = typeof window.resolvePath === 'function'
                            ? window.resolvePath('login')
                            : '/pages/login';
                        const url = new URL(loginPath, window.location.origin);
                        url.searchParams.set('signup', '1');
                        url.searchParams.set('ref', code);
                        return url.toString();
                    };

                    const loadVendorReferralPanel = async (retryCount = 0) => {
                        const codeInput = document.getElementById('vendorReferralCode');
                        const linkInput = document.getElementById('vendorReferralLink');
                        if (!codeInput || !linkInput) return;

                        try {
                            const data = await window.ApiClient.get('/referrals/me', {
                                suppressToast: true,
                                suppressErrorLogging: true,
                                suppressNetworkError: true
                            });

                            if (!data) throw new Error('Aucune donnée reçue');

                            const code = String(data.referral_code || '').trim();
                            const link = code
                                ? (data.referral_link ? `${window.location.origin}${data.referral_link}` : getVendorReferralLink(code))
                                : '';
                            codeInput.value = code;
                            linkInput.value = link;
                            codeInput.placeholder = code ? 'Votre code' : 'Code non généré';
                            linkInput.placeholder = link ? 'Votre lien' : 'Lien non disponible';
                        } catch (err) {
                            console.warn(`[Vendor Referral] Unable to load referral summary (attempt ${retryCount + 1}):`, err?.message || err);
                            if (retryCount < 3) {
                                const delay = Math.pow(2, retryCount) * 1000;
                                setTimeout(() => loadVendorReferralPanel(retryCount + 1), delay);
                                return;
                            }
                            codeInput.value = '';
                            linkInput.value = '';
                            codeInput.placeholder = 'Indisponible';
                            linkInput.placeholder = 'Indisponible';
                        }
                    };

                    const vendorCopyValue = async (value, label) => {
                        if (!value) return;
                        try {
                            await navigator.clipboard.writeText(value);
                            if (window.showToast) window.showToast(`${label} copié.`, 'success', 'Parrainage');
                        } catch {
                            if (window.showToast) window.showToast('Impossible de copier automatiquement.', 'warning', 'Parrainage');
                        }
                    };

                    const copyVendorReferralCodeBtn = document.getElementById('copyVendorReferralCodeBtn');
                    const copyVendorReferralLinkBtn = document.getElementById('copyVendorReferralLinkBtn');
                    const vendorReferralCodeInput = document.getElementById('vendorReferralCode');
                    const vendorReferralLinkInput = document.getElementById('vendorReferralLink');

                    if (copyVendorReferralCodeBtn && vendorReferralCodeInput) {
                        copyVendorReferralCodeBtn.addEventListener('click', () => vendorCopyValue(vendorReferralCodeInput.value, 'Code'));
                    }

                    if (copyVendorReferralLinkBtn && vendorReferralLinkInput) {
                        copyVendorReferralLinkBtn.addEventListener('click', () => vendorCopyValue(vendorReferralLinkInput.value, 'Lien'));
                    }

                    loadVendorReferralPanel();

                    // Listened to updates previously

                window.vendorPromoState = {
                    promos: [],
                    stats: null,
                    loaded: false,
                    editingId: null
                };

                function getVendorOwnedProducts() {
                    const userId = localStorage.getItem('newketUserId');
                    const email = localStorage.getItem('newketUserEmail');
                    if (!window.ProductManager || typeof ProductManager.getProducts !== 'function') return [];
                    return ProductManager.getProducts().filter((product) =>
                        product?.user_id === userId || product?.supplier_email === email
                    );
                }

                function toDateTimeLocalValue(value) {
                    if (!value) return '';
                    const date = new Date(value);
                    if (Number.isNaN(date.getTime())) return '';
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                }

                function toggleVendorPromoProductsVisibility() {
                    const scope = document.getElementById('vendorPromoScopeType')?.value || 'shop';
                    const wrap = document.getElementById('vendorPromoProductsWrap');
                    if (wrap) wrap.classList.toggle('hidden', scope !== 'products');
                }

                function renderVendorPromoProductOptions(selectedIds = []) {
                    const container = document.getElementById('vendorPromoProducts');
                    if (!container) return;
                    const products = getVendorOwnedProducts();

                    if (products.length === 0) {
                        container.innerHTML = '<p class="text-sm text-gray-400">Publiez d’abord des produits pour cibler une promo.</p>';
                        return;
                    }

                    container.innerHTML = products.map((product) => `
                        <label class="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50">
                            <input type="checkbox" class="vendor-promo-product-checkbox h-4 w-4 rounded border-gray-300 text-black focus:ring-black" value="${product.id}" ${selectedIds.includes(product.id) ? 'checked' : ''}>
                            <div class="min-w-0">
                                <div class="text-sm font-bold text-gray-900 truncate">${product.name || 'Produit'}</div>
                                <div class="text-xs text-gray-400">${window.CurrencyManager ? CurrencyManager.formatPrice(product.price || 0) : (product.price || 0)}</div>
                            </div>
                        </label>
                    `).join('');
                }

                function resetVendorPromoForm() {
                    window.vendorPromoState.editingId = null;
                    document.getElementById('vendorPromoForm')?.reset();
                    document.getElementById('vendorPromoId').value = '';
                    document.getElementById('vendorPromoDiscountType').value = 'percent';
                    document.getElementById('vendorPromoScopeType').value = 'shop';
                    document.getElementById('vendorPromoIsActive').checked = true;
                    document.getElementById('vendorPromoSubmitBtn').textContent = 'Enregistrer le code promo';
                    renderVendorPromoProductOptions([]);
                    toggleVendorPromoProductsVisibility();
                }

                function populateVendorPromoForm(promo) {
                    if (!promo) {
                        resetVendorPromoForm();
                        return;
                    }

                    window.vendorPromoState.editingId = promo.id;
                    document.getElementById('vendorPromoId').value = promo.id || '';
                    document.getElementById('vendorPromoCode').value = promo.code || '';
                    document.getElementById('vendorPromoName').value = promo.name || '';
                    document.getElementById('vendorPromoDiscountType').value = promo.discount_type || 'percent';
                    document.getElementById('vendorPromoDiscountValue').value = promo.discount_value ?? '';
                    document.getElementById('vendorPromoMinOrderAmount').value = promo.min_order_amount ?? 0;
                    document.getElementById('vendorPromoStartsAt').value = toDateTimeLocalValue(promo.starts_at);
                    document.getElementById('vendorPromoEndsAt').value = toDateTimeLocalValue(promo.ends_at);
                    document.getElementById('vendorPromoMaxUses').value = promo.max_uses ?? '';
                    document.getElementById('vendorPromoMaxUsesPerCustomer').value = promo.max_uses_per_customer ?? '';
                    document.getElementById('vendorPromoScopeType').value = promo.scope_type || 'shop';
                    document.getElementById('vendorPromoIsActive').checked = promo.is_active !== false;
                    document.getElementById('vendorPromoSubmitBtn').textContent = 'Mettre à jour le code promo';
                    renderVendorPromoProductOptions(Array.isArray(promo.product_ids) ? promo.product_ids : []);
                    toggleVendorPromoProductsVisibility();
                }

                async function loadVendorPromos(force = false) {
                    if (!window.ApiClient) throw new Error('ApiClient non disponible');
                    if (window.vendorPromoState.loaded && !force) return;
                    const data = await window.ApiClient.get('/promos/vendor', { dedupe: false });
                    window.vendorPromoState.promos = Array.isArray(data?.promos) ? data.promos : [];
                    window.vendorPromoState.stats = data?.stats || null;
                    window.vendorPromoState.loaded = true;
                }

                function renderVendorPromoStats() {
                    const container = document.getElementById('vendorPromoStats');
                    if (!container) return;
                    const stats = window.vendorPromoState.stats || { active: 0, usage_count: 0, total_discount_amount: 0 };
                    container.innerHTML = [
                        { label: 'Codes actifs', value: stats.active || 0 },
                        { label: 'Utilisations', value: stats.usage_count || 0 },
                        { label: 'Remise totale', value: window.CurrencyManager ? CurrencyManager.formatPrice(stats.total_discount_amount || 0) : (stats.total_discount_amount || 0) }
                    ].map((item) => `
                        <div class="bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 min-w-[150px]">
                            <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">${item.label}</p>
                            <p class="font-black text-gray-900 mt-1">${item.value}</p>
                        </div>
                    `).join('');
                }

                function renderVendorPromoList() {
                    const container = document.getElementById('vendorPromoList');
                    if (!container) return;
                    const promos = window.vendorPromoState.promos || [];

                    if (promos.length === 0) {
                        container.innerHTML = `
                            <div class="glass-panel p-12 text-center text-gray-500">
                                <iconify-icon icon="solar:ticket-sale-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                                <h4 class="font-black text-gray-900 mb-2">Aucun code promo</h4>
                                <p class="text-xs text-gray-400 max-w-[420px] leading-relaxed mx-auto mb-8">Créez un premier code (ex: <span class="font-black text-gray-600">NEWKET10</span>) pour booster vos ventes. Vous pourrez l'activer/désactiver à tout moment.</p>
                                <button type="button" id="vendorPromoCreateFirstBtn" class="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200">
                                    Créer mon premier code
                                </button>
                            </div>
                        `;
                        document.getElementById('vendorPromoCreateFirstBtn')?.addEventListener('click', () => {
                            const el = document.getElementById('vendorPromoCode') || document.getElementById('vendorPromoName');
                            try { el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); } catch (e) {}
                            el?.focus?.();
                        });
                        return;
                    }

                    container.innerHTML = promos.map((promo) => {
                        const isPercent = promo.discount_type === 'percent';
                        const scopeLabel = promo.scope_type === 'products'
                            ? `${(promo.product_ids || []).length} produit(s)`
                            : 'Toute la boutique';
                        const statusClass = promo.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200';
                        const usageText = `${promo.current_uses || 0}${promo.max_uses !== null && promo.max_uses !== undefined ? ` / ${promo.max_uses}` : ''}`;
                        return `
                            <div class="border border-gray-100 rounded-3xl p-5 bg-white">
                                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="space-y-3 min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusClass}">${promo.is_active ? 'Actif' : 'Inactif'}</span>
                                            <span class="text-[11px] font-black uppercase tracking-widest text-gray-400">${scopeLabel}</span>
                                        </div>
                                        <div>
                                            <div class="text-xl font-black text-gray-900">${promo.code}</div>
                                            <div class="text-sm text-gray-500">${promo.name || 'Sans nom interne'}</div>
                                        </div>
                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                            <div><span class="text-gray-400">Remise</span><div class="font-bold text-gray-900">${isPercent ? `${promo.discount_value}%` : (window.CurrencyManager ? CurrencyManager.formatPrice(promo.discount_value || 0) : (promo.discount_value || 0))}</div></div>
                                            <div><span class="text-gray-400">Minimum</span><div class="font-bold text-gray-900">${window.CurrencyManager ? CurrencyManager.formatPrice(promo.min_order_amount || 0) : (promo.min_order_amount || 0)}</div></div>
                                            <div><span class="text-gray-400">Utilisations</span><div class="font-bold text-gray-900">${usageText}</div></div>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-2 lg:justify-end">
                                        <button onclick="window.toggleVendorPromoStatus('${promo.id}', ${promo.is_active ? 'false' : 'true'})" class="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold">${promo.is_active ? 'Désactiver' : 'Activer'}</button>
                                        <button onclick="window.editVendorPromo('${promo.id}')" class="px-4 py-2 rounded-xl bg-black text-white text-sm font-bold">Modifier</button>
                                        <button onclick="window.deleteVendorPromo('${promo.id}')" class="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold">Supprimer</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }

                async function renderVendorPromos(force = false) {
                    try {
                        const promoContainer = document.getElementById('vendorPromoList');
                        if (promoContainer && (!window.vendorPromoState.loaded || force)) {
                            if (typeof window.buildSkeletonPanelListHTML === 'function') {
                                promoContainer.innerHTML = window.buildSkeletonPanelListHTML(2, { lines: 2, cardClass: 'glass-panel p-4' });
                            }
                        }
                        await loadVendorPromos(force);
                        renderVendorPromoStats();
                        renderVendorPromoList();
                        if (!window.vendorPromoState.editingId) {
                            resetVendorPromoForm();
                        }
                    } catch (error) {
                        console.error('[VendorPromo] Render error:', error);
                        const container = document.getElementById('vendorPromoList');
                        if (container) {
                            container.innerHTML = '<p class="text-center text-sm text-red-500 py-12">Impossible de charger les codes promo.</p>';
                        }
                    }
                }

                function collectVendorPromoFormPayload() {
                    const scopeType = document.getElementById('vendorPromoScopeType').value;
                    const productIds = Array.from(document.querySelectorAll('.vendor-promo-product-checkbox:checked')).map((input) => input.value);
                    return {
                        code: document.getElementById('vendorPromoCode').value,
                        name: document.getElementById('vendorPromoName').value,
                        discount_type: document.getElementById('vendorPromoDiscountType').value,
                        discount_value: document.getElementById('vendorPromoDiscountValue').value,
                        min_order_amount: document.getElementById('vendorPromoMinOrderAmount').value || 0,
                        starts_at: document.getElementById('vendorPromoStartsAt').value || null,
                        ends_at: document.getElementById('vendorPromoEndsAt').value || null,
                        max_uses: document.getElementById('vendorPromoMaxUses').value || null,
                        max_uses_per_customer: document.getElementById('vendorPromoMaxUsesPerCustomer').value || null,
                        scope_type: scopeType,
                        is_active: document.getElementById('vendorPromoIsActive').checked,
                        product_ids: scopeType === 'products' ? productIds : []
                    };
                }

                window.editVendorPromo = function(promoId) {
                    const promo = (window.vendorPromoState.promos || []).find((item) => item.id === promoId);
                    if (!promo) return;
                    populateVendorPromoForm(promo);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };

                window.toggleVendorPromoStatus = async function(promoId, nextStatus) {
                    try {
                        await window.ApiClient.fetch(`/promos/vendor/${promoId}/toggle`, {
                            method: 'PATCH',
                            body: JSON.stringify({ is_active: nextStatus === true || nextStatus === 'true' })
                        });
                        await renderVendorPromos(true);
                        if (window.showToast) window.showToast('Statut du code promo mis à jour.', 'success');
                    } catch (error) {
                        if (window.showToast) window.showToast(error?.data?.error || error?.message || 'Erreur lors de la mise à jour.', 'error');
                    }
                };

                window.deleteVendorPromo = async function(promoId) {
                    if (!confirm('Supprimer ce code promo ?')) return;
                    try {
                        await window.ApiClient.delete(`/promos/vendor/${promoId}`);
                        resetVendorPromoForm();
                        await renderVendorPromos(true);
                        if (window.showToast) window.showToast('Code promo supprimé.', 'success');
                    } catch (error) {
                        if (window.showToast) window.showToast(error?.data?.error || error?.message || 'Erreur lors de la suppression.', 'error');
                    }
                };

                function initVendorPromoTab() {
                    document.getElementById('vendorPromoScopeType')?.addEventListener('change', toggleVendorPromoProductsVisibility);
                    document.getElementById('vendorPromoResetBtn')?.addEventListener('click', resetVendorPromoForm);
                    document.getElementById('vendorPromoForm')?.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const submitBtn = document.getElementById('vendorPromoSubmitBtn');
                        const promoId = document.getElementById('vendorPromoId').value;
                        const payload = collectVendorPromoFormPayload();

                        submitBtn.disabled = true;
                        submitBtn.textContent = promoId ? 'Mise à jour...' : 'Enregistrement...';

                        try {
                            if (promoId) {
                                await window.ApiClient.put(`/promos/vendor/${promoId}`, payload);
                            } else {
                                await window.ApiClient.post('/promos/vendor', payload);
                            }
                            resetVendorPromoForm();
                            await renderVendorPromos(true);
                            if (window.showToast) window.showToast('Code promo enregistré.', 'success');
                        } catch (error) {
                            if (window.showToast) window.showToast(error?.data?.error || error?.message || 'Erreur lors de l’enregistrement.', 'error');
                        } finally {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Enregistrer le code promo';
                        }
                    });

                    resetVendorPromoForm();
                }

                function initVendorDashboard() {
                    if (window.__newketVendorDashboardInited) return;
                    window.__newketVendorDashboardInited = true;

                    updateStatusBanner();
                    window.addEventListener('userStatusUpdated', updateStatusBanner);
                      
                    // Sync tab from Hash
                    syncVendorTabFromHash();
                     
                    // Listen for hash changes
                    window.addEventListener('hashchange', syncVendorTabFromHash);

                    initVendorPromoTab();

                    // Search functionality for Products tab
                    const searchInput = document.getElementById('dashboardSearch');
                    if (searchInput) {
                        let t = null;
                        const clearBtn = document.getElementById('vendorSearchClearBtn');
                        const syncClearBtn = () => {
                            if (!clearBtn) return;
                            if (String(searchInput.value || '').trim().length > 0) clearBtn.classList.remove('hidden');
                            else clearBtn.classList.add('hidden');
                        };
                        const schedule = () => {
                            syncClearBtn();
                            clearTimeout(t);
                            t = setTimeout(() => renderVendorProducts(), 160);
                        };
                        searchInput.addEventListener('input', schedule);
                        searchInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Escape') {
                                searchInput.value = '';
                                schedule();
                                searchInput.blur();
                            }
                        });
                        clearBtn?.addEventListener('click', () => {
                            searchInput.value = '';
                            schedule();
                            searchInput.focus();
                        });
                        syncClearBtn();
                    }

                    // Leads filter (P2)
                    const bindLeadsFilter = () => {
                        if (window.__newketVendorLeadsFilterBound) return;
                        window.__newketVendorLeadsFilterBound = true;

                        const actionBtn = document.getElementById('vendorLeadsFilterActionBtn');
                        const allBtn = document.getElementById('vendorLeadsFilterAllBtn');
                        if (!actionBtn || !allBtn) return;

                        const setFilter = (mode) => {
                            window.vendorLeadsFilter = mode;
                            renderVendorLeads();
                        };
                        actionBtn.addEventListener('click', () => setFilter('action'));
                        allBtn.addEventListener('click', () => setFilter('all'));
                    };
                    bindLeadsFilter();
                }

                function updateStatusBanner() {
                    const status = (window.AuthManager && window.AuthManager.status) || localStorage.getItem('newketUserStatus') || 'pending';
                    const banner = document.getElementById('status-banner');
                    if (!banner) return;

                    if (status === 'approved') {
                        banner.classList.add('hidden');
                        return;
                    }

                    banner.classList.remove('hidden');
                    let content = '';
                    if (status === 'pending') {
                        content = `
                            <div class="relative overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-8 rounded-[2.5rem] flex flex-col lg:flex-row items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-700 shadow-sm">
                                <div class="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-amber-500 shadow-xl shadow-amber-200/50 shrink-0">
                                    <iconify-icon icon="solar:shield-warning-bold-duotone" width="32"></iconify-icon>
                                </div>
                                <div class="flex-1 text-center md:text-left">
                                    <div class="flex items-center justify-center md:justify-start gap-2 mb-1">
                                        <h3 class="font-black text-amber-900 text-lg">Finalisez votre installation</h3>
                                        <span class="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full uppercase tracking-tighter">Action Requise</span>
                                    </div>
                                    <p class="text-sm text-amber-700/80 leading-relaxed max-w-xl">Votre aventure NewKet commence ici. Soumettez vos informations pour que notre équipe puisse valider votre boutique exclusive.</p>
                                </div>
                                <a href="/src/pages/seller-onboarding.html" class="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-xs hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center gap-2 group">
                                    Compléter mon profil
                                    <iconify-icon icon="solar:arrow-right-linear" class="group-hover:translate-x-1 transition-transform"></iconify-icon>
                                </a>
                                <!-- Decorative element -->
                                <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-200/20 rounded-full blur-3xl"></div>
                            </div>
                        `;
                    } else if (status === 'submitted') {
                        content = `
                            <div class="relative overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-8 rounded-[2.5rem] flex flex-col lg:flex-row items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-700 shadow-sm">
                                <div class="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-blue-500 shadow-xl shadow-blue-200/50 shrink-0">
                                    <iconify-icon icon="solar:reorder-bold-duotone" width="32" class="animate-pulse"></iconify-icon>
                                </div>
                                <div class="flex-1 text-center md:text-left">
                                    <div class="flex items-center justify-center md:justify-start gap-2 mb-1">
                                        <h3 class="font-black text-blue-900 text-lg">Validation en cours</h3>
                                        <span class="px-2 py-0.5 bg-blue-500 text-white text-[9px] font-black rounded-full uppercase tracking-tighter">En cours</span>
                                    </div>
                                    <p class="text-sm text-blue-700/80 leading-relaxed max-w-xl">Votre demande est entre les mains de nos experts. Vous recevrez une notification d'approbation sous peu.</p>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="flex -space-x-2">
                                        <div class="w-8 h-8 rounded-full border-2 border-white bg-blue-100"></div>
                                        <div class="w-8 h-8 rounded-full border-2 border-white bg-blue-200"></div>
                                        <div class="w-8 h-8 rounded-full border-2 border-white bg-blue-300"></div>
                                    </div>
                                    <span class="text-[10px] font-black text-blue-900 uppercase tracking-widest">Team NewKet</span>
                                </div>
                                <!-- Decorative element -->
                                <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
                            </div>
                        `;
                    } else if (status === 'rejected') {
                         content = `
                            <div class="bg-red-50 border border-red-100 p-6 rounded-[2rem] flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div class="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-600 shrink-0">
                                    <iconify-icon icon="solar:danger-bold" width="24"></iconify-icon>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-bold text-red-900">Profil rejeté</h3>
                                    <p class="text-sm text-red-700">Votre profil n'a pas pu être validé. Veuillez vérifier vos informations et soumettre à nouveau.</p>
                                </div>
                                <a href="./seller-onboarding" class="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-200/50">Réessayer</a>
                            </div>
                        `;
                    }
                    banner.innerHTML = content;
                }

                function buildResponsiveImageAttrs(source, widths, sizes, opts = {}) {
                    if (typeof window.buildResponsiveImageSrcSet !== 'function') return '';
                    const srcset = window.buildResponsiveImageSrcSet(source, widths, opts);
                    if (!srcset) return '';
                    return ` srcset="${srcset}"${sizes ? ` sizes="${sizes}"` : ''}`;
                }

                function renderVendorDashboard() {
                    // Keep the initial skeleton visible until we have at least one data refresh.
                    if (isVendorOrdersDataPending() || isVendorProductsDataPending()) return;

                    if (!window.OrderManager || typeof OrderManager.getVendorStats !== 'function' || !window.CurrencyManager || typeof CurrencyManager.formatPrice !== 'function') {
                        return;
                    }

                    const email = localStorage.getItem('newketUserEmail');
                    const userId = localStorage.getItem('newketUserId');
                    const stats = OrderManager.getVendorStats(userId || email);
                    const setText = (id, value) => {
                        const element = document.getElementById(id);
                        if (element) element.textContent = value;
                    };
                    const products = Array.isArray(window.ProductManager?.getProducts?.()) ? ProductManager.getProducts() : [];

                    // Update Stats Slates
                    setText('vendorTotalSales', CurrencyManager.formatPrice(stats.totalRevenue || 0));
                    setText('vendorConversionRate', (stats.conversionRate || 0) + '%');
                    setText('vendorAvgOrder', CurrencyManager.formatPrice(stats.averageOrderValue || 0));
                    setText('vendorOrders', stats.totalOrders || 0);

                    const myProducts = products.filter(p => p.supplier_email === email);
                    setText('vendorProducts', myProducts.length);

                    // Calculate Total Product Views
                    const totalViews = myProducts.reduce((sum, p) => sum + (p.views || 0), 0);
                    setText('vendorTotalViews', totalViews);

                    // Calculate Average Rating from Reviews
                    const productIds = myProducts.map(p => p.id);
                    if (productIds.length > 0) {
                        window.SupabaseAdapter.fetchWithFilters('product_reviews', {
                            in: [['product_id', productIds]],
                            select: 'rating'
                        }).then(reviews => {
                            if (reviews && reviews.length > 0) {
                                const sum = reviews.reduce((acc, r) => acc + (parseInt(r.rating) || 0), 0);
                                const avg = (sum / reviews.length).toFixed(1);
                                if (document.getElementById('vendorRating')) document.getElementById('vendorRating').textContent = avg;
                            } else {
                                if (document.getElementById('vendorRating')) document.getElementById('vendorRating').textContent = '-';
                            }
                        });
                    } else {
                        if (document.getElementById('vendorRating')) document.getElementById('vendorRating').textContent = '-';
                    }

                    // Render Recent Orders
                    let recentOrders = stats.orders || [];
                    
                    // Sorting Logic
                    if (window.vendorOrderState.sortColumn) {
                        recentOrders = [...recentOrders].sort((a, b) => {
                            let valA = a[window.vendorOrderState.sortColumn];
                            let valB = b[window.vendorOrderState.sortColumn];
                            
                            // Special cases
                            if (window.vendorOrderState.sortColumn === 'id') {
                                valA = a.created_at || a.id;
                                valB = b.created_at || b.id;
                            }
                            
                            if (valA < valB) return window.vendorOrderState.sortDirection === 'asc' ? -1 : 1;
                            if (valA > valB) return window.vendorOrderState.sortDirection === 'asc' ? 1 : -1;
                            return 0;
                        });
                    }
                    
                    // Update sort icons
                    ['id', 'total', 'status'].forEach(col => {
                        const icon = document.getElementById(`sort-icon-${col}`);
                        if (icon) {
                            if (col === window.vendorOrderState.sortColumn) {
                                icon.classList.remove('opacity-0', 'group-hover:opacity-50');
                                icon.classList.add('opacity-100', 'text-black');
                                icon.setAttribute('icon', window.vendorOrderState.sortDirection === 'asc' ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear');
                            } else {
                                icon.classList.add('opacity-0', 'group-hover:opacity-50');
                                icon.classList.remove('opacity-100', 'text-black');
                                icon.setAttribute('icon', 'solar:alt-arrow-down-linear');
                            }
                        }
                    });

                    window.vendorOrderState.orders = recentOrders;

                    const ordersTable = document.getElementById('vendor-recent-orders');
                    if (!ordersTable) return;
                    if (recentOrders.length === 0) {
                        ordersTable.innerHTML = `
                            <tr>
                                <td colspan="8" class="py-16 text-center">
                                    <div class="flex flex-col items-center justify-center gap-3">
                                        <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-2">
                                            <iconify-icon icon="solar:box-minimalistic-bold-duotone" width="32"></iconify-icon>
                                        </div>
                                        <h4 class="font-bold text-gray-900 text-lg">Aucune commande</h4>
                                        <p class="text-sm text-gray-400 max-w-sm">Vous n'avez pas encore reçu de commandes. Continuez à promouvoir vos produits !</p>
                                    </div>
                                </td>
                            </tr>
                        `;
                    } else {
                        ordersTable.innerHTML = recentOrders.map(o => `
                        <tr class="hover:bg-gray-50 transition-all cursor-pointer group" onclick="if(!event.target.closest('input[type=checkbox]')) openOrderDetailModal('${o.id}')">
                            <td class="py-4 w-10" onclick="event.stopPropagation()">
                                <input type="checkbox" value="${o.id}" class="vendor-order-checkbox rounded border-gray-300 text-black focus:ring-black cursor-pointer" ${window.vendorOrderState.selectedOrders.has(o.id) ? 'checked' : ''} onchange="window.toggleOrderSelection(this, '${o.id}')">
                            </td>
                            <td class="py-4 font-bold text-xs uppercase tracking-wider text-gray-400">#${o.id.substring(0, 6)}</td>
                            <td class="py-4">
                                <div class="flex items-center gap-3">
                                    <div class="relative shrink-0 flex items-center">
                                        <div class="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center border-2 border-white shadow-sm z-10">
                                            ${o.customer?.avatar ? `<img src="${window.getOptimizedImageUrl(o.customer.avatar)}"${buildResponsiveImageAttrs(o.customer.avatar, [36, 48, 72], '36px', { quality: 70 })} class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
                                            <iconify-icon icon="solar:user-bold" width="14" class="text-gray-400" style="${o.customer?.avatar ? 'display:none;' : ''}"></iconify-icon>
                                        </div>
                                        <div class="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden -ml-3 border-2 border-white shadow-sm z-0">
                                            <img src="${window.getOptimizedImageUrl(o.product_image || o.image_url)}"${buildResponsiveImageAttrs(o.product_image || o.image_url, [36, 48, 72], '36px', { quality: 70 })} class="w-full h-full object-cover" onerror="this.onerror=null; this.src='../assets/Images/default.png';">
                                        </div>
                                    </div>
                                    <div class="flex flex-col min-w-0">
                                        <span class="text-sm font-bold text-gray-900 line-clamp-1">${o.customer?.name || o.customer_name || 'Client'}</span>
                                        <span class="text-[10px] text-gray-400 line-clamp-1">${o.product_name || (o.items && o.items[0]?.name) || 'Produit'}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4">
                                ${o.phone_number ? `
                                    <div class="text-[10px] font-black bg-gray-100 px-2 py-1 rounded-md inline-flex items-center gap-1 group-hover:bg-black group-hover:text-white transition-all">
                                        <iconify-icon icon="solar:phone-bold" width="10"></iconify-icon>
                                        ${o.phone_number}
                                    </div>
                                ` : '<span class="text-gray-300">-</span>'}
                            </td>
                            <td class="py-4 font-black text-right text-sm">${CurrencyManager.formatPrice(o.total)}</td>
                            <td class="py-4 text-center">
                                <div class="flex flex-col items-center gap-1">
                                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${getPaymentStatusStyle(o.payment_status)}">${o.payment_status || 'N/A'}</span>
                                    ${o.transaction_id ? `<span class="text-[7px] font-black text-gray-300 uppercase tracking-tighter">ID: ${o.transaction_id.substring(0, 8)}...</span>` : ''}
                                </div>
                            </td>
                            <td class="py-4 text-center">
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusColor(o.status)}">${window.OrderManager ? OrderManager.getStatusLabel(o.status) : o.status}</span>
                            </td>
                            <td class="py-4 text-right pr-4">
                                <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                    <iconify-icon icon="solar:eye-bold" width="16"></iconify-icon>
                                </div>
                            </td>
                        </tr>
                `).join('');
                    }
                    window.updateBulkActionBar();

                    // Render Chart
                    const chartData = buildVendorInterestChartData(stats.orders || [], myProducts);
                    renderSalesChart(chartData);

                    // Activity feed handled by main.js logic generally or locally:
                    const feed = document.getElementById('vendor-activity-feed');
                    if (feed) {
                        const activities = (window.ActivityManager && typeof ActivityManager.getRecentActivity === 'function')
                            ? ActivityManager.getRecentActivity(6)
                            : [];
                        feed.innerHTML = activities.length ? activities.map(a => `
                            <div class="flex items-start gap-4 p-4 border border-gray-50 rounded-2xl min-w-[280px] shrink-0 snap-start">
                                <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm">
                                    <iconify-icon icon="${a.type === 'stock' ? 'solar:box-bold' : 'solar:bell-bold'}" width="20"></iconify-icon>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-gray-900">${a.text}</p>
                                    <p class="text-[10px] font-black text-gray-400 uppercase">${ActivityManager.formatTime(a.time)}</p>
                                </div>
                            </div>
                        `).join('') : '<p class="text-sm text-gray-400 py-4 col-span-full text-center">Aucune activité.</p>';
                    }
                    // (moved out of render loop) status + orders listeners are bound once during init
                }

                function getStatusColor(status) {
                    switch (status) {
                        case 'PENDING': return 'bg-amber-50 text-amber-600';
                        case 'QUOTE': return 'bg-orange-50 text-orange-600';
                        case 'READY_FOR_PAYMENT': return 'bg-indigo-50 text-indigo-600';
                        case 'PROCESSING': return 'bg-yellow-50 text-yellow-600';
                        case 'PAID_HELD': return 'bg-purple-50 text-purple-600';
                          case 'IN_DELIVERY':
                          case 'SHIPPED': return 'bg-blue-50 text-blue-600';
                          case 'DELIVERED': return 'bg-teal-50 text-teal-600';
                          case 'RELEASED': 
                          case 'COMPLETED': return 'bg-green-50 text-green-600';
                          case 'CANCELLED': return 'bg-gray-100 text-gray-500';
                          case 'REFUNDED': return 'bg-orange-50 text-orange-600';
                          case 'DISPUTE_OPEN':
                          case 'DISPUTED': return 'bg-orange-50 text-orange-600';
                          case 'FROZEN': return 'bg-red-50 text-red-600';
                          default: return 'bg-gray-50 text-gray-400';
                      }
                  }

                function getPaymentStatusStyle(status) {
                    switch (status?.toUpperCase()) {
                        case 'SUCCESSFUL':
                        case 'SUCCESS': 
                        case 'PAID':
                            return 'bg-green-50 text-green-600 border border-green-100';
                        case 'PENDING': 
                            return 'bg-amber-50 text-amber-600 border border-amber-100';
                        case 'FAILED': 
                            return 'bg-red-50 text-red-600 border border-red-100';
                        default: 
                            return 'bg-gray-50 text-gray-400 border border-transparent';
                    }
                }

                function renderSalesChart(chartData) {
                    if (typeof Chart === 'undefined') {
                        console.error('[VendorDashboard] Chart.js failed to load.');
                        return;
                    }
                    const ctx = document.getElementById('salesChart');
                    if (!ctx) return;
                    const skeleton = document.getElementById('vendorSalesChartSkeleton');
                    const isMobile = window.matchMedia('(max-width: 640px)').matches;
                    const rawLabels = Array.isArray(chartData?.labels) ? chartData.labels : [];
                    const rawData = Array.isArray(chartData?.data) ? chartData.data.map(value => Number(value) || 0) : [];
                    const visibleLabels = isMobile ? rawLabels.slice(-4) : rawLabels;
                    const visibleData = isMobile ? rawData.slice(-4) : rawData;
                    const normalizedData = {
                        labels: visibleLabels,
                        data: visibleData
                    };
                    if (salesChart) salesChart.destroy();
                    salesChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: normalizedData.labels,
                            datasets: [{
                                label: 'Ventes',
                                data: normalizedData.data,
                                borderColor: '#000000',
                                backgroundColor: (context) => {
                                    const chart = context.chart;
                                    const {ctx, chartArea} = chart;
                                    if (!chartArea) return null;
                                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                    gradient.addColorStop(0, 'rgba(0,0,0,0.05)');
                                    gradient.addColorStop(1, 'rgba(0,0,0,0)');
                                    return gradient;
                                },
                                borderWidth: 2.5, 
                                tension: 0.4, 
                                fill: true,
                                pointBackgroundColor: '#000000',
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 1.5,
                                pointRadius: isMobile ? 3 : 4.5,
                                pointHoverRadius: isMobile ? 5 : 7
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                                intersect: false,
                                mode: 'index'
                            },
                            layout: { 
                                padding: { 
                                    left: isMobile ? 10 : 36, 
                                    right: isMobile ? 10 : 30, 
                                    top: 20, 
                                    bottom: isMobile ? 0 : 8 
                                } 
                            },
                            plugins: { 
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#000000',
                                    padding: 10,
                                    titleFont: { size: 11, weight: 'bold' },
                                    bodyFont: { size: 11 },
                                    displayColors: false
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    grace: '15%',
                                    grid: { display: true, color: 'rgba(0,0,0,0.03)', drawBorder: false },
                                    ticks: {
                                        font: { size: isMobile ? 8 : 10, weight: 'bold' },
                                        color: '#94a3b8',
                                        maxTicksLimit: isMobile ? 4 : 6,
                                        padding: 8
                                    }
                                },
                                x: {
                                    grid: { display: false },
                                    ticks: {
                                        autoSkip: true,
                                        maxRotation: 0,
                                        minRotation: 0,
                                        maxTicksLimit: isMobile ? 5 : 7,
                                        font: { size: isMobile ? 8 : 10, weight: 'bold' },
                                        color: '#94a3b8',
                                        padding: 8
                                    }
                                }
                            }
                        }
                    });
                    if (skeleton) skeleton.classList.add('hidden');
                    // Force resize: ensures correct canvas sizing on mobile after DOM paint
                    requestAnimationFrame(() => { if (salesChart) salesChart.resize(); });
                }

                function buildVendorInterestChartData(orders, products) {
                    const labels = [];
                    const dailyTotals = new Map();
                    const today = new Date();

                    for (let offset = 6; offset >= 0; offset -= 1) {
                        const currentDay = new Date(today);
                        currentDay.setHours(0, 0, 0, 0);
                        currentDay.setDate(today.getDate() - offset);
                        const key = currentDay.toISOString().slice(0, 10);
                        labels.push(currentDay.toLocaleDateString('fr-FR', { weekday: 'short' }));
                        dailyTotals.set(key, 0);
                    }

                    (Array.isArray(orders) ? orders : []).forEach(order => {
                        const rawDate = order?.date || order?.created_at || order?.createdAt;
                        if (!rawDate) return;
                        const parsedDate = new Date(rawDate);
                        if (Number.isNaN(parsedDate.getTime())) return;
                        const key = parsedDate.toISOString().slice(0, 10);
                        if (!dailyTotals.has(key)) return;
                        dailyTotals.set(key, (dailyTotals.get(key) || 0) + 1);
                    });

                    const data = Array.from(dailyTotals.values());
                    const hasOrders = data.some(value => value > 0);
                    if (hasOrders) return { labels, data };

                    const fallbackProducts = (Array.isArray(products) ? products : [])
                        .slice()
                        .sort((left, right) => (Number(right.views) || 0) - (Number(left.views) || 0))
                        .slice(0, 7);

                    if (fallbackProducts.length > 0) {
                        return {
                            labels: fallbackProducts.map(product => (product.name || 'Produit').slice(0, 10)),
                            data: fallbackProducts.map(product => Number(product.views) || 0)
                        };
                    }

                    return { labels, data };
                }

                function renderVendorAnalytics() {
                    // Skeleton during real async boot (orders/products). No forced/min duration.
                    if (isVendorOrdersDataPending() || isVendorProductsDataPending()) {
                        const setInlineSkeleton = (id, width = '70%') => {
                            const el = document.getElementById(id);
                            if (!el) return;
                            el.innerHTML = `<div class="skeleton skeleton-text" style="width:${width};height:1em;margin:0 auto;"></div>`;
                        };
                        setInlineSkeleton('analyticsShopViews', '55%');
                        setInlineSkeleton('analyticsUniqueVisitors', '45%');
                        setInlineSkeleton('analyticsProductViews', '60%');
                        setInlineSkeleton('analyticsEngagementRate', '40%');

                        const top = document.getElementById('analyticsTopProducts');
                        if (top && typeof window.buildSkeletonPanelListHTML === 'function') {
                            top.innerHTML = window.buildSkeletonPanelListHTML(4, { lines: 2, cardClass: 'glass-panel p-4' });
                        }
                        return;
                    }

                    if (!window.ProductManager || typeof ProductManager.getProducts !== 'function' || !window.OrderManager || typeof OrderManager.getVendorStats !== 'function') {
                        return;
                    }

                    const email = localStorage.getItem('newketUserEmail');
                    const userId = localStorage.getItem('newketUserId');
                    const allProducts = Array.isArray(ProductManager.getProducts()) ? ProductManager.getProducts() : [];
                    const vendorStats = window.OrderManager ? OrderManager.getVendorStats(userId || email) : { orders: [] };
                    const myProducts = allProducts.filter(product =>
                        product?.supplier_email === email || product?.user_id === userId
                    );
                    const totalProductViews = myProducts.reduce((sum, product) => sum + (Number(product?.views) || 0), 0);

                    const setAnalyticsText = (id, value) => {
                        const element = document.getElementById(id);
                        if (element) element.textContent = value;
                    };

                    const buildLocalAnalyticsMetrics = () => {
                        const uniqueVisitors = new Set(
                            (vendorStats.orders || [])
                                .map(order => order?.customer_id || order?.user_id || order?.customer_email || '')
                                .filter(Boolean)
                        ).size;

                        return {
                            success: true,
                            total_views: Math.max(totalProductViews, vendorStats.totalOrders || 0),
                            unique_visitors: uniqueVisitors,
                            history: []
                        };
                    };

                    const applyAnalyticsMetrics = (metrics) => {
                        const normalizedMetrics = metrics?.success ? metrics : buildLocalAnalyticsMetrics();
                        const shopViews = Number(normalizedMetrics.total_views) || 0;
                        const uniqueVisitors = Number(normalizedMetrics.unique_visitors) || 0;
                        const engagementBase = uniqueVisitors || 1;
                        const engagement = Math.min(100, Math.round((totalProductViews / engagementBase) * 10)) / 10;
                        const chartData = Array.isArray(normalizedMetrics.history) && normalizedMetrics.history.length
                            ? {
                                labels: normalizedMetrics.history.map(point => point.label),
                                data: normalizedMetrics.history.map(point => Number(point.value) || 0)
                            }
                            : buildVendorInterestChartData(vendorStats.orders || [], myProducts);

                        setAnalyticsText('analyticsProductViews', totalProductViews.toLocaleString());
                        setAnalyticsText('analyticsShopViews', shopViews.toLocaleString());
                        setAnalyticsText('analyticsUniqueVisitors', uniqueVisitors.toLocaleString());
                        setAnalyticsText('analyticsEngagementRate', `${engagement}%`);
                        renderAudienceChart(chartData);
                    };

                    applyAnalyticsMetrics(buildLocalAnalyticsMetrics());

                    const updateShopMetrics = async () => {
                        try {
                            let metrics;
                            if (window.__cachedVendorMetrics && Date.now() - window.__cachedVendorMetrics.timestamp < 60000) {
                                metrics = window.__cachedVendorMetrics.data;
                            } else {
                                metrics = await ApiClient.get('/analytics/vendor/shop-metrics?days=30', {
                                    suppressNetworkError: true,
                                    suppressErrorLogging: true
                                });
                                if (metrics?.success) {
                                    window.__cachedVendorMetrics = { data: metrics, timestamp: Date.now() };
                                }
                            }

                            if (!metrics?.success) {
                                return;
                            }

                            applyAnalyticsMetrics(metrics);
                        } catch (error) {
                            console.warn('[VendorAnalytics] Remote metrics unavailable, local fallback kept.', error?.message || error);
                        }
                    };

                    updateShopMetrics();

                    // 3. Render Top Products
                    const topProducts = [...myProducts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
                    const topProductsContainer = document.getElementById('analyticsTopProducts');
                    if (topProductsContainer) {
                        topProductsContainer.innerHTML = topProducts.length ? topProducts.map((p, index) => `
                            <div class="flex items-center gap-4 group cursor-pointer p-2 hover:bg-gray-50 rounded-2xl transition-all" onclick="window.location.href=(window.NewKetLinks?.buildProductPagePath ? window.NewKetLinks.buildProductPagePath({ productName: p.name, productId: p.id }) : 'product?id=${p.id}')">
                                <div class="w-10 h-10 rounded-xl bg-white overflow-hidden border border-gray-100 shrink-0 shadow-sm">
                                    <img src="${window.getOptimizedImageUrl(p.image ? p.image.split(',')[0] : '')}"${buildResponsiveImageAttrs(p.image ? p.image.split(',')[0] : '', [120, 180, 240], '56px', { quality: 75 })} class="w-full h-full object-contain p-1" onerror="this.src='../assets/Images/default.png'">
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-xs text-gray-900 truncate group-hover:text-black transition-colors">${p.name}</h4>
                                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">${p.category || 'Luxe'}</p>
                                </div>
                                <div class="text-right">
                                    <p class="font-black text-sm text-gray-900">${p.views || 0}</p>
                                    <p class="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Vues</p>
                                </div>
                            </div>
                        `).join('') : '<p class="text-center text-xs text-gray-400 py-8">Aucun produit en ligne.</p>';
                    }
                }

                function renderAudienceChart(chartData) {
                    if (typeof Chart === 'undefined') {
                        console.error('[VendorDashboard] Chart.js failed to load.');
                        return;
                    }
                    const ctx = document.getElementById('audienceChart');
                    if (!ctx) return;
                    const isMobile = window.matchMedia('(max-width: 640px)').matches;
                    const audienceLabels = Array.isArray(chartData?.labels) ? chartData.labels : [];
                    const audienceData = Array.isArray(chartData?.data) ? chartData.data : [];
                    const visibleAudienceLabels = isMobile ? audienceLabels.slice(-4) : audienceLabels;
                    const visibleAudienceData = isMobile ? audienceData.slice(-4) : audienceData;
                    if (audienceChart) audienceChart.destroy();
                    audienceChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: visibleAudienceLabels,
                            datasets: [{
                                label: 'Visites',
                                data: visibleAudienceData,
                                borderColor: '#000000',
                                backgroundColor: (context) => {
                                    const chart = context.chart;
                                    const {ctx, chartArea} = chart;
                                    if (!chartArea) return null;
                                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                    gradient.addColorStop(0, 'rgba(0,0,0,0.05)');
                                    gradient.addColorStop(1, 'rgba(0,0,0,0)');
                                    return gradient;
                                },
                                borderWidth: 2.5,
                                tension: 0.4,
                                fill: true,
                                pointBackgroundColor: '#000000',
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 1.5,
                                pointRadius: isMobile ? 3 : 4.5,
                                pointHoverRadius: isMobile ? 5 : 7
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { 
                                padding: { 
                                    left: isMobile ? 10 : 20, 
                                    right: isMobile ? 10 : 20, 
                                    top: 20, 
                                    bottom: isMobile ? 0 : 8 
                                } 
                            },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#000000',
                                    titleFont: { size: 10, weight: 'bold' },
                                    bodyFont: { size: 12 },
                                    padding: 12,
                                    displayColors: false,
                                    callbacks: {
                                        label: (context) => `${context.parsed.y} visites`
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false },
                                    ticks: { 
                                        font: { size: isMobile ? 8 : 10, weight: 'bold' }, 
                                        color: '#94a3b8',
                                        maxTicksLimit: isMobile ? 4 : 6
                                    }
                                },
                                x: {
                                    offset: true,
                                    grid: { display: false },
                                    ticks: { 
                                        font: { size: isMobile ? 8 : 10, weight: 'bold' }, 
                                        color: '#94a3b8',
                                        maxTicksLimit: isMobile ? 5 : 7
                                    }
                                }
                            }
                        }
                    });
                    // Force resize: ensures correct canvas sizing on mobile after DOM paint
                    requestAnimationFrame(() => { if (audienceChart) audienceChart.resize(); });
                }

                function renderVendorProducts() {
                    const grid = document.getElementById('vendor-products-grid');
                    if (!grid) return;
                    if (isVendorProductsDataPending()) {
                        if (typeof window.buildSkeletonCardHTML === 'function') grid.innerHTML = window.buildSkeletonCardHTML(3);
                        return;
                    }

                    if (!window.ProductManager || typeof ProductManager.getProducts !== 'function') {
                        grid.innerHTML = `
                            <div class="col-span-full glass-panel p-12 text-center text-gray-500">
                                <iconify-icon icon="solar:shield-warning-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                                <p>Catalogue indisponible</p>
                            </div>
                        `;
                        return;
                    }

                    const email = localStorage.getItem('newketUserEmail');
                    const userId = localStorage.getItem('newketUserId');
                    const searchQuery = document.getElementById('dashboardSearch')?.value.toLowerCase() || '';

                    let myProducts = ProductManager.getProducts().filter((product) =>
                        product?.supplier_email === email || product?.user_id === userId
                    );

                    // Apply search filter
                    if (searchQuery) {
                        myProducts = myProducts.filter((p) => {
                            const name = String(p?.name || '').toLowerCase();
                            const category = String(p?.category || '').toLowerCase();
                            return name.includes(searchQuery) || category.includes(searchQuery);
                        });
                    }

                    if (!myProducts.length) {
                        const publishUrl = (typeof window.resolvePath === 'function')
                            ? window.resolvePath('pages/publish')
                            : '/src/pages/publish.html';

                        if (searchQuery) {
                            grid.innerHTML = `
                                <div class="col-span-full glass-panel p-12 text-center text-gray-500">
                                    <iconify-icon icon="solar:magnifer-zoom-out-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                                    <h4 class="font-black text-gray-900 mb-2">Aucun résultat</h4>
                                    <p class="text-xs text-gray-400 max-w-[320px] leading-relaxed mx-auto mb-6">Essayez un autre mot-clé, ou effacez la recherche.</p>
                                    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                                        <button type="button" id="vendorClearSearchInline" class="px-8 py-3 bg-gray-50 border border-gray-100 text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">
                                            Effacer la recherche
                                        </button>
                                        <a href="${publishUrl}" class="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200">
                                            Ajouter un produit
                                        </a>
                                    </div>
                                </div>
                            `;
                            document.getElementById('vendorClearSearchInline')?.addEventListener('click', () => {
                                const input = document.getElementById('dashboardSearch');
                                if (input) input.value = '';
                                document.getElementById('vendorSearchClearBtn')?.classList.add('hidden');
                                renderVendorProducts();
                                input?.focus?.();
                            });
                        } else {
                            grid.innerHTML = `
                                <div class="col-span-full glass-panel p-12 text-center text-gray-500">
                                    <iconify-icon icon="solar:box-minimalistic-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                                    <h4 class="font-black text-gray-900 mb-2">Aucun produit en ligne</h4>
                                    <p class="text-xs text-gray-400 max-w-[340px] leading-relaxed mx-auto mb-8">Ajoutez votre premier produit pour commencer à recevoir des demandes et des paiements.</p>
                                    <a href="${publishUrl}" class="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200">
                                        Ajouter un produit
                                    </a>
                                </div>
                            `;
                        }
                        return;
                    }

                    grid.innerHTML = myProducts.map(p => `
                        <div class="glass-panel p-4 flex flex-col group relative">
                            <div class="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden relative">
                                 <img src="${window.getOptimizedImageUrl ? window.getOptimizedImageUrl(p.image ? p.image.split(',')[0] : '') : (p.image ? p.image.split(',')[0] : '')}"${buildResponsiveImageAttrs(p.image ? p.image.split(',')[0] : '', [120, 180, 240], '120px', { quality: 75 })} alt="${p.name}" loading="lazy" class="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform" onerror="this.src='../assets/Images/default.png'">
                                 <!-- Edit/Delete/Archive Overlay -->
                                 <div class="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                     <button type="button" onclick="window.location.href='${window.resolvePath('pages/publish')}?edit=${p.id}'" class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title="Modifier" aria-label="Modifier">
                                         <iconify-icon icon="solar:pen-bold" width="20"></iconify-icon>
                                     </button>
                                     <button type="button" onclick="archiveVendorProduct('${p.id}')" class="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title="Archiver" aria-label="Archiver">
                                         <iconify-icon icon="solar:archive-bold" width="20"></iconify-icon>
                                     </button>
                                     <button type="button" onclick="deleteProduct('${p.id}')" class="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title="Supprimer" aria-label="Supprimer">
                                         <iconify-icon icon="solar:trash-bin-trash-bold" width="20"></iconify-icon>
                                     </button>
                                 </div>
                            </div>
                            <h3 class="font-bold text-sm mb-1 truncate">${p.name}</h3>
                            <div class="flex items-center justify-between text-xs mb-3">
                                <span class="font-black text-gray-900">${CurrencyManager.formatPrice(p.price)}</span>
                                <div class="flex items-center gap-2">
                                    <span class="flex items-center gap-1 text-gray-400">
                                        <iconify-icon icon="solar:eye-bold" width="12"></iconify-icon>
                                        ${p.views || 0}
                                    </span>
                                    <span class="text-gray-400">Stock: ${p.stock || 0}</span>
                                </div>
                            </div>
                            <div class="flex gap-2 mt-auto">
                                <button type="button" onclick="window.location.href='${window.resolvePath('pages/publish')}?edit=${p.id}'" class="flex-1 py-2.5 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                                    <iconify-icon icon="solar:pen-bold" width="14"></iconify-icon>
                                    Modifier
                                </button>
                                <button type="button" onclick="archiveVendorProduct('${p.id}')" class="w-10 h-10 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all flex items-center justify-center shadow-sm" title="Archiver" aria-label="Archiver">
                                    <iconify-icon icon="solar:archive-bold" width="16"></iconify-icon>
                                </button>
                                <button type="button" onclick="deleteProduct('${p.id}')" class="w-10 h-10 rounded-xl border border-gray-100 text-red-500 hover:bg-red-50 transition-all flex items-center justify-center shadow-sm" title="Supprimer" aria-label="Supprimer">
                                    <iconify-icon icon="solar:trash-bin-trash-bold" width="16"></iconify-icon>
                                </button>
                            </div>
                        </div>
                    `).join('');
                }

                async function deleteProduct(id) {
                    const runDelete = async () => {
                        try {
                            const success = await ProductManager.deleteProduct(id);
                            if (success) {
                                if (window.showToast) showToast('Produit supprimé !', 'success');
                                renderVendorDashboard(); // Refresh total count
                                renderVendorProducts(); // Refresh grid
                                ActivityManager.log(`Produit supprimé de votre catalogue`, 'stock');
                            }
                        } catch (error) {
                            if (window.showToast) showToast('Erreur lors de la suppression.', 'error');
                        }
                    };

                    if (typeof window.showConfirm === 'function') {
                        window.showConfirm(
                            'Supprimer cet article',
                            'Cette action est irréversible. Continuer ?',
                            runDelete
                        );
                        return;
                    }

                    if (confirm('Voulez-vous vraiment supprimer cet article ? Cette action est irréversible.')) {
                        await runDelete();
                    }
                }

                async function archiveVendorProduct(id) {
                    const runArchive = async () => {
                        try {
                            if (!window.ProductManager || typeof ProductManager.archiveProduct !== 'function') {
                                if (window.showToast) showToast('Fonctionnalité indisponible.', 'error');
                                return;
                            }
                            const success = await ProductManager.archiveProduct(id);
                            if (success) {
                                if (window.showToast) showToast('Article archivé. Il n\'est plus visible dans le catalogue.', 'success');
                                renderVendorDashboard();
                                renderVendorProducts();
                                renderVendorArchived();
                                _updateArchivedCountBadge();
                                if (window.ActivityManager) ActivityManager.log('Article archivé', 'stock');
                            } else {
                                if (window.showToast) showToast('Erreur lors de l\'archivage.', 'error');
                            }
                        } catch (err) {
                            if (window.showToast) showToast('Erreur lors de l\'archivage.', 'error');
                        }
                    };

                    if (typeof window.showConfirm === 'function') {
                        window.showConfirm(
                            'Archiver cet article',
                            'L\'article sera masqué du catalogue mais pourra être restauré à tout moment.',
                            runArchive
                        );
                        return;
                    }
                    if (confirm('Archiver cet article ? Il sera masqué du catalogue mais pourra être restauré.')) {
                        await runArchive();
                    }
                }

                async function restoreVendorProduct(id) {
                    try {
                        if (!window.ProductManager || typeof ProductManager.restoreProduct !== 'function') {
                            if (window.showToast) showToast('Fonctionnalité indisponible.', 'error');
                            return;
                        }
                        const success = await ProductManager.restoreProduct(id);
                        if (success) {
                            if (window.showToast) showToast('Article restauré ! Il est de nouveau visible dans le catalogue.', 'success');
                            renderVendorDashboard();
                            renderVendorProducts();
                            renderVendorArchived();
                            _updateArchivedCountBadge();
                            if (window.ActivityManager) ActivityManager.log('Article restauré dans le catalogue', 'stock');
                        } else {
                            if (window.showToast) showToast('Erreur lors de la restauration.', 'error');
                        }
                    } catch (err) {
                        if (window.showToast) showToast('Erreur lors de la restauration.', 'error');
                    }
                }

                function _updateArchivedCountBadge() {
                    const badge = document.getElementById('vendorArchivedCountBadge');
                    if (!badge || !window.ProductManager) return;
                    const count = ProductManager.getArchivedProducts ? ProductManager.getArchivedProducts().length : 0;
                    if (count > 0) {
                        badge.textContent = count;
                        badge.classList.remove('hidden');
                    } else {
                        badge.classList.add('hidden');
                    }
                }

                function renderVendorArchived() {
                    const grid = document.getElementById('vendor-archived-grid');
                    const emptyState = document.getElementById('vendor-archived-empty');
                    if (!grid) return;

                    if (!window.ProductManager) {
                        grid.innerHTML = `<div class="col-span-full glass-panel p-12 text-center text-gray-500"><p>Catalogue indisponible</p></div>`;
                        return;
                    }

                    const archivedProducts = ProductManager.getArchivedProducts ? ProductManager.getArchivedProducts() : [];

                    if (!archivedProducts.length) {
                        grid.innerHTML = '';
                        if (emptyState) {
                            emptyState.classList.remove('hidden');
                            emptyState.style.display = 'flex';
                        }
                        _updateArchivedCountBadge();
                        return;
                    }

                    if (emptyState) {
                        emptyState.classList.add('hidden');
                        emptyState.style.display = '';
                    }

                    grid.innerHTML = archivedProducts.map(p => `
                        <div class="glass-panel p-4 flex flex-col group relative opacity-75 hover:opacity-100 transition-opacity">
                            <!-- Archived badge -->
                            <div class="absolute top-2 left-2 z-10 bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                <iconify-icon icon="solar:archive-bold" width="10"></iconify-icon>
                                Archivé
                            </div>
                            <div class="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden relative">
                                <img src="${window.getOptimizedImageUrl ? window.getOptimizedImageUrl(p.image ? p.image.split(',')[0] : '') : (p.image ? p.image.split(',')[0] : '')}" alt="${p.name}" loading="lazy" class="w-full h-full object-contain p-4 grayscale group-hover:grayscale-0 transition-all" onerror="this.src='../assets/Images/default.png'">
                            </div>
                            <h3 class="font-bold text-sm mb-1 truncate text-gray-600">${p.name}</h3>
                            <div class="flex items-center justify-between text-xs mb-3">
                                <span class="font-black text-gray-400">${CurrencyManager ? CurrencyManager.formatPrice(p.price) : p.price + ' FC'}</span>
                                <span class="text-gray-400">Stock: ${p.stock || 0}</span>
                            </div>
                            <div class="flex gap-2 mt-auto">
                                <button type="button" onclick="restoreVendorProduct('${p.id}')" class="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center justify-center gap-2" title="Restaurer dans le catalogue" aria-label="Restaurer">
                                    <iconify-icon icon="solar:restart-bold" width="14"></iconify-icon>
                                    Restaurer
                                </button>
                                <button type="button" onclick="deleteProduct('${p.id}')" class="w-10 h-10 rounded-xl border border-gray-100 text-red-500 hover:bg-red-50 transition-all flex items-center justify-center shadow-sm" title="Supprimer définitivement" aria-label="Supprimer">
                                    <iconify-icon icon="solar:trash-bin-trash-bold" width="16"></iconify-icon>
                                </button>
                            </div>
                        </div>
                    `).join('');

                    _updateArchivedCountBadge();
                }

                function switchProductsView(view) {
                    const onlineView = document.getElementById('vendor-online-view');
                    const archivedView = document.getElementById('vendor-archived-view');
                    const btnOnline = document.getElementById('vendorTabOnline');
                    const btnArchived = document.getElementById('vendorTabArchived');
                    const searchWrapper = document.getElementById('vendorSearchWrapper');

                    if (!onlineView || !archivedView) return;

                    if (view === 'archived') {
                        onlineView.classList.add('hidden');
                        archivedView.classList.remove('hidden');
                        if (btnOnline) {
                            btnOnline.className = 'px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all text-gray-500 hover:text-gray-800';
                            btnOnline.setAttribute('aria-pressed', 'false');
                        }
                        if (btnArchived) {
                            btnArchived.className = 'px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all bg-black text-white shadow-sm';
                            btnArchived.setAttribute('aria-pressed', 'true');
                        }
                        if (searchWrapper) searchWrapper.classList.add('hidden');
                        // Load archived products if not already loaded
                        if (window.ProductManager && typeof ProductManager.fetchVendorArchived === 'function') {
                            ProductManager.fetchVendorArchived().then(() => renderVendorArchived());
                        } else {
                            renderVendorArchived();
                        }
                    } else {
                        onlineView.classList.remove('hidden');
                        archivedView.classList.add('hidden');
                        if (btnOnline) {
                            btnOnline.className = 'px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all bg-black text-white shadow-sm';
                            btnOnline.setAttribute('aria-pressed', 'true');
                        }
                        if (btnArchived) {
                            btnArchived.className = 'px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all text-gray-500 hover:text-gray-800';
                            btnArchived.setAttribute('aria-pressed', 'false');
                        }
                        if (searchWrapper) searchWrapper.classList.remove('hidden');
                        renderVendorProducts();
                    }
                }

                // Expose globally for onclick handlers
                window.archiveVendorProduct = archiveVendorProduct;
                window.restoreVendorProduct = restoreVendorProduct;
                window.switchProductsView = switchProductsView;

                // React to archived products data updates
                window.addEventListener('archivedProductsUpdated', () => {
                    const archivedView = document.getElementById('vendor-archived-view');
                    if (archivedView && !archivedView.classList.contains('hidden')) {
                        renderVendorArchived();
                    }
                    _updateArchivedCountBadge();
                });

                function renderVendorPurchases() {

                    const purchasesList = document.getElementById('vendor-purchases-list');
                    if (!purchasesList) return;
                    if (isVendorOrdersDataPending()) {
                        if (typeof window.buildSkeletonPanelListHTML === 'function') purchasesList.innerHTML = window.buildSkeletonPanelListHTML(3, { lines: 2, cardClass: 'glass-panel p-4' });
                        return;
                    }

                    if (!window.OrderManager || typeof OrderManager.getCustomerStats !== 'function' || !window.CurrencyManager || typeof CurrencyManager.formatPrice !== 'function') {
                        purchasesList.innerHTML = `
                            <div class="glass-panel p-12 text-center text-gray-500">
                                <iconify-icon icon="solar:shield-warning-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                                <p>Donn&eacute;es indisponibles</p>
                            </div>
                        `;
                        return;
                    }

                    const email = localStorage.getItem('newketUserEmail');
                    const userId = localStorage.getItem('newketUserId');
                    
                    const stats = OrderManager.getCustomerStats(email, userId);
                    const myPurchases = (Array.isArray(stats.orders) ? stats.orders : []).slice().sort((a, b) => {
                        const ta = new Date(a?.timestamp || a?.date || a?.created_at || 0).getTime();
                        const tb = new Date(b?.timestamp || b?.date || b?.created_at || 0).getTime();
                        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
                    });
                    
                    if (document.getElementById('vendorPurchasesTotal')) {
                        document.getElementById('vendorPurchasesTotal').textContent = CurrencyManager.formatPrice(stats.totalSpent || 0);
                    }

                    if (myPurchases.length === 0) {
                        purchasesList.innerHTML = `
                            <div class="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in zoom-in-95 duration-700">
                                <div class="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6 text-gray-200 shadow-inner">
                                    <iconify-icon icon="solar:bag-heart-bold-duotone" width="48"></iconify-icon>
                                </div>
                                <h4 class="font-black text-gray-900 mb-2">Aucun achat pour le moment</h4>
                                <p class="text-xs text-gray-400 max-w-[240px] leading-relaxed mb-8">Vos coups de cœur NewKet apparaîtront ici dès votre première commande.</p>
                                <a href="${typeof window.resolvePath === 'function' ? window.resolvePath('catalog') : '/src/pages/catalog.html'}" class="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200">
                                    Découvrir la collection
                                </a>
                            </div>
                        `;
                    } else {
                        purchasesList.innerHTML = myPurchases.map((o, index) => `
                            <div class="group relative overflow-hidden bg-white border border-gray-100 p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700" style="animation-delay: ${index * 100}ms">
                                <div class="flex items-center gap-5">
                                    <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 transition-colors">
                                        <img src="${window.getOptimizedImageUrl ? window.getOptimizedImageUrl(o.product_image) : (o.product_image || '')}"${buildResponsiveImageAttrs(o.product_image, [120, 180, 240], '56px', { quality: 75 })} 
                                             class="w-full h-full object-contain p-2"
                                             onerror="this.src='../assets/Images/default.png'">
                                    </div>
                                    <div>
                                        <h4 class="font-black text-gray-900 group-hover:translate-x-1 transition-transform duration-300">
                                            ${o.product_name || 'Commande multi-produits'}
                                        </h4>
                                        <div class="flex items-center gap-3 mt-1.5">
                                            <span class="text-[9px] font-black uppercase tracking-tighter text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                                ${new Date(o.date || o.timestamp).toLocaleDateString()}
                                            </span>
                                            <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${getPaymentStatusStyle(o.payment_status)}">
                                                ${o.payment_status || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-6 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                                    <div class="flex flex-col items-start sm:items-end flex-1 sm:flex-none">
                                        <p class="font-black text-lg text-gray-900 leading-none mb-1">${CurrencyManager.formatPrice(o.total)}</p>
                                        <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                                            By: <span class="text-gray-600">${o.supplier_name || o.supplier_email || 'NewKet Boutique'}</span>
                                        </p>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <span class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusColor(o.status)}">
                                            ${window.OrderManager ? OrderManager.getStatusLabel(o.status) : o.status}
                                        </span>
                                        <button onclick="openOrderDetailModal('${o.id}')" 
                                            class="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-all shadow-lg shadow-gray-200 active:scale-95 group/btn">
                                            <iconify-icon icon="solar:maximize-square-minimalistic-bold" width="20" class="group-hover/btn:scale-110 transition-transform"></iconify-icon>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }

                // Order Detail Modal Functions
                function renderVendorLeads() {
                    const leadsList = document.getElementById('vendor-leads-list');
                    if (!leadsList) return;
                    if (isVendorOrdersDataPending()) {
                        if (typeof window.buildSkeletonPanelListHTML === 'function') leadsList.innerHTML = window.buildSkeletonPanelListHTML(3, { lines: 2, cardClass: 'glass-panel p-4' });
                        return;
                    }

                    if (!window.OrderManager || typeof OrderManager.getVendorStats !== 'function' || !window.CurrencyManager || typeof CurrencyManager.formatPrice !== 'function') {
                        leadsList.innerHTML = `<p class="col-span-full py-12 text-center text-sm text-gray-400">Donn&eacute;es indisponibles.</p>`;
                        return;
                    }

                    const email = localStorage.getItem('newketUserEmail');
                    const userId = localStorage.getItem('newketUserId');
                    const stats = OrderManager.getVendorStats(userId || email);
                    const recentOrders = Array.isArray(stats.orders) ? stats.orders : [];

                    const actionStatuses = ['PENDING', 'QUOTE', 'READY_FOR_PAYMENT'];
                    const needsActionOrders = recentOrders.filter((o) => actionStatuses.includes(o.status));

                    // Update leads tab filter UI
                    const actionBtn = document.getElementById('vendorLeadsFilterActionBtn');
                    const allBtn = document.getElementById('vendorLeadsFilterAllBtn');
                    const actionCountEl = document.getElementById('vendorLeadsActionCount');
                    if (actionCountEl) {
                        actionCountEl.textContent = String(needsActionOrders.length);
                        if (needsActionOrders.length === 0) actionCountEl.classList.add('hidden');
                        else actionCountEl.classList.remove('hidden');
                    }

                    const filterMode = window.vendorLeadsFilter || 'action';
                    const setBtnState = () => {
                        if (actionBtn) {
                            const active = filterMode === 'action';
                            actionBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
                            actionBtn.className = active
                                ? 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all bg-black text-white border-black'
                                : 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100';
                        }
                        if (allBtn) {
                            const active = filterMode === 'all';
                            allBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
                            allBtn.className = active
                                ? 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all bg-black text-white border-black'
                                : 'flex-1 sm:flex-none px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100';
                        }
                    };
                    setBtnState();

                    let shownOrders = filterMode === 'all' ? recentOrders : needsActionOrders;
                    // Sort: newest first
                    shownOrders = shownOrders.slice().sort((a, b) => {
                        const ta = new Date(a?.timestamp || a?.date || a?.created_at || 0).getTime();
                        const tb = new Date(b?.timestamp || b?.date || b?.created_at || 0).getTime();
                        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
                    });

                    const leadsBadge = document.getElementById('vendorLeadsBadge');
                    if (leadsBadge) {
                        if (needsActionOrders.length > 0) {
                            leadsBadge.textContent = String(needsActionOrders.length);
                            leadsBadge.classList.remove('hidden');
                        } else {
                            leadsBadge.classList.add('hidden');
                        }
                    }

                    if (recentOrders.length === 0) {
                        leadsList.innerHTML = `
                            <div class="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in zoom-in-95 duration-700">
                                <div class="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6 text-gray-200 shadow-inner">
                                    <iconify-icon icon="solar:chat-square-like-bold-duotone" width="48"></iconify-icon>
                                </div>
                                <h4 class="font-black text-gray-900 mb-2">Aucune demande pour le moment</h4>
                                <p class="text-xs text-gray-400 max-w-[320px] leading-relaxed mb-8">Ajoutez des produits et partagez votre boutique pour recevoir des demandes et des paiements.</p>
                                <div class="flex flex-col sm:flex-row items-center gap-3">
                                    <button type="button" id="vendorGoProductsFromLeads" class="px-8 py-3 bg-gray-50 border border-gray-100 text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">
                                        Voir mes produits
                                    </button>
                                    <a href="${typeof window.resolvePath === 'function' ? window.resolvePath('pages/publish') : '/src/pages/publish.html'}" class="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200">
                                        Ajouter un produit
                                    </a>
                                </div>
                            </div>
                        `;
                        document.getElementById('vendorGoProductsFromLeads')?.addEventListener('click', (e) => {
                            e.preventDefault();
                            switchVendorTab('products', e);
                        });
                        return;
                    }

                    if (shownOrders.length === 0 && filterMode !== 'all') {
                        leadsList.innerHTML = `
                            <div class="glass-panel p-12 text-center text-gray-500">
                                <iconify-icon icon="solar:check-circle-linear" width="48" class="mb-4 text-gray-300"></iconify-icon>
                                <h4 class="font-black text-gray-900 mb-2">Rien à traiter</h4>
                                <p class="text-xs text-gray-400 max-w-[420px] leading-relaxed mx-auto mb-8">Toutes vos demandes sont à jour. Vous pouvez consulter l'historique complet.</p>
                                <button type="button" id="vendorShowAllLeadsBtn" class="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200">
                                    Voir tout
                                </button>
                            </div>
                        `;
                        document.getElementById('vendorShowAllLeadsBtn')?.addEventListener('click', () => {
                            window.vendorLeadsFilter = 'all';
                            renderVendorLeads();
                        });
                        return;
                    }

                    leadsList.innerHTML = shownOrders.map((o, index) => `
                            <div class="group relative overflow-hidden bg-white border border-gray-100 p-5 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700" style="animation-delay: ${index * 100}ms">
                                <div class="flex items-center gap-5">
                                    <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 transition-colors">
                                        <img src="${window.getOptimizedImageUrl ? window.getOptimizedImageUrl(o.product_image) : (o.product_image || '')}"${buildResponsiveImageAttrs(o.product_image, [120, 180, 240], '56px', { quality: 75 })} 
                                             class="w-full h-full object-contain p-2"
                                             onerror="this.src='../assets/Images/default.png'">
                                    </div>
                                    <div>
                                        <h4 class="font-black text-gray-900 group-hover:translate-x-1 transition-transform duration-300">${o.customer?.name || o.customer_name || 'Client'}</h4>
                                        <div class="flex items-center gap-3 mt-1.5">
                                            <span class="text-[9px] font-black uppercase tracking-tighter text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                                ${new Date(o.date || o.timestamp).toLocaleDateString()}
                                            </span>
                                            <span class="flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                                <iconify-icon icon="solar:phone-bold" width="12"></iconify-icon>
                                                ${o.customer_phone || o.phone_number || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-6 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                                    <div class="flex flex-col items-start sm:items-end flex-1 sm:flex-none">
                                        <p class="font-black text-lg text-gray-900 leading-none mb-1">${CurrencyManager.formatPrice(o.total)}</p>
                                        <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest truncate max-w-[150px]">
                                            ${o.product_name || 'Commande'}
                                        </p>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <span class="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusColor(o.status)}">
                                            ${window.OrderManager ? OrderManager.getStatusLabel(o.status) : o.status}
                                        </span>
                                        <button onclick="openOrderDetailModal('${o.id}')" 
                                            class="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-all shadow-lg shadow-gray-200 active:scale-95 group/btn">
                                            <iconify-icon icon="solar:maximize-square-minimalistic-bold" width="20" class="group-hover/btn:scale-110 transition-transform"></iconify-icon>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                }

                // Order Detail Modal Functions
                window.openOrderDetailModal = async function(orderId) {
                    const order = OrderManager.getOrderById(orderId);
                    if (!order) return;

                    // Header Info
                    document.getElementById('vModalOrderId').textContent = `Commande #${order.id.substring(0, 8)}`;
                    document.getElementById('vModalOrderDate').textContent = new Date(order.timestamp || order.date).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                    document.getElementById('vModalCustomerName').textContent = order.customer?.name || order.customer_name || 'Client';
                    document.getElementById('vModalCustomerEmail').textContent = order.customer?.email || order.customer_email || 'Pas d\'email';
                    document.getElementById('vModalCustomerPhone').textContent = order.phone_number || 'Pas de numéro';

                    // Avatar logic
                    const avatarImg = document.getElementById('vModalCustomerAvatar');
                    const avatarIcon = document.getElementById('vModalCustomerIcon');
                    const avatarInitials = document.getElementById('vModalCustomerInitials');
                    
                    // Reset
                    avatarImg.classList.add('hidden');
                    avatarIcon.classList.add('hidden');
                    avatarInitials.classList.add('hidden');
                    
                    if (order.customer?.avatar) {
                        avatarImg.src = window.getOptimizedImageUrl(order.customer.avatar);
                        const avatarSrcSet = window.buildResponsiveImageSrcSet ? window.buildResponsiveImageSrcSet(order.customer.avatar, [36, 48, 72], { quality: 70 }) : '';
                        if (avatarSrcSet) {
                            avatarImg.srcset = avatarSrcSet;
                            avatarImg.sizes = '36px';
                        } else {
                            avatarImg.removeAttribute('srcset');
                            avatarImg.removeAttribute('sizes');
                        }
                        avatarImg.onerror = () => {
                            avatarImg.classList.add('hidden');
                            if (order.customer?.name) {
                                avatarInitials.textContent = order.customer.name.charAt(0);
                                avatarInitials.classList.remove('hidden');
                            } else {
                                avatarIcon.classList.remove('hidden');
                            }
                        };
                        avatarImg.classList.remove('hidden');
                    } else if (order.customer?.name) {
                        avatarInitials.textContent = order.customer.name.charAt(0);
                        avatarInitials.classList.remove('hidden');
                    } else {
                        avatarIcon.classList.remove('hidden');
                    }
                    
                    document.getElementById('vModalOrderTotal').textContent = CurrencyManager.formatPrice(order.total);

                    const payStatusEl = document.getElementById('vModalPaymentStatus');
                    const transIdEl = document.getElementById('vModalTransactionId');
                    
                    if (payStatusEl) {
                        payStatusEl.textContent = order.payment_status || 'N/A';
                        payStatusEl.className = `inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${getPaymentStatusStyle(order.payment_status)}`;
                    }
                    if (transIdEl) {
                        transIdEl.textContent = order.transaction_id ? `ID: ${order.transaction_id}` : '';
                    }

                    const itemsContainer = document.getElementById('vModalOrderItems');
                    let items = order.items || [];

                    // Internal function to render items list
                    const renderItems = (data) => {
                        itemsContainer.innerHTML = data.map(item => `
                            <div class="flex items-center gap-4 p-4 border border-gray-50 rounded-2xl hover:bg-gray-50 transition-colors">
                                <div class="w-16 h-16 bg-white rounded-xl overflow-hidden p-2 border border-gray-100 flex items-center justify-center shrink-0">
                                    <img src="${window.getOptimizedImageUrl(item.image)}"${buildResponsiveImageAttrs(item.image, [120, 180, 240], '64px', { quality: 75 })} 
                                         alt="${item.name || 'Produit'}" 
                                         loading="lazy" 
                                         class="w-full h-full object-contain" 
                                         onerror="this.onerror=null; this.src='../assets/Images/default.png';">
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-sm text-gray-900 truncate">${item.name || 'Produit'}</h4>
                                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">${item.category || 'Catégorie'}</p>
                                </div>
                                <div class="text-right shrink-0">
                                    <p class="font-bold text-sm">${CurrencyManager.formatPrice(item.price)}</p>
                                    <p class="text-[10px] font-black text-gray-400 uppercase">Qté: ${item.quantity || 1}</p>
                                </div>
                            </div>
                        `).join('');
                    };

                    // Initial render (may contain placeholders)
                    renderItems(items);

                    // Show/Hide buttons based on status
                    const actions = document.getElementById('vModalActions');
                    const standardActions = document.getElementById('vStandardActions');
                    const otpSection = document.getElementById('vOtpSection');
                    const disputedSection = document.getElementById('vDisputedSection');
                    
                    actions.classList.add('hidden');
                    standardActions.classList.add('hidden');
                    otpSection.classList.add('hidden');
                    disputedSection.classList.add('hidden');

                    if (order.status === 'PENDING' || order.status === 'QUOTE') {
                        actions.classList.remove('hidden');
                        standardActions.classList.remove('hidden');
                        document.getElementById('btnMarkDelivered').innerHTML = `<iconify-icon icon="solar:delivery-bold" width="16"></iconify-icon>${order.status === 'QUOTE' ? 'Modifier le devis' : 'Proposer un devis'}`;
                        document.getElementById('btnMarkDelivered').onclick = () => handleVendorQuote(order);
                        document.getElementById('btnMarkCancelled').onclick = () => updateVendorOrderStatus(order.id, 'CANCELLED');
                        document.getElementById('btnMarkCancelled').textContent = 'Annuler la demande';
                    } else if (order.status === 'READY_FOR_PAYMENT') {
                        actions.classList.remove('hidden');
                        standardActions.classList.remove('hidden');
                        document.getElementById('btnMarkDelivered').innerHTML = `<iconify-icon icon="solar:clock-circle-bold" width="16"></iconify-icon>En attente du paiement`;
                        document.getElementById('btnMarkDelivered').onclick = () => showToast('Le client doit maintenant accepter le devis et payer.', 'info');
                        document.getElementById('btnMarkCancelled').onclick = () => updateVendorOrderStatus(order.id, 'CANCELLED');
                        document.getElementById('btnMarkCancelled').textContent = 'Annuler la demande';
                    } else if (order.status === 'PAID_HELD') {
                        actions.classList.remove('hidden');
                        standardActions.classList.remove('hidden');
                        document.getElementById('btnMarkDelivered').innerHTML = `<iconify-icon icon="solar:delivery-bold" width="16"></iconify-icon>Démarrer la livraison`;
                        document.getElementById('btnMarkDelivered').onclick = () => startVendorDelivery(order.id);
                        document.getElementById('btnMarkCancelled').onclick = () => showToast('La commande est déjà payée et sécurisée en séquestre.', 'info');
                        document.getElementById('btnMarkCancelled').textContent = 'Paiement sécurisé';
                    } else if (order.status === 'IN_DELIVERY') {
                        actions.classList.remove('hidden');
                        otpSection.classList.remove('hidden');
                        document.getElementById('vOtpInput').value = '';
                        currentOrderIdForOtp = order.id;
                    } else if (order.status === 'DISPUTE_OPEN' || order.status === 'DISPUTED' || order.status === 'FROZEN') {
                        actions.classList.remove('hidden');
                        disputedSection.classList.remove('hidden');
                        window.currentDisputeOrderIdForVendor = order.id;
                        window.loadVendorDisputeChat(order.id);
                    }
                    
                    const modal = document.getElementById('orderDetailModal');
                    if (modal) {
                        modal.classList.remove('hidden');
                        modal.classList.add('flex');
                        document.documentElement.classList.add('overflow-hidden');
                    }
                };

                window.closeOrderDetailModal = function() {
                    const modal = document.getElementById('orderDetailModal');
                    if (modal) {
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                        document.documentElement.classList.remove('overflow-hidden');
                    }
                };

                let currentOrderIdForOtp = null;

                async function startVendorDelivery(orderId, skipConfirm = false) {
                    const confirmationText = 'Démarrer la livraison pour cette commande ?';
                    if (!skipConfirm) {
                        if (typeof window.showConfirm === 'function') {
                            window.showConfirm(
                                'Démarrer la livraison',
                                confirmationText,
                                () => startVendorDelivery(orderId, true)
                            );
                            return;
                        }
                        if (!confirm(confirmationText)) return;
                    }

                    try {
                        await OrderManager.startDelivery(orderId);
                        showToast('Livraison démarrée. Vous pouvez maintenant saisir l’OTP à la remise.', 'success');
                        closeOrderDetailModal();
                        renderVendorDashboard();

                        if (window.ActivityManager) {
                            ActivityManager.log(`Livraison démarrée pour la commande #${orderId.substring(0,6)}`, 'order');
                        }
                    } catch (error) {
                        showToast(error?.message || 'Impossible de démarrer la livraison.', 'error');
                    }
                }

                async function handleVerifyOTP() {
                    const otpInput = document.getElementById('vOtpInput');
                    const otp = String(otpInput?.value || '').trim();
                    const orderId = currentOrderIdForOtp;

                    if (!orderId) {
                        const _otpBtn = document.getElementById('btnVerifyVendorOtp');
                        if (window.showInlineError) window.showInlineError(_otpBtn, 'Commande introuvable pour la vérification OTP.');
                        return;
                    }

                    if (!/^\d{6}$/.test(otp)) {
                        const _otpBtn = document.getElementById('btnVerifyVendorOtp');
                        if (window.showInlineError) window.showInlineError(_otpBtn, 'Le code OTP doit contenir exactement 6 chiffres.');
                        otpInput?.focus();
                        return;
                    }

                    const verifyBtn = document.getElementById('btnVerifyVendorOtp');
                    const originalHtml = verifyBtn?.innerHTML || 'Vérifier';

                    if (verifyBtn) {
                        verifyBtn.disabled = true;
                        verifyBtn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="16"></iconify-icon> Vérification...';
                    }

                    try {
                        await OrderManager.validateDelivery(orderId, otp);
                        currentOrderIdForOtp = null;
                        showToast('Livraison confirmée avec succès.', 'success');
                        closeOrderDetailModal();
                        await renderVendorDashboard();

                        if (window.ActivityManager) {
                            ActivityManager.log(`OTP validé pour la commande #${orderId.substring(0,6)}`, 'order');
                        }
                    } catch (error) {
                        showToast(error?.message || 'Erreur lors de la vérification OTP.', 'error');
                    } finally {
                        if (verifyBtn) {
                            verifyBtn.disabled = false;
                            verifyBtn.innerHTML = originalHtml;
                        }
                    }
                }

                async function updateVendorOrderStatus(orderId, newStatus, skipConfirm = false) {
                    const confirmationText = `Passer cette commande en statut \"${newStatus}\" ?`;
                    if (!skipConfirm) {
                        if (typeof window.showConfirm === 'function') {
                            window.showConfirm(
                                'Confirmation',
                                confirmationText,
                                () => updateVendorOrderStatus(orderId, newStatus, true)
                            );
                            return;
                        }
                        if (!confirm(`Voulez-vous vraiment passer cette commande en statut \"${newStatus}\" ?`)) return;
                    }
                    
                    try {
                        const success = await OrderManager.updateOrderStatus(orderId, newStatus);
                        if (success) {
                            showToast(`Commande ${newStatus.toLowerCase()} !`, 'success');
                            closeOrderDetailModal();
                            renderVendorDashboard(); // Refresh
                            
                            // Activity log
                            const order = OrderManager.getOrderById(orderId);
                            ActivityManager.log(`Commande #${orderId.substring(0,6)} marquée comme ${newStatus}`, 'order');
                        }
                    } catch (error) {
                        showToast('Une erreur est survenue.', 'error');
                    }
                }

                function openVendorQuoteModal(order) {
                    return new Promise((resolve) => {
                        const orderModal = document.getElementById('orderDetailModal');
                        if (orderModal) {
                            orderModal.classList.add('hidden');
                            orderModal.classList.remove('flex');
                        }

                        const currentQuote = order?.latest_delivery_quote || null;
                        const presetFee = currentQuote?.delivery_fee_amount ?? order?.delivery_fee_amount ?? '';
                        const presetDelay = currentQuote?.estimated_delay_hours ?? 24;
                        const presetNote = currentQuote?.note ?? '';

                        const container = document.createElement('div');
                        container.className = 'fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
                        container.innerHTML = `
                            <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col">
                                <div class="p-5 sm:p-6 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-3 shrink-0">
                                    <div class="min-w-0">
                                        <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Devis de livraison</p>
                                        <h3 class="text-lg font-black text-gray-900 truncate">${currentQuote ? 'Modifier le devis' : 'Proposer un devis'}</h3>
                                        <p class="text-xs text-gray-500 mt-1">Le client doit accepter avant de payer. Paiement en sequestre.</p>
                                    </div>
                                    <button type="button" data-quote-close class="w-9 h-9 rounded-full bg-white hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors shadow-sm border border-gray-100">
                                        <iconify-icon icon="solar:close-circle-bold" width="22"></iconify-icon>
                                    </button>
                                </div>
                                <div class="p-5 sm:p-6 space-y-4 overflow-y-auto">
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div class="space-y-1">
                                            <label class="block text-xs font-bold text-gray-600">Montant livraison (CDF)</label>
                                            <input data-quote-fee type="number" min="0" step="1" inputmode="numeric"
                                                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/10 focus:border-black outline-none text-sm bg-white"
                                                placeholder="Ex: 5000" value="${String(presetFee)}">
                                        </div>
                                        <div class="space-y-1">
                                            <label class="block text-xs font-bold text-gray-600">Delai estime (heures)</label>
                                            <input data-quote-delay type="number" min="1" step="1" inputmode="numeric"
                                                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/10 focus:border-black outline-none text-sm bg-white"
                                                placeholder="Ex: 24" value="${String(presetDelay)}">
                                        </div>
                                    </div>
                                    <div class="space-y-1">
                                        <label class="block text-xs font-bold text-gray-600">Note (jour, localisation, contraintes)</label>
                                        <textarea data-quote-note rows="3"
                                            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black/10 focus:border-black outline-none text-sm bg-white resize-none"
                                            placeholder="Ex: Livraison lundi matin. RDV au rond-point...">${String(presetNote || '')}</textarea>
                                    </div>
                                    <div class="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-900">
                                        <div class="flex items-start gap-2">
                                            <iconify-icon icon="solar:info-circle-bold" width="18" class="text-amber-600"></iconify-icon>
                                            <p>Astuce: plus la note est claire, moins il y a d'annulations.</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3 shrink-0">
                                    <button type="button" data-quote-cancel class="flex-1 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">Annuler</button>
                                    <button type="button" data-quote-submit class="flex-1 py-3 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                                        <iconify-icon icon="solar:send-square-bold" width="16"></iconify-icon>
                                        Envoyer le devis
                                    </button>
                                </div>
                            </div>
                        `;

                        const close = (result) => {
                            document.body.style.overflow = '';
                            container.remove();
                            
                            if (!result && orderModal) {
                                orderModal.classList.remove('hidden');
                                orderModal.classList.add('flex');
                                document.documentElement.classList.add('overflow-hidden');
                            }
                            
                            resolve(result);
                        };

                        const feeEl = () => container.querySelector('[data-quote-fee]');
                        const delayEl = () => container.querySelector('[data-quote-delay]');
                        const noteEl = () => container.querySelector('[data-quote-note]');
                        const submitBtn = () => container.querySelector('[data-quote-submit]');

                        container.addEventListener('click', (e) => {
                            if (e.target === container) close(null);
                        });
                        container.querySelector('[data-quote-close]')?.addEventListener('click', () => close(null));
                        container.querySelector('[data-quote-cancel]')?.addEventListener('click', () => close(null));

                        container.querySelector('[data-quote-submit]')?.addEventListener('click', () => {
                            const deliveryFee = Number(feeEl()?.value || 0);
                            const estimatedDelay = Number(delayEl()?.value || 0);
                            const note = String(noteEl()?.value || '').trim();

                            if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
                                if (window.showInlineError) window.showInlineError(feeEl(), 'Montant de livraison invalide.');
                                feeEl()?.focus();
                                return;
                            }
                            if (!Number.isFinite(estimatedDelay) || estimatedDelay <= 0) {
                                if (window.showInlineError) window.showInlineError(delayEl(), 'Délai invalide.');
                                delayEl()?.focus();
                                return;
                            }

                            const btn = submitBtn();
                            if (btn) {
                                btn.disabled = true;
                                btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="18"></iconify-icon> Envoi...';
                            }

                            close({
                                delivery_fee_amount: deliveryFee,
                                estimated_delay_hours: Math.round(estimatedDelay),
                                note
                            });
                        });

                        document.body.style.overflow = 'hidden';
                        document.body.appendChild(container);
                        feeEl()?.focus();
                    });
                }

                async function handleVendorQuote(order) {
                    const payload = await openVendorQuoteModal(order);
                    if (!payload) return;

                    try {
                        await OrderManager.createDeliveryQuote(order.id, payload);
                        showToast('Devis envoyé au client.', 'success');
                        closeOrderDetailModal();
                        await renderVendorDashboard();
                    } catch (error) {
                        showToast(error.message || 'Erreur lors de la creation du devis', 'error');
                        const orderModal = document.getElementById('orderDetailModal');
                        if (orderModal) {
                            orderModal.classList.remove('hidden');
                            orderModal.classList.add('flex');
                            document.documentElement.classList.add('overflow-hidden');
                        }
                    }
                }

                window.currentDisputeOrderIdForVendor = null;
                window.currentDisputeIdForVendor = null;

                window.loadVendorDisputeChat = async function(orderId) {
                    const chatContainer = document.getElementById('vDisputeChat');
                    if (!chatContainer) return;
                    
                    chatContainer.innerHTML = '<div class="text-center text-[10px] text-gray-400 italic mt-4"><iconify-icon icon="line-md:loading-loop" width="20"></iconify-icon><br>Chargement...</div>';
                    
                    try {
                        const dispute = await OrderManager.getDisputeByOrder(orderId);
                        window.currentDisputeIdForVendor = dispute.id;
                        const messages = await OrderManager.getDisputeMessages(dispute.id);
                        chatContainer.innerHTML = '';
                        
                        if (!messages || messages.length === 0) {
                            chatContainer.innerHTML = '<div class="text-center text-[10px] text-gray-400 italic mt-4">Aucun message pour ce litige.</div>';
                            return;
                        }
                        
                        messages.forEach(msg => {
                            const senderRole = (msg.payload && msg.payload.sender_role) || msg.sender_role || 'SYSTEM';
                            const isMe = senderRole === 'VENDOR' || senderRole === 'SELLER';
                            // Roles: ADMIN, CUSTOMER, VENDOR
                            let roleBadge = '';
                            let bubbleColor = '';
                            let textColor = '';
                            let align = isMe ? 'self-end items-end' : 'self-start items-start';
                            const messageText = msg.payload?.message || msg.payload?.event || msg.message || 'Mise à jour';
                            
                            if (senderRole === 'ADMIN') {
                                roleBadge = '<span class="text-[8px] font-black uppercase bg-red-100 text-red-600 px-1 py-0.5 rounded ml-2">ADMIN</span>';
                                bubbleColor = 'bg-red-50 border border-red-100';
                                textColor = 'text-red-900';
                            } else if (senderRole === 'CUSTOMER' || senderRole === 'BUYER') {
                                roleBadge = '<span class="text-[8px] font-black uppercase bg-gray-100 text-gray-600 px-1 py-0.5 rounded ml-2">CLIENT</span>';
                                bubbleColor = 'bg-gray-50 border border-gray-100';
                                textColor = 'text-gray-900';
                            } else if (senderRole === 'SYSTEM') {
                                roleBadge = '<span class="text-[8px] font-black uppercase bg-gray-100 text-gray-500 px-1 py-0.5 rounded ml-2">SYSTÈME</span>';
                                bubbleColor = 'bg-gray-100 border border-gray-200';
                                textColor = 'text-gray-700';
                            } else {
                                roleBadge = '<span class="text-[8px] font-black uppercase text-gray-400 ml-2">Vous</span>';
                                bubbleColor = 'bg-gray-900 border border-gray-900';
                                textColor = 'text-white';
                            }
                            
                            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            const dateStr = new Date(msg.created_at).toLocaleDateString([], {day:'2-digit', month:'2-digit'});
                            
                            chatContainer.innerHTML += `
                                <div class="flex flex-col ${align} max-w-[85%] snap-end">
                                    <div class="flex items-center mb-1">
                                        <span class="text-[9px] font-bold text-gray-500">${timeStr} ${dateStr}</span>
                                        ${roleBadge}
                                    </div>
                                    <div class="px-3 py-2 rounded-2xl ${bubbleColor} ${textColor} text-xs shadow-sm">
                                        ${messageText}
                                    </div>
                                </div>
                            `;
                        });
                        
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    } catch (error) {
                        console.error("Chat load error:", error);
                        chatContainer.innerHTML = '<div class="text-center text-[10px] text-red-400 italic mt-4">Erreur lors du chargement des messages.</div>';
                    }
                };

                window.sendVendorDisputeMessage = async function() {
                    const input = document.getElementById('vDisputeMessageInput');
                    const message = input.value.trim();
                    const orderId = window.currentDisputeOrderIdForVendor;
                    const disputeId = window.currentDisputeIdForVendor;
                    
                    if (!message || !orderId || !disputeId) return;
                    
                    const btn = input.nextElementSibling;
                    const originalHtml = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<iconify-icon icon="line-md:loading-loop"></iconify-icon>';
                    
                    try {
                        await OrderManager.addDisputeMessage(disputeId, {
                            type: 'MESSAGE',
                            payload: { message, sender_role: 'SELLER' }
                        });
                        input.value = '';
                        await window.loadVendorDisputeChat(orderId);
                    } catch (error) {
                        if(window.showToast) showToast("Erreur lors de l'envoi.", 'error');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    }
                };

                window.handleVendorAmiableResolve = async function(skipConfirm = false) {
                    const orderId = window.currentDisputeOrderIdForVendor;
                    const disputeId = window.currentDisputeIdForVendor;
                    if (!orderId || !disputeId) return;
                    
                    const confirmText = "Ceci procédera au remboursement du client depuis vos fonds sur ce litige, et clôturera le litige. Continuer ?";
                    if (!skipConfirm) {
                        if (typeof window.showConfirm === 'function') {
                            window.showConfirm('Remboursement total', confirmText, () => window.handleVendorAmiableResolve(true));
                            return;
                        }
                        if(!confirm(confirmText)) return;
                    }
                    
                    const btn = document.getElementById('btnAmiableResolve');
                    const originalHtml = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<iconify-icon icon="line-md:loading-loop"></iconify-icon> Traitement...';
                    
                    try {
                        await OrderManager.vendorRespondToDispute(disputeId, {
                            action: 'ACCEPT_REFUND',
                            message: 'Remboursement total accepté par le vendeur.'
                        });
                        if(window.showToast) showToast("Litige résolu à l'amiable et client remboursé !", 'success');
                        window.closeOrderDetailModal();
                        renderVendorDashboard();
                    } catch (error) {
                        if(window.showToast) showToast(error.message || 'Erreur lors de la résolution amiable.', 'error');
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    }
                };

                window.handleVendorPartialOffer = async function() {
                    const orderId = window.currentDisputeOrderIdForVendor;
                    const disputeId = window.currentDisputeIdForVendor;
                    if (!orderId || !disputeId) return;

                    const rawAmount = typeof window.showPromptModal === 'function'
                        ? await window.showPromptModal({
                            title: 'Remboursement partiel',
                            message: 'Indiquez le montant à rembourser (en CDF).',
                            label: 'Montant (CDF)',
                            type: 'number',
                            inputMode: 'numeric',
                            step: 1,
                            min: 1,
                            required: true
                        })
                        : prompt("Montant du remboursement partiel (CDF) ?");
                    if (rawAmount === null) return;
                    const amount = parseFloat(String(rawAmount).replace(',', '.'));
                    if (!Number.isFinite(amount) || amount <= 0) {
                        if (window.showToast) showToast("Montant invalide.", 'error');
                        return;
                    }

                    const note = typeof window.showPromptModal === 'function'
                        ? await window.showPromptModal({
                            title: 'Message au client',
                            message: 'Expliquez brièvement votre proposition.',
                            label: 'Message',
                            multiline: true,
                            required: true
                        })
                        : (prompt("Expliquez votre proposition au client.") || '');

                    if (note === null) return;

                    try {
                        await OrderManager.vendorRespondToDispute(disputeId, {
                            action: 'OFFER_PARTIAL_REFUND',
                            amount,
                            message: note
                        });
                        if (window.showToast) showToast("Offre partielle envoyée au client.", 'success');
                        await window.loadVendorDisputeChat(orderId);
                    } catch (error) {
                        if (window.showToast) showToast(error.message || "Erreur lors de l'envoi de l'offre.", 'error');
                    }
                };

                window.handleVendorContest = async function() {
                    const orderId = window.currentDisputeOrderIdForVendor;
                    const disputeId = window.currentDisputeIdForVendor;
                    if (!orderId || !disputeId) return;

                    const note = typeof window.showPromptModal === 'function'
                        ? await window.showPromptModal({
                            title: 'Contester le litige',
                            message: 'Décrivez votre argumentaire / preuves (texte).',
                            label: 'Argumentaire',
                            multiline: true,
                            required: true
                        })
                        : prompt("Argumentaire vendeur / preuves textuelles ?");
                    if (!note || !String(note).trim()) return;

                    try {
                        await OrderManager.vendorRespondToDispute(disputeId, {
                            action: 'CONTEST',
                            message: String(note).trim()
                        });
                        if (window.showToast) showToast("Contestation envoyée en revue.", 'success');
                        await window.loadVendorDisputeChat(orderId);
                    } catch (error) {
                        if (window.showToast) showToast(error.message || "Erreur lors de la contestation.", 'error');
                    }
                };

    


        // Logic for Mobile Sidebar Toggle — Guaranteed Init
        (function() {
            function initVendorSidebar() {
                if (window.SidebarManager) {
                    window.SidebarManager.init('vendorSidebar', 'vendor-main-content', 'vendorSidebarOverlay');
                }
            }
            // If SidebarManager is already loaded, init immediately
            if (window.SidebarManager) {
                initVendorSidebar();
            } else {
                // Otherwise wait for DOM/component boot (newketInitialized isn't guaranteed in all dev flows)
                window.addEventListener('componentsLoaded', initVendorSidebar, { once: true });
                window.addEventListener('newketInitialized', initVendorSidebar, { once: true });
                // Last-resort: tiny poll for late script load.
                let attempts = 0;
                const t = setInterval(() => {
                    attempts++;
                    if (window.SidebarManager) {
                        clearInterval(t);
                        initVendorSidebar();
                    } else if (attempts >= 40) {
                        clearInterval(t);
                    }
                }, 250);
            }
        })();
    