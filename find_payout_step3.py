path = r'c:\Users\tmaut\Downloads\THE PHOENIX\NewKet\frontend\src\pages\vendor-dashboard.html'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'id="payoutStepDocs"' in line:
        print(f'Found payoutStepDocs at line {i}')
    if 'id="payoutSubmitError"' in line:
        print(f'Found payoutSubmitError at line {i}')
    if 'window.clearPayoutUpload = clearPayoutUpload;' in line:
        print(f'Found clearPayoutUpload at line {i}')
    if 'async function submitPayoutChangeRequest()' in line:
        print(f'Found submitPayoutChangeRequest at line {i}')
