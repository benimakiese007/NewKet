path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# The crash is at line 5828 where it tries to access payoutStepForm/payoutStepSecurity
# BEFORE the modal is even created. We need to wrap those in null-guards.

# Fix 1: Null-guard payoutSelfieError and payoutSubmitError and payoutStepSecurity/Form
old_reset = '''                    document.getElementById('payoutFormError').classList.add('hidden');
                    document.getElementById('payoutSelfieError').classList.add('hidden');
                    document.getElementById('payoutSubmitError').classList.add('hidden');

                    document.getElementById('payoutStepSecurity').classList.add('hidden');
                    document.getElementById('payoutStepForm').classList.remove('hidden');'''

new_reset = '''                    const _pfe = document.getElementById('payoutFormError'); if (_pfe) _pfe.classList.add('hidden');
                    const _pse = document.getElementById('payoutSelfieError'); if (_pse) _pse.classList.add('hidden');
                    const _psu = document.getElementById('payoutSubmitError'); if (_psu) _psu.classList.add('hidden');

                    const _pss = document.getElementById('payoutStepSecurity'); if (_pss) _pss.classList.add('hidden');
                    const _psf = document.getElementById('payoutStepForm'); if (_psf) _psf.classList.remove('hidden');'''

if old_reset in c:
    c = c.replace(old_reset, new_reset)
    print("Fix 1 applied")
else:
    print("Fix 1 NOT found - searching...")
    idx = c.find("payoutStepSecurity').classList.add('hidden')")
    if idx != -1:
        print(c[max(0,idx-300):idx+300])

# Fix 2: Also null-guard the payoutAccountId/payoutAccountName resets
old_reset2 = '''                    document.getElementById('payoutAccountId').value = '';
                    document.getElementById('payoutAccountName').value = '';'''
new_reset2 = '''                    const _pai = document.getElementById('payoutAccountId'); if (_pai) _pai.value = '';
                    const _pan = document.getElementById('payoutAccountName'); if (_pan) _pan.value = '';'''
if old_reset2 in c:
    c = c.replace(old_reset2, new_reset2)
    print("Fix 2 applied")
else:
    print("Fix 2 NOT found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Done")
