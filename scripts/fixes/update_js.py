import re
with open(r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\seller-onboarding.html', 'r', encoding='utf-8') as f:
    c = f.read()

old_js = """                // Specific validation for payoutAccountId (must be 10 digits)
                if (id === 'payoutAccountId' && fieldValid) {
                    fieldValid = el.value.trim().length === 10;
                }"""

new_js = """                // Specific validation for payoutAccountId (must be 10 digits and start with 08 or 09)
                if (id === 'payoutAccountId' && fieldValid) {
                    fieldValid = /^(08|09)[0-9]{8}$/.test(el.value.trim());
                    const errorEl = document.getElementById('payoutError');
                    if (!fieldValid && el.value.trim() !== '') {
                        if (errorEl) errorEl.classList.remove('hidden');
                    } else {
                        if (errorEl) errorEl.classList.add('hidden');
                    }
                }"""

c = c.replace(old_js, new_js)

with open(r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\seller-onboarding.html', 'w', encoding='utf-8') as f:
    f.write(c)
