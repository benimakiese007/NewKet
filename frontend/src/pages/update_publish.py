import re

path = 'C:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/pages/publish.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert stepper before form
stepper_html = """
        <div id="publish-stepper" class="mb-10 max-w-lg mx-auto">
            <div class="flex items-center justify-between relative">
                <div class="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 z-0 rounded-full"></div>
                <div id="progress-line" class="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-black z-0 rounded-full transition-all duration-500" style="width: 0%;"></div>
                
                <div class="step-indicator relative z-10 flex flex-col items-center gap-2 group cursor-pointer" onclick="window.publishWizard.show(1)">
                    <div id="indicator-1" class="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold shadow-lg ring-4 ring-gray-50 transition-all duration-300">1</div>
                    <span id="label-1" class="text-[10px] font-bold text-black uppercase tracking-wider absolute -bottom-6 whitespace-nowrap">Médias & Titre</span>
                </div>
                
                <div class="step-indicator relative z-10 flex flex-col items-center gap-2 group cursor-pointer" onclick="window.publishWizard.show(2)">
                    <div id="indicator-2" class="w-10 h-10 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center font-bold ring-4 ring-gray-50 transition-all duration-300">2</div>
                    <span id="label-2" class="text-[10px] font-bold text-gray-400 uppercase tracking-wider absolute -bottom-6 whitespace-nowrap">Détails</span>
                </div>
                
                <div class="step-indicator relative z-10 flex flex-col items-center gap-2 group cursor-pointer" onclick="window.publishWizard.show(3)">
                    <div id="indicator-3" class="w-10 h-10 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center font-bold ring-4 ring-gray-50 transition-all duration-300">3</div>
                    <span id="label-3" class="text-[10px] font-bold text-gray-400 uppercase tracking-wider absolute -bottom-6 whitespace-nowrap">Prix & Livraison</span>
                </div>
            </div>
        </div>
"""
content = content.replace('<form id="publishForm"', stepper_html + '\n        <form id="publishForm"')

# 2. Add navigation buttons HTML
nav_step1 = """
                <div class="flex justify-end pt-4">
                    <button type="button" onclick="window.publishWizard.next(1)" class="bg-black text-white px-8 py-4 rounded-2xl font-bold shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
                        Suivant <iconify-icon icon="solar:alt-arrow-right-bold"></iconify-icon>
                    </button>
                </div>
"""
nav_step2 = """
                <div class="flex justify-between pt-4 gap-4">
                    <button type="button" onclick="window.publishWizard.prev(2)" class="bg-gray-100 text-gray-900 px-8 py-4 rounded-2xl font-bold hover:bg-gray-200 active:bg-gray-300 transition-all flex items-center gap-2">
                        <iconify-icon icon="solar:alt-arrow-left-bold"></iconify-icon> Précédent
                    </button>
                    <button type="button" onclick="window.publishWizard.next(2)" class="bg-black text-white px-8 py-4 rounded-2xl font-bold shadow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
                        Suivant <iconify-icon icon="solar:alt-arrow-right-bold"></iconify-icon>
                    </button>
                </div>
"""
nav_step3 = """
                <div class="flex flex-col sm:flex-row justify-between pt-4 gap-4">
                    <button type="button" onclick="window.publishWizard.prev(3)" class="order-2 sm:order-1 bg-gray-100 text-gray-900 px-8 py-4 rounded-2xl font-bold hover:bg-gray-200 active:bg-gray-300 transition-all flex items-center justify-center gap-2">
                        <iconify-icon icon="solar:alt-arrow-left-bold"></iconify-icon> Précédent
                    </button>
                    <!-- Submit button remains here, we will prepend to its container -->
"""

js_logic = """
    <script>
        // --- WIZARD & AUTOSAVE LOGIC ---
        document.addEventListener('DOMContentLoaded', () => {
            const form = document.getElementById('publishForm');
            if (!form) return;
            
            // 1. DOM Restructuring for Steps
            const step1 = document.createElement('div'); step1.id = 'step-1'; step1.className = 'publish-step space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500';
            const step2 = document.createElement('div'); step2.id = 'step-2'; step2.className = 'publish-step space-y-6 hidden animate-in fade-in slide-in-from-bottom-4 duration-500';
            const step3 = document.createElement('div'); step3.id = 'step-3'; step3.className = 'publish-step space-y-6 hidden animate-in fade-in slide-in-from-bottom-4 duration-500';
            
            const cards = form.querySelectorAll('.bg-white.rounded-\\\\[2.5rem\\\\].p-10');
            const basicInfoCard = cards[0];
            const promoCard = cards[1];
            const mediaCard = cards[2];
            const detailsCard = cards[3];
            
            if(basicInfoCard && promoCard && mediaCard && detailsCard) {
                // Split basicInfoCard
                const titleBlock = basicInfoCard.children[0]; 
                const catCondBlock = basicInfoCard.children[1]; 
                const stockEscrowBlock = basicInfoCard.children[2]; 
                const priceBlock = basicInfoCard.children[3]; 
                const exchangeBlock = basicInfoCard.children[4]; 
                
                // Step 1
                const s1Card = document.createElement('div');
                s1Card.className = 'bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm space-y-8';
                s1Card.appendChild(titleBlock.cloneNode(true));
                step1.appendChild(s1Card);
                step1.appendChild(mediaCard.cloneNode(true));
                
                // Step 2
                const s2Card = document.createElement('div');
                s2Card.className = 'bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm space-y-8';
                s2Card.appendChild(catCondBlock.cloneNode(true));
                const descBlock = detailsCard.children[0];
                s2Card.appendChild(descBlock.cloneNode(true));
                step2.appendChild(s2Card);
                
                // Step 3
                const s3Card = document.createElement('div');
                s3Card.className = 'bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm space-y-8';
                s3Card.appendChild(stockEscrowBlock.cloneNode(true));
                s3Card.appendChild(priceBlock.cloneNode(true));
                s3Card.appendChild(exchangeBlock.cloneNode(true));
                step3.appendChild(s3Card);
                step3.appendChild(promoCard.cloneNode(true));
                
                // Submit logic
                const submitBlock = detailsCard.children[1].cloneNode(true);
                submitBlock.className = "order-1 sm:order-2 flex-1"; 
                
                // Navigation
                const nav1 = document.createElement('div'); nav1.innerHTML = `""" + nav_step1.strip() + """`;
                step1.appendChild(nav1.firstElementChild);
                
                const nav2 = document.createElement('div'); nav2.innerHTML = `""" + nav_step2.strip() + """`;
                step2.appendChild(nav2.firstElementChild);
                
                const nav3 = document.createElement('div'); nav3.innerHTML = `""" + nav_step3.strip() + """`;
                const n3 = nav3.firstElementChild;
                n3.appendChild(submitBlock);
                step3.appendChild(n3);
                
                // Commit
                form.innerHTML = '';
                form.appendChild(step1);
                form.appendChild(step2);
                form.appendChild(step3);
                
                bindFormListeners(form);
            }
            
            // 2. Wizard Logic
            window.publishWizard = {
                current: 1,
                show: function(step) {
                    if (step < 1 || step > 3) return;
                    document.getElementById('step-1').classList.add('hidden');
                    document.getElementById('step-2').classList.add('hidden');
                    document.getElementById('step-3').classList.add('hidden');
                    document.getElementById('step-'+step).classList.remove('hidden');
                    
                    const line = document.getElementById('progress-line');
                    if(line) line.style.width = ((step-1)/2)*100 + '%';
                    
                    for(let i=1; i<=3; i++) {
                        const ind = document.getElementById('indicator-'+i);
                        const lbl = document.getElementById('label-'+i);
                        if(!ind || !lbl) continue;
                        
                        if(i === step) {
                            ind.className = 'w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold shadow-lg ring-4 ring-gray-50 transition-all duration-300';
                            lbl.className = 'text-[10px] font-bold text-black uppercase tracking-wider absolute -bottom-6 whitespace-nowrap';
                        } else if(i < step) {
                            ind.className = 'w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold ring-4 ring-gray-50 transition-all duration-300';
                            lbl.className = 'text-[10px] font-bold text-gray-400 uppercase tracking-wider absolute -bottom-6 whitespace-nowrap';
                        } else {
                            ind.className = 'w-10 h-10 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center font-bold ring-4 ring-gray-50 transition-all duration-300';
                            lbl.className = 'text-[10px] font-bold text-gray-400 uppercase tracking-wider absolute -bottom-6 whitespace-nowrap';
                        }
                    }
                    this.current = step;
                    window.scrollTo({top: 0, behavior: 'smooth'});
                },
                next: function(currentStep) {
                    const stepDiv = document.getElementById('step-'+currentStep);
                    const required = stepDiv.querySelectorAll('[required]');
                    let valid = true;
                    required.forEach(el => {
                        if(!el.value.trim()) {
                            valid = false;
                            el.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
                            el.addEventListener('input', () => el.classList.remove('ring-2', 'ring-red-500', 'bg-red-50'), {once:true});
                        }
                    });
                    if(valid) this.show(currentStep + 1);
                },
                prev: function(currentStep) {
                    this.show(currentStep - 1);
                }
            };
            
            // 3. Auto-save Logic
            const inputs = form.querySelectorAll('input:not([type="file"]):not([type="checkbox"]), textarea, select');
            inputs.forEach(input => {
                if(input.id && input.id !== "exchangeRate") {
                    const saved = localStorage.getItem('publish_draft_' + input.id);
                    if(saved !== null) {
                        input.value = saved;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    input.addEventListener('input', (e) => localStorage.setItem('publish_draft_' + input.id, e.target.value));
                    input.addEventListener('change', (e) => localStorage.setItem('publish_draft_' + input.id, e.target.value));
                }
            });
            
            const checkboxes = form.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if(cb.id) {
                    const saved = localStorage.getItem('publish_draft_' + cb.id);
                    if(saved !== null) {
                        cb.checked = saved === 'true';
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    cb.addEventListener('change', (e) => localStorage.setItem('publish_draft_' + cb.id, e.target.checked));
                }
            });
            
            form.addEventListener('submit', () => {
                inputs.forEach(i => localStorage.removeItem('publish_draft_' + i.id));
                checkboxes.forEach(cb => localStorage.removeItem('publish_draft_' + cb.id));
            });
            
            // Prevent submit if validation fails
            form.addEventListener('submit', (e) => {
                const required = form.querySelectorAll('[required]');
                let valid = true;
                required.forEach(el => {
                    if(!el.value.trim()) {
                        valid = false;
                        el.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
                    }
                });
                if(!valid) {
                    e.preventDefault();
                    window.publishWizard.show(1);
                }
            });
            
            function bindFormListeners(f) {
                const p = f.querySelector('#priceInput');
                const c = f.querySelector('#currencyInput');
                const e = f.querySelector('#exchangeRate');
                const pT = f.querySelector('#isPromoToggle');
                const oP = f.querySelector('#oldPriceInput');
                
                if(p) p.addEventListener('input', () => { if(window.updateEstimate) window.updateEstimate(); if(window.updatePromoPercentage) window.updatePromoPercentage(); });
                if(c) c.addEventListener('change', () => { if(window.updateEstimate) window.updateEstimate(); if(window.updatePromoPercentage) window.updatePromoPercentage(); });
                if(e) e.addEventListener('input', () => { if(window.updateEstimate) window.updateEstimate(); });
                if(pT) {
                    pT.addEventListener('change', (evt) => {
                        const pf = f.querySelector('#promoFields');
                        if(pf) {
                            if(evt.target.checked) pf.classList.remove('hidden');
                            else pf.classList.add('hidden');
                        }
                        if(window.updatePromoPercentage) window.updatePromoPercentage();
                    });
                }
                if(oP) oP.addEventListener('input', () => { if(window.updatePromoPercentage) window.updatePromoPercentage(); });
                
                const uz = f.querySelector('#uploadZone');
                const iu = f.querySelector('#pImageUpload');
                if(uz && iu) {
                    uz.onclick = () => iu.click();
                    iu.addEventListener('change', (evt) => {
                        const oldIu = document.getElementById('pImageUpload');
                        if(oldIu && oldIu !== iu) {
                            oldIu.files = iu.files;
                            oldIu.dispatchEvent(new Event('change'));
                        }
                    });
                }
            }
        });
    </script>
"""

content = content.replace('</body>', js_logic + '\n</body>')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Script injected successfully!')
