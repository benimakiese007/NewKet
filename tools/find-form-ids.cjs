/**
 * Find ALL id= occurrences in ALL .js and .html files,
 * grouped by the ID value, showing file + line number.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);

function walk(d) {
    let results = [];
    fs.readdirSync(d).forEach(f => {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory() && f !== 'node_modules' && f !== '.git') {
            results = results.concat(walk(p));
        } else if (f.endsWith('.html') || f.endsWith('.js')) {
            results.push(p);
        }
    });
    return results;
}

// Gather all ids from all files with line numbers
const globalIdMap = {};

walk(dir).forEach(filepath => {
    if (filepath.includes('find-dup-ids')) return;
    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    lines.forEach((line, idx) => {
        // Match all id="..." in this line
        const matches = [...line.matchAll(/\bid="([^"]+)"/g)];
        matches.forEach(m => {
            const id = m[1];
            if (!globalIdMap[id]) globalIdMap[id] = [];
            globalIdMap[id].push({
                file: path.relative(dir, filepath),
                line: idx + 1,
                content: line.trim().substring(0, 100)
            });
        });
    });
});

// Find IDs used in multiple files that look like form fields
// Focus: input/select/textarea or IDs that are actual form fields
const inputKeywords = ['Input', 'input', 'Email', 'email', 'Password', 'password', 'Phone', 'phone', 'Name', 'Search', 'search', 'Price', 'price', 'Title', 'title', 'Description', 'Qty', 'Amount', 'Code'];

console.log('=== FORM-FIELD-LIKE IDs FOUND IN MULTIPLE FILES ===\n');
for (const [id, occurrences] of Object.entries(globalIdMap)) {
    if (occurrences.length > 1 && inputKeywords.some(k => id.includes(k))) {
        console.log(`\nid="${id}" (${occurrences.length} occurrences):`);
        occurrences.forEach(o => {
            console.log(`  ${o.file}:${o.line} → ${o.content}`);
        });
    }
}

// Also: check if newsletter.html is loaded on any page
console.log('\n\n=== CHECKING: pages that could load multiple forms ===');
console.log('(looking for pages with footer newsletter + another email input)');
for (const [id, occurrences] of Object.entries(globalIdMap)) {
    if (id === 'email' || id === 'Email') {
        console.log(`\nid="${id}" found in:`);
        occurrences.forEach(o => console.log(`  ${o.file}:${o.line} → ${o.content}`));
    }
}
