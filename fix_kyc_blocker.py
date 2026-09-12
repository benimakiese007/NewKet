path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the innerHTML of the blocker.
START_MARKER = r"""                                            <div>
                                                <h3 class="font-black text-base text-gray-900">Vérification d'identité</h3>
                                                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Photo en direct requise</p>
                                            </div>"""

END_MARKER = r"""                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                            document.body.appendChild(blocker);"""

start_idx = content.find(START_MARKER)
end_idx = content.find("document.body.appendChild(blocker);", start_idx)

NEW_HTML = r"""                                            <div>
                                                <h3 class="font-black text-base text-gray-900">Vérification d'identité</h3>
                                                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sécurité du compte</p>
                                            </div>
                                        </div>
                                        <button onclick="kycCloseModal()" class="text-gray-300 hover:text-gray-900 transition-colors p-1">
                                            <iconify-icon icon="solar:close-circle-bold" width="24"></iconify-icon>
                                        </button>
                                    </div>

                                    <div class="overflow-y-auto flex-1 p-5 space-y-6 modal-scroll">
                                        <p class="text-sm text-gray-500 font-medium text-center">Vous devez vérifier votre identité avant de modifier votre méthode de paiement.</p>
                                        
                                        <!-- Zone 1 : Fichiers -->
                                        <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <h5 class="font-black text-xs text-gray-900 mb-3 uppercase tracking-widest">1. Pièce d'identité (Fichiers)</h5>
                                            <div class="grid grid-cols-2 gap-3">
                                                <div>
                                                    <div id="kycRectoZone" onclick="document.getElementById('kycRectoUpload').click()" class="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:border-black bg-white transition-all h-full flex flex-col items-center justify-center">
                                                        <iconify-icon icon="solar:upload-minimalistic-bold-duotone" width="20" class="text-gray-400 mb-1"></iconify-icon>
                                                        <p class="text-[10px] font-black uppercase text-gray-900">Recto</p>
                                                        <input type="file" id="kycRectoUpload" accept="image/*,application/pdf" class="hidden">
                                                    </div>
                                                    <div id="kycRectoPreview" class="hidden relative h-24 rounded-2xl overflow-hidden border border-gray-100">
                                                        <img src="" class="w-full h-full object-cover">
                                                        <button onclick="clearKycUpload('recto')" class="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:scale-110"><iconify-icon icon="solar:close-circle-bold"></iconify-icon></button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div id="kycVersoZone" onclick="document.getElementById('kycVersoUpload').click()" class="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:border-black bg-white transition-all h-full flex flex-col items-center justify-center">
                                                        <iconify-icon icon="solar:upload-minimalistic-bold-duotone" width="20" class="text-gray-400 mb-1"></iconify-icon>
                                                        <p class="text-[10px] font-black uppercase text-gray-900">Verso</p>
                                                        <input type="file" id="kycVersoUpload" accept="image/*,application/pdf" class="hidden">
                                                    </div>
                                                    <div id="kycVersoPreview" class="hidden relative h-24 rounded-2xl overflow-hidden border border-gray-100">
                                                        <img src="" class="w-full h-full object-cover">
                                                        <button onclick="clearKycUpload('verso')" class="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:scale-110"><iconify-icon icon="solar:close-circle-bold"></iconify-icon></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Zone 2 : Selfie en direct -->
                                        <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <h5 class="font-black text-xs text-gray-900 mb-3 uppercase tracking-widest">2. Selfie de sécurité (Caméra)</h5>
                                            <div class="relative w-full aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-inner">
                                                <video id="kycSelfieVideo" class="w-full h-full object-cover" autoplay playsinline></video>
                                                <canvas id="kycSelfieCanvas" class="hidden"></canvas>
                                                <img id="kycSelfieImg" class="hidden w-full h-full object-cover absolute inset-0">
                                                
                                                <div id="kycSelfieCaptureBtn" class="absolute bottom-3 inset-x-0 flex justify-center">
                                                    <button onclick="kycCaptureSelfie()" class="w-12 h-12 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                                                        <div class="w-8 h-8 bg-white rounded-full shadow-xl"></div>
                                                    </button>
                                                </div>
                                                <div id="kycSelfieRetakeBtn" class="hidden absolute bottom-3 inset-x-0 flex justify-center">
                                                    <button onclick="kycRetakeSelfie()" class="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl font-black text-[10px] uppercase tracking-widest text-gray-900 shadow-xl">
                                                        Reprendre
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div id="kycUploadError" class="hidden bg-red-50 text-red-600 p-3 rounded-2xl text-xs font-bold text-center"></div>

                                        <button onclick="kycSubmitAll()" id="kycSubmitBtn" class="w-full py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:bg-gray-900 transition-all flex items-center justify-center gap-2">
                                            Confirmer l'identité <iconify-icon icon="solar:check-circle-bold" width="16"></iconify-icon>
                                        </button>
                                    </div>
                                </div>
                            `;
                            document.body.appendChild(blocker);"""

JS_START = r"""                            // Auto-start recto camera when modal first opens"""
JS_END = r"""                        blocker.classList.remove('hidden');
                        return;"""

js_start_idx = content.find(JS_START)
js_end_idx = content.find("return;", js_start_idx) + 7

NEW_JS = r"""                            setupKycUpload('kycRectoUpload', 'kycRectoZone', 'kycRectoPreview', 'recto');
                            setupKycUpload('kycVersoUpload', 'kycVersoZone', 'kycVersoPreview', 'verso');
                            kycStartSelfieCamera();
                        }
                        blocker.classList.remove('hidden');
                        return;"""

JS_FUNCTIONS_START = r"""                let kycCurrentFiles = { recto: null, verso: null };"""
JS_FUNCTIONS_END = r"""                window.kycSubmitFiles = kycSubmitFiles;"""

js_func_start_idx = content.find(JS_FUNCTIONS_START)
js_func_end_idx = content.find("window.kycSubmitFiles = kycSubmitFiles;", js_func_start_idx) + len("window.kycSubmitFiles = kycSubmitFiles;")

NEW_JS_FUNCTIONS = r"""                let kycCurrentFiles = { recto: null, verso: null, selfie: null };
                
                function setupKycUpload(inputId, zoneId, previewId, type) {
                    const input = document.getElementById(inputId);
                    if (!input) return;
                    input.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            kycCurrentFiles[type] = file;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                document.getElementById(zoneId).classList.add('hidden');
                                document.getElementById(previewId).classList.remove('hidden');
                                document.getElementById(previewId).querySelector('img').src = ev.target.result;
                            };
                            reader.readAsDataURL(file);
                        }
                    });
                }
                window.setupKycUpload = setupKycUpload;

                function clearKycUpload(type) {
                    kycCurrentFiles[type] = null;
                    const c = type === 'recto' ? 'Recto' : 'Verso';
                    const input = document.getElementById('kyc' + c + 'Upload');
                    if (input) input.value = '';
                    const preview = document.getElementById('kyc' + c + 'Preview');
                    const zone = document.getElementById('kyc' + c + 'Zone');
                    if (preview && zone) {
                        preview.classList.add('hidden');
                        zone.classList.remove('hidden');
                    }
                }
                window.clearKycUpload = clearKycUpload;

                let kycSelfieStream = null;
                async function kycStartSelfieCamera() {
                    const video = document.getElementById('kycSelfieVideo');
                    try {
                        kycSelfieStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                        if(video) video.srcObject = kycSelfieStream;
                    } catch (e) {
                        console.error("Camera access denied");
                    }
                }
                window.kycStartSelfieCamera = kycStartSelfieCamera;

                function kycStopSelfieCamera() {
                    if (kycSelfieStream) {
                        kycSelfieStream.getTracks().forEach(t => t.stop());
                        kycSelfieStream = null;
                    }
                }
                window.kycStopSelfieCamera = kycStopSelfieCamera;

                function kycCaptureSelfie() {
                    const video = document.getElementById('kycSelfieVideo');
                    const canvas = document.getElementById('kycSelfieCanvas');
                    const img = document.getElementById('kycSelfieImg');
                    if (!video || !video.srcObject) return;

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    canvas.toBlob(blob => {
                        const file = new File([blob], "kyc_selfie.jpg", { type: "image/jpeg" });
                        kycCurrentFiles.selfie = file;
                        
                        img.src = URL.createObjectURL(blob);
                        img.classList.remove('hidden');
                        document.getElementById('kycSelfieCaptureBtn').classList.add('hidden');
                        document.getElementById('kycSelfieRetakeBtn').classList.remove('hidden');
                        kycStopSelfieCamera();
                    }, 'image/jpeg', 0.85);
                }
                window.kycCaptureSelfie = kycCaptureSelfie;

                function kycRetakeSelfie() {
                    kycCurrentFiles.selfie = null;
                    document.getElementById('kycSelfieImg').classList.add('hidden');
                    document.getElementById('kycSelfieCaptureBtn').classList.remove('hidden');
                    document.getElementById('kycSelfieRetakeBtn').classList.add('hidden');
                    kycStartSelfieCamera();
                }
                window.kycRetakeSelfie = kycRetakeSelfie;

                function kycCloseModal() {
                    const modal = document.getElementById('kycInlineUploadModal');
                    if (modal) modal.classList.add('hidden');
                    kycStopSelfieCamera();
                }
                window.kycCloseModal = kycCloseModal;

                async function kycSubmitAll() {
                    const errEl = document.getElementById('kycUploadError');
                    const btn = document.getElementById('kycSubmitBtn');

                    if (!kycCurrentFiles.recto || !kycCurrentFiles.verso || !kycCurrentFiles.selfie) {
                        errEl.textContent = 'Veuillez uploader le recto, le verso et prendre un selfie.';
                        errEl.classList.remove('hidden');
                        return;
                    }

                    errEl.classList.add('hidden');
                    btn.disabled = true;
                    btn.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" width="16"></iconify-icon> Upload en cours...';

                    try {
                        const session = window.getSupabaseSession ? await window.getSupabaseSession(3000) : null;
                        const user = session?.user;
                        if (!user) throw new Error("Non connecté");

                        const rectoUrl = await window.SupabaseAdapter.uploadFile('vendor-docs', user.id + '_cni_recto.jpg', kycCurrentFiles.recto);
                        const versoUrl = await window.SupabaseAdapter.uploadFile('vendor-docs', user.id + '_cni_verso.jpg', kycCurrentFiles.verso);
                        
                        if (!rectoUrl || !versoUrl) throw new Error("Erreur d'upload des documents.");

                        const { error } = await window.supabase
                            .from('users')
                            .update({ 
                                identity_document_urls: [rectoUrl, versoUrl] 
                            })
                            .eq('id', user.id);

                        if (error) throw error;
                        
                        // Proceed to payout form
                        kycCloseModal();
                        
                        // We also need to pre-fill the selfie in the payout modal if we can,
                        // but to keep it simple we just open the payout modal. 
                        // The user wanted this to act as the unified modal.
                        // Wait, if this is unified, they will just have to do it again in payout modal?
                        // Let's pass the files to the payout modal!
                        window.currentPayoutFiles = {
                            recto: kycCurrentFiles.recto,
                            verso: kycCurrentFiles.verso,
                            selfie: kycCurrentFiles.selfie
                        };
                        openAddPayoutModal();

                    } catch (e) {
                        errEl.textContent = "Erreur: " + e.message;
                        errEl.classList.remove('hidden');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = 'Confirmer l\'identité <iconify-icon icon="solar:check-circle-bold" width="16"></iconify-icon>';
                    }
                }
                window.kycSubmitAll = kycSubmitAll;"""

c = content[:js_func_start_idx] + NEW_JS_FUNCTIONS + content[js_func_end_idx:]

start_idx = c.find(START_MARKER)
end_idx = c.find("document.body.appendChild(blocker);", start_idx)
c = c[:start_idx] + NEW_HTML + c[end_idx:]

js_start_idx = c.find(JS_START)
js_end_idx = c.find("return;", js_start_idx) + 7
c = c[:js_start_idx] + NEW_JS + c[js_end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("KYC Blocker Modal updated!")
