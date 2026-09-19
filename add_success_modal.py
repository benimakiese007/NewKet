import re

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui-helpers.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Append to the bottom of the file
success_modal_code = '''

window.showOrderSuccessModal = function() {
    // Inject the success animation container
    const modalHtml = \\
        <div id="orderSuccessOverlay" class="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 backdrop-blur-sm transition-opacity duration-500 opacity-0">
            <div class="flex flex-col items-center justify-center p-8 text-center transform scale-75 opacity-0" id="orderSuccessContent">
                <div class="relative w-32 h-32 mb-6">
                    <svg class="absolute inset-0 w-full h-full text-green-500" viewBox="0 0 52 52">
                        <circle class="stroke-current text-green-200" cx="26" cy="26" r="25" fill="none" stroke-width="2"/>
                        <circle id="successCircle" class="stroke-current text-green-500" cx="26" cy="26" r="25" fill="none" stroke-width="2" stroke-dasharray="157" stroke-dashoffset="157" style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 0.8s ease-in-out;"/>
                        <path id="successCheck" class="stroke-current text-green-500" fill="none" stroke-width="3" d="M14.1 27.2l7.1 7.2 16.7-16.8" stroke-dasharray="35" stroke-dashoffset="35" style="transition: stroke-dashoffset 0.5s ease-out 0.8s;"/>
                    </svg>
                </div>
                <h2 class="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">Commande validée !</h2>
                <p class="text-gray-500 font-medium mb-8 max-w-sm">Merci pour votre achat. Vous allez être redirigé vers le suivi de votre commande.</p>
            </div>
        </div>
    \\;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const overlay = document.getElementById('orderSuccessOverlay');
    const content = document.getElementById('orderSuccessContent');
    const circle = document.getElementById('successCircle');
    const check = document.getElementById('successCheck');
    
    // Trigger animations
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        content.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease';
        content.classList.remove('scale-75', 'opacity-0');
        
        setTimeout(() => {
            circle.style.strokeDashoffset = '0';
            check.style.strokeDashoffset = '0';
        }, 300);
        
        // Redirect after animation completes
        setTimeout(() => {
            window.location.href = '/customer-dashboard.html#orders';
        }, 2800);
    });
};
'''

# Check if it already exists to avoid duplicates
if 'window.showOrderSuccessModal' not in content:
    content += success_modal_code
    with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui-helpers.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added showOrderSuccessModal to ui-helpers.js!")
else:
    print("Already exists!")
