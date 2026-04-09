const fs = require('fs');
const path = require('path');

const HEADER_IDS = ['searchInput', 'searchBtn', 'searchSuggestions', 'mobileMenuBtn', 'mobileOverlay', 'mobileMenu', 'closeMobileMenu', 'mobileGuestCTA', 'mobileLoggedCTA', 'mobileLoggedLink', 'mobileLoggedAvatar', 'mobileLoggedIcon', 'mobileLoggedName', 'mobileLoggedRole', 'mobileCurrencyToggle', 'currencyToggle', 'accountLink', 'mobileLogoutBtn', 'mobileFavoritesBadge', 'pwa-install-btn', 'mobileSearchContainer'];
const MOBILE_NAV_IDS = ['mobileBottomNav', 'mobileBottomAccountCustomer', 'nav-home', 'nav-catalog', 'nav-forum'];
const FOOTER_IDS = []; // footer doesn't have IDs now

function walk(d) {
    let results = [];
    fs.readdirSync(d).forEach(f => {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory() && f !== 'node_modules' && f !== '.git') {
            results = results.concat(walk(p));
        } else if (f.endsWith('.html')) {
            results.push(p);
        }
    });
    return results;
}

const issues = [];

walk(__dirname).forEach(filepath => {
    if (filepath.includes('find-') || filepath.includes('scan-')) return;
    
    const content = fs.readFileSync(filepath, 'utf8');
    const ids = [...content.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    
    // Check for conflicts with HEADER IDs
    const hasHeader = content.includes('header-placeholder') || content.includes('adminNavbarPlaceholder');
    if (hasHeader) {
        const conflicts = ids.filter(id => HEADER_IDS.includes(id) || MOBILE_NAV_IDS.includes(id));
        if (conflicts.length > 0) {
            issues.push({ file: path.relative(__dirname, filepath), conflicts, type: 'header-conflict' });
        }
    }
    
    // Check for in-file duplicates
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const dups = Object.entries(counts).filter(([k, v]) => v > 1);
    if (dups.length > 0) {
        issues.push({ file: path.relative(__dirname, filepath), dups, type: 'in-file-dup' });
    }
});

console.log('\n=== PAGES WITH IN-FILE DUPLICATE IDs ===');
issues.filter(x => x.type === 'in-file-dup').forEach(x => {
    console.log('\n' + x.file);
    x.dups.forEach(([id, count]) => console.log('  DUPLICATE: id="' + id + '" x' + count));
});

console.log('\n\n=== PAGES THAT CONFLICT WITH HEADER/NAV IDs ===');
issues.filter(x => x.type === 'header-conflict').forEach(x => {
    console.log('\n' + x.file);
    x.conflicts.forEach(id => console.log('  CONFLICT: id="' + id + '" also exists in injected header'));
});
