const fs = require('fs');
let html = fs.readFileSync('frontend/src/pages/vendor-dashboard.html', 'utf8');

// Fix switchTab references in the copied Achat block to use vendor equivalents
html = html.replace(/window\.switchTab\('purchases'\)/g, "window.switchVendorTab('purchases')");
html = html.replace(/typeof window\.switchTab/g, "typeof window.switchVendorTab");
html = html.replace(/window\.switchTab\('orders'\)/g, "window.switchVendorTab('leads')");
html = html.replace(/window\.switchTab \&\& window\.switchTab/g, "window.switchVendorTab && window.switchVendorTab");

fs.writeFileSync('frontend/src/pages/vendor-dashboard.html', html, 'utf8');
console.log('Fixed switchTab -> switchVendorTab');
