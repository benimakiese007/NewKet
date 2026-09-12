path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# I need to rewrite the `payoutStepSelfie` and `payoutStepDocs` entirely.
# I will locate `<!-- Step 2: Selfie -->` and replace everything down to the end of `payoutStepDocs`.

START_MARKER = r'                                        <!-- Step 2: Selfie -->'
END_MARKER = r'                                        </div>'

start_idx = content.find(START_MARKER)
end_idx = content.find('<!-- Step 3: Re-upload KYC -->', start_idx)
end_idx = content.find('</div>\n                                    </div>', end_idx)

if end_idx == -1:
    end_idx = content.find('</div>\r\n                                    </div>', start_idx)

print(f"HTML Start: {start_idx}, End: {end_idx}")

NEW_HTML = r"""                                        <!-- Step 2: Security Check -->
                                        <div id="payoutStepSecurity" class="hidden space-y-6">
                                            <div class="text-center">
                                                <div class="w-16 h-16 bg-gray-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                                                    <iconify-icon icon="solar:shield-check-bold-duotone" width="32"></iconify-icon>
                                                </div>
                                                <h4 class="font-black text-xl text-gray-900 mb-2">Vérification de sécurité</h4>
                                                <p class="text-sm text-gray-500 leading-relaxed font-medium px-4">Pour protéger vos fonds, veuillez fournir ces éléments.</p>
                                            </div>
                                            
                                            <!-- Zone 1: ID Documents (File Upload) -->
                                            <div class="bg-gray-50 p-5 rounded-[2rem] border border-gray-100 space-y-4">
                                                <div class="flex items-center gap-3 mb-2">
                                                    <iconify-icon icon="solar:id-card-bold-duotone" width="24" class="text-gray-900"></iconify-icon>
                                                    <h5 class="font-black text-sm text-gray-900">1. Pièce d'identité (Fichiers)</h5>
                                                </div>
                                                <p class="text-xs text-gray-500 font-medium">Uploadez la même pièce d'identité que lors de votre inscription.</p>
                                                
                                                <div class="grid grid-cols-2 gap-3">
                                                    <!-- Recto -->
                                                    <div>
                                                        <div id="payoutRectoZone" onclick="document.getElementById('payoutRectoUpload').click()" class="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:border-black bg-white transition-all group h-full flex flex-col items-center justify-center">
                                                            <iconify-icon icon="solar:upload-minimalistic-bold-duotone" width="24" class="text-gray-400 mb-2 group-hover:text-black transition-colors"></iconify-icon>
                                                            <p class="text-[10px] font-black uppercase tracking-widest text-gray-900">Recto</p>
                                                            <input type="file" id="payoutRectoUpload" accept="image/*,application/pdf" class="hidden">
                                                        </div>
                                                        <div id="payoutRectoPreview" class="hidden relative h-28 rounded-2xl overflow-hidden group border border-gray-100 bg-white">
                                                            <img src="" class="w-full h-full object-cover">
                                                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button onclick="clearPayoutUpload('recto')" class="w-8 h-8 rounded-full bg-white text-red-500 flex items-center justify-center shadow-xl hover:scale-110 transition-transform"><iconify-icon icon="solar:trash-bin-trash-bold" width="14"></iconify-icon></button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <!-- Verso -->
                                                    <div>
                                                        <div id="payoutVersoZone" onclick="document.getElementById('payoutVersoUpload').click()" class="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center cursor-pointer hover:border-black bg-white transition-all group h-full flex flex-col items-center justify-center">
                                                            <iconify-icon icon="solar:upload-minimalistic-bold-duotone" width="24" class="text-gray-400 mb-2 group-hover:text-black transition-colors"></iconify-icon>
                                                            <p class="text-[10px] font-black uppercase tracking-widest text-gray-900">Verso</p>
                                                            <input type="file" id="payoutVersoUpload" accept="image/*,application/pdf" class="hidden">
                                                        </div>
                                                        <div id="payoutVersoPreview" class="hidden relative h-28 rounded-2xl overflow-hidden group border border-gray-100 bg-white">
                                                            <img src="" class="w-full h-full object-cover">
                                                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button onclick="clearPayoutUpload('verso')" class="w-8 h-8 rounded-full bg-white text-red-500 flex items-center justify-center shadow-xl hover:scale-110 transition-transform"><iconify-icon icon="solar:trash-bin-trash-bold" width="14"></iconify-icon></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Zone 2: Selfie (Realtime Camera) -->
                                            <div class="bg-gray-50 p-5 rounded-[2rem] border border-gray-100 space-y-4">
                                                <div class="flex items-center gap-3 mb-2">
                                                    <iconify-icon icon="solar:camera-bold-duotone" width="24" class="text-gray-900"></iconify-icon>
                                                    <h5 class="font-black text-sm text-gray-900">2. Selfie de sécurité (Caméra)</h5>
                                                </div>
                                                <p class="text-xs text-gray-500 font-medium">Tenez une feuille avec le mot <strong class="text-gray-900">NewKet</strong> devant votre visage.</p>
                                                
                                                <div id="selfieContainer" class="relative w-full aspect-video sm:aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden shadow-inner">
                                                    <video id="selfieVideo" class="w-full h-full object-cover" autoplay playsinline></video>
                                                    <canvas id="selfieCanvas" class="hidden"></canvas>
                                                    <img id="selfiePreviewImg" class="hidden w-full h-full object-cover absolute inset-0">
                                                    
                                                    <div id="selfieCaptureControls" class="absolute bottom-4 inset-x-0 flex justify-center">
                                                        <button onclick="capturePayoutSelfie()" class="w-14 h-14 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                                                            <div class="w-10 h-10 bg-white rounded-full shadow-xl"></div>
                                                        </button>
                                                    </div>
                                                    <div id="selfieRetakeControls" class="absolute bottom-4 inset-x-0 flex justify-center hidden">
                                                        <button onclick="retakePayoutSelfie()" class="px-5 py-2.5 bg-white/90 backdrop-blur-md rounded-xl font-black text-xs uppercase tracking-widest text-gray-900 shadow-xl hover:bg-white transition-all">
                                                            Reprendre
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div id="payoutSubmitError" class="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold hidden text-center"></div>
                                            
                                            <div class="flex gap-3 pt-2">
                                                <button onclick="document.getElementById('payoutStepSecurity').classList.add('hidden'); document.getElementById('payoutStepForm').classList.remove('hidden'); stopSelfieCamera();" class="w-1/3 py-4 text-gray-900 font-black text-xs uppercase tracking-widest border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all">Retour</button>
                                                <button id="payoutSubmitBtn" onclick="submitPayoutChangeRequest()" class="w-2/3 py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:bg-gray-900 active:scale-95 transition-all flex justify-center items-center gap-2">
                                                    Soumettre <iconify-icon icon="solar:check-circle-bold" width="18"></iconify-icon>
                                                </button>
                                            </div>
                                        </div>
"""

JS_START = r"""                function payoutNextToSelfie() {"""
JS_END = r"""                window.payoutBackToDocsRecto = payoutBackToDocsRecto;"""

js_start_idx = content.find(JS_START)
js_end_idx = content.find(JS_END) + len(JS_END)

NEW_JS = r"""                function payoutNextToSelfie() {
                    const accountId = document.getElementById('payoutAccountId').value.trim();
                    const accountName = document.getElementById('payoutAccountName').value.trim();
                    const errorEl = document.getElementById('payoutFormError');
                    const providerRadio = document.querySelector('input[name="payoutProvider"]:checked');
                    if (!providerRadio) return;
                    const provider = providerRadio.value;

                    if(!accountId || !accountName) {
                        errorEl.textContent = "Veuillez remplir tous les champs.";
                        errorEl.classList.remove('hidden');
                        return;
                    }

                    if (!/^0\d{9}$/.test(accountId)) {
                        errorEl.textContent = "Le numéro de téléphone doit contenir exactement 10 chiffres (ex: 0810000000).";
                        errorEl.classList.remove('hidden');
                        return;
                    }

                    const prefix = accountId.substring(1, 3);
                    const operatorPrefixes = {
                        'MPESA': ['81', '82', '83', '51'],
                        'AIRTEL': ['99', '97'],
                        'ORANGE': ['84', '85', '89', '80'],
                        'AFRIMONEY': ['90']
                    };

                    if (!operatorPrefixes[provider].includes(prefix)) {
                        errorEl.textContent = `Ce numéro ne semble pas appartenir au réseau sélectionné.`;
                        errorEl.classList.remove('hidden');
                        return;
                    }

                    errorEl.classList.add('hidden');
                    document.getElementById('payoutStepForm').classList.add('hidden');
                    document.getElementById('payoutStepSecurity').classList.remove('hidden');
                    startSelfieCamera();
                }
                window.payoutNextToSelfie = payoutNextToSelfie;

                let selfieStream = null;
                async function startSelfieCamera() {
                    const video = document.getElementById('selfieVideo');
                    try {
                        selfieStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                        video.srcObject = selfieStream;
                    } catch (e) {
                        document.getElementById('payoutSubmitError').textContent = "Impossible d'accéder à la caméra.";
                        document.getElementById('payoutSubmitError').classList.remove('hidden');
                    }
                }

                function stopSelfieCamera() {
                    if (selfieStream) {
                        selfieStream.getTracks().forEach(t => t.stop());
                        selfieStream = null;
                    }
                }

                function capturePayoutSelfie() {
                    const video = document.getElementById('selfieVideo');
                    const canvas = document.getElementById('selfieCanvas');
                    if (!video.srcObject) return;

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    canvas.toBlob(blob => {
                        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
                        currentPayoutFiles.selfie = file;
                        
                        document.getElementById('selfiePreviewImg').src = URL.createObjectURL(blob);
                        document.getElementById('selfiePreviewImg').classList.remove('hidden');
                        document.getElementById('selfieCaptureControls').classList.add('hidden');
                        document.getElementById('selfieRetakeControls').classList.remove('hidden');
                        stopSelfieCamera();
                    }, 'image/jpeg', 0.8);
                }
                window.capturePayoutSelfie = capturePayoutSelfie;

                function retakePayoutSelfie() {
                    currentPayoutFiles.selfie = null;
                    document.getElementById('selfiePreviewImg').classList.add('hidden');
                    document.getElementById('selfieCaptureControls').classList.remove('hidden');
                    document.getElementById('selfieRetakeControls').classList.add('hidden');
                    startSelfieCamera();
                }
                window.retakePayoutSelfie = retakePayoutSelfie;"""

content = content[:start_idx] + NEW_HTML + content[end_idx:]
js_start_idx = content.find(JS_START)
js_end_idx = content.find(JS_END) + len(JS_END)
content = content[:js_start_idx] + NEW_JS + content[js_end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated perfectly.")
