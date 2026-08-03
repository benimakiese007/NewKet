const fs = require('fs');
let html = fs.readFileSync('frontend/src/pages/vendor-dashboard.html', 'utf8');

const oldFunc = `                function syncVendorTabFromHash() {
                    const hash = window.location.hash.replace('#', '');
                    const validTabs = ['dashboard', 'analytics', 'products', 'leads', 'purchases', 'promos', 'payouts', 'settings'];
                    if (hash && validTabs.includes(hash)) {
                        switchVendorTab(hash);
                    } else {
                        switchVendorTab('dashboard');
                    }
                }`;

const newFunc = `                function syncVendorTabFromHash() {
                    const hash = window.location.hash.replace('#', '');
                    const baseTab = hash.split('?')[0];
                    const validTabs = ['dashboard', 'analytics', 'products', 'leads', 'purchases', 'promos', 'payouts', 'settings'];
                    if (baseTab && validTabs.includes(baseTab)) {
                        switchVendorTab(baseTab);
                    } else {
                        switchVendorTab('dashboard');
                    }
                }`;

if (html.includes(oldFunc)) {
    html = html.replace(oldFunc, newFunc);
    fs.writeFileSync('frontend/src/pages/vendor-dashboard.html', html, 'utf8');
    console.log('Updated syncVendorTabFromHash successfully');
} else {
    console.error('Function not found - may have already been updated or different whitespace');
}
