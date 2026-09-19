import re

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace toast in filterAllProducts
filter_catch_target = r"\} catch \(err\) \{\s*console\.error\(\"Error loading filtered products:\", err\);\s*if \(window\.showToast\) showToast\('Erreur lors du chargement', 'error'\);\s*\}"

filter_catch_replacement = r"""} catch (err) {
            console.error("Error loading filtered products:", err);
            if (grid) grid.innerHTML = <div class="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-gray-100"><iconify-icon icon="solar:wifi-router-minimalistic-broken" width="48" class="text-red-400 mb-3"></iconify-icon><p class="text-gray-800 font-semibold mb-1">Impossible de filtrer les produits</p><button onclick="window.filterAllProducts('')" class="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-gray-800 transition-colors mt-2">Réessayer</button></div>;
        }"""

content = re.sub(filter_catch_target, filter_catch_replacement, content)


# 2. Replace toast in showMoreProducts
showmore_catch_target = r"\} catch \(err\) \{\s*console\.error\(\"Error loading more products:\", err\);\s*if \(window\.showToast\) showToast\('Erreur lors du chargement', 'error'\);\s*\}"

showmore_catch_replacement = r"""} catch (err) {
        console.error("Error loading more products:", err);
        if (buttonLabel) {
            buttonLabel.textContent = 'Erreur réseau, réessayer';
            if (button) button.classList.add('border-red-500', 'text-red-500');
            setTimeout(() => {
                if (button) button.classList.remove('border-red-500', 'text-red-500');
                buttonLabel.textContent = 'Voir plus de produits';
            }, 4000);
        }
    }"""

content = re.sub(showmore_catch_target, showmore_catch_replacement, content)


with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("ui.js updated for loading toasts!")
