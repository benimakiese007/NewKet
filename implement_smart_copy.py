import re

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui-helpers.js', 'r', encoding='utf-8') as f:
    content = f.read()

animation_fn = '''
window.copyAndAnimateButton = async function(event, text, successText = 'Copié !') {
    const btn = event.currentTarget;
    if (!btn || btn._isAnimatingCopy) return;
    btn._isAnimatingCopy = true;

    // Save original state
    if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
    }

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
    } else if (window.copyTextToClipboard) {
        window.copyTextToClipboard(text);
    }

    // Determine if it's an icon-only button by checking its structure
    const textSpan = btn.querySelector('span');
    const isIconOnly = !textSpan || textSpan.textContent.trim() === '';

    // Animate button
    btn.innerHTML = <iconify-icon icon="solar:check-circle-bold" class="text-green-500 scale-125 transition-transform duration-300"></iconify-icon> + 
                    (isIconOnly ? '' : <span class="text-green-500 font-bold ml-1"></span>);
    
    // Add success colors temporarily
    const originalClasses = btn.className;
    btn.classList.add('border-green-200', 'bg-green-50');

    setTimeout(() => {
        btn.innerHTML = btn.dataset.originalHtml;
        btn.className = originalClasses;
        btn._isAnimatingCopy = false;
    }, 2000);
};
'''

if 'window.copyAndAnimateButton =' not in content:
    # Inject after copyTextToClipboard block
    # copyTextToClipboard ends around line 258, but we can just append it safely to the bottom or near it
    content += animation_fn

# Replace in ui-helpers.js product share button
target_share = r"navigator\.clipboard\.writeText\(window\.location\.origin \+ resolvePath\('pages/product'\) \+ '\?id=\$\{p\.id\}'\); if\(window\.showToast\) showToast\('Lien copi. !', 'info'\);"
replacement_share = r"window.copyAndAnimateButton(event, window.location.origin + resolvePath('pages/product') + '?id=');"
content = re.sub(target_share, replacement_share, content)

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/services/ui-helpers.js', 'w', encoding='utf-8') as f:
    f.write(content)

# Replace in footer.html
with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/partials/footer.html', 'r', encoding='utf-8') as f:
    footer_content = f.read()

target_footer = r"if\(window\.copyTextToClipboard\) \{ window\.copyTextToClipboard\('newketmarket@gmail\.com'\); if\(window\.showToast\) window\.showToast\('Adresse email copi.e dans le presse-papiers', 'success'\); \}"
replacement_footer = r"if(window.copyAndAnimateButton) { window.copyAndAnimateButton(event, 'newketmarket@gmail.com'); }"
footer_content = re.sub(target_footer, replacement_footer, footer_content)

with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/partials/footer.html', 'w', encoding='utf-8') as f:
    f.write(footer_content)

# Replace in support.html just in case
with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/pages/support.html', 'r', encoding='utf-8') as f:
    support_content = f.read()
support_content = re.sub(target_footer, replacement_footer, support_content)
with open('c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend/src/pages/support.html', 'w', encoding='utf-8') as f:
    f.write(support_content)

print("Smart copy buttons implemented!")
