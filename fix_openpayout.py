path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update openAddPayoutModal to accept preserveFiles param
content = content.replace(
    'function openAddPayoutModal() {',
    'function openAddPayoutModal(preserveFiles = false) {'
)

# 2. Update the reset logic - add conditional reset
OLD_RESET = "                    // Reset files\n                    currentPayoutFiles = { selfie: null, recto: null, verso: null };\n                    clearPayoutUpload('recto');\n                    clearPayoutUpload('verso');\n                    if(document.getElementById('selfiePreviewImg')) document.getElementById('selfiePreviewImg').classList.add('hidden');"

NEW_RESET = """                    // Reset files only if not preserving
                    if (!preserveFiles) {
                        currentPayoutFiles = { selfie: null, recto: null, verso: null };
                        clearPayoutUpload('recto');
                        clearPayoutUpload('verso');
                        if(document.getElementById('selfiePreviewImg')) document.getElementById('selfiePreviewImg').classList.add('hidden');
                    } else {
                        // Show previews for pre-filled files
                        if (currentPayoutFiles && currentPayoutFiles.recto) {
                            const rz = document.getElementById('payoutRectoZone');
                            const rp = document.getElementById('payoutRectoPreview');
                            if (rz && rp) { rz.classList.add('hidden'); rp.classList.remove('hidden'); rp.querySelector('img').src = URL.createObjectURL(currentPayoutFiles.recto); }
                        }
                        if (currentPayoutFiles && currentPayoutFiles.verso) {
                            const vz = document.getElementById('payoutVersoZone');
                            const vp = document.getElementById('payoutVersoPreview');
                            if (vz && vp) { vz.classList.add('hidden'); vp.classList.remove('hidden'); vp.querySelector('img').src = URL.createObjectURL(currentPayoutFiles.verso); }
                        }
                        if (currentPayoutFiles && currentPayoutFiles.selfie) {
                            const si = document.getElementById('selfiePreviewImg');
                            if (si) { si.src = URL.createObjectURL(currentPayoutFiles.selfie); si.classList.remove('hidden'); }
                            const cc = document.getElementById('selfieCaptureControls');
                            const rc = document.getElementById('selfieRetakeControls');
                            if (cc) cc.classList.add('hidden');
                            if (rc) rc.classList.remove('hidden');
                        }
                    }"""

content = content.replace(OLD_RESET, NEW_RESET)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("openAddPayoutModal updated!")
