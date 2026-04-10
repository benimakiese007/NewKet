/**
 * This script finds ALL id="..." occurrences across ALL .html and .js files
 * and reports which IDs are used more than once within the SAME FILE
 * (which could indicate template duplication issues)
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const idRegex = /id="([^"]+)"/g;

function walk(d) {
    let results = [];
    fs.readdirSync(d).forEach(f => {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory() && f !== 'node_modules' && f !== '.git') {
            results = results.concat(walk(p));
        } else if (f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.cjs')) {
            results.push(p);
        }
    });
    return results;
}

// Also scan ALL .js + .html files for ALL id= occurrences globally
const globalIdMap = {};

walk(dir).forEach(f => {
    if (f.endsWith('.cjs')) return; // skip this script itself
    const content = fs.readFileSync(f, 'utf8');
    const matches = [...content.matchAll(idRegex)].map(x => x[1]);
    
    // Per-file duplicates
    const counts = {};
    matches.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const dups = Object.entries(counts).filter(([k, v]) => v > 1);
    if (dups.length) {
        console.log('\n=== PER-FILE DUPLICATE in: ' + path.relative(dir, f) + ' ===');
        dups.forEach(([k, v]) => console.log('  id="' + k + '" x' + v));
    }

    // Global
    matches.forEach(id => {
        if (!globalIdMap[id]) globalIdMap[id] = [];
        globalIdMap[id].push(path.relative(dir, f));
    });
});

// Global duplicates across files (same ID in multiple files = potential runtime collision)
console.log('\n\n=== GLOBAL IDs FOUND IN MULTIPLE FILES ===');
for (const [id, files] of Object.entries(globalIdMap)) {
    if (files.length > 1) {
        // Filter: only show if ID looks like a form field
        const formFieldKeywords = ['input', 'email', 'password', 'search', 'name', 'phone', 'username', 'confirm', 'address', 'city', 'street', 'code', 'price', 'amount', 'qty', 'quantity', 'message', 'title', 'description'];
        const isFormField = formFieldKeywords.some(k => id.toLowerCase().includes(k));
        if (isFormField) {
            console.log('\n  id="' + id + '" in ' + files.length + ' files:');
            files.forEach(f => console.log('    - ' + f));
        }
    }
}
