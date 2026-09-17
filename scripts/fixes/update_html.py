import re
with open(r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\seller-onboarding.html', 'r', encoding='utf-8') as f:
    c = f.read()

old_html = """                    <input type="tel" id="payoutAccountId" required placeholder="ex: 08XXXXXXXX"
                        maxlength="10" pattern="[0-9]{10}" oninput="this.value = this.value.replace(/[^0-9]/g, '')"
                        class="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-black transition-all outline-none font-medium placeholder:text-gray-300">
                    <p class="text-[11px] text-gray-400 ml-1">Le numéro de mobile money sur lequel vous recevrez vos paiements (10 chiffres).</p>"""

new_html = """                    <input type="tel" id="payoutAccountId" required placeholder="ex: 08XXXXXXXX"
                        maxlength="10" pattern="^(08|09)[0-9]{8}$" oninput="this.value = this.value.replace(/[^0-9]/g, ''); document.getElementById('payoutError').classList.add('hidden');"
                        class="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-black transition-all outline-none font-medium placeholder:text-gray-300">
                    <p id="payoutError" class="text-[11px] font-bold text-red-500 ml-1 hidden">Le numéro doit commencer par 08 ou 09 et contenir 10 chiffres.</p>
                    <p class="text-[11px] text-gray-400 ml-1 mt-1">Le numéro de mobile money sur lequel vous recevrez vos paiements.</p>"""

c = c.replace(old_html, new_html)

with open(r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\seller-onboarding.html', 'w', encoding='utf-8') as f:
    f.write(c)
