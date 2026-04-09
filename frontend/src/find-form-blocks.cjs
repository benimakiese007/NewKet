const fs = require('fs');
const path = require('path');

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

const htmlFiles = walk(__dirname);
let foundIssues = false;

htmlFiles.forEach(file => {
    if (file.includes('find-') || file.includes('scan-')) return;
    const content = fs.readFileSync(file, 'utf8');
    
    // Naïve approach using regex to extract each form's content
    const formRegex = /<form[\s\S]*?<\/form>/gi;
    let match;
    let formIndex = 0;
    while ((match = formRegex.exec(content)) !== null) {
        formIndex++;
        const formContent = match[0];
        const inputRegex = /<(input|textarea|select)[^>]+\bid=["']([^"']+)["']/gi;
        const ids = {};
        
        let inputMatch;
        while ((inputMatch = inputRegex.exec(formContent)) !== null) {
            const id = inputMatch[2];
            if (id) {
                ids[id] = (ids[id] || 0) + 1;
            }
        }
        
        const dups = Object.entries(ids).filter(([k,v]) => v > 1);
        if (dups.length > 0) {
            console.log(`\nDUPLICATE FIELD ID IN SAME FORM in ${path.relative(__dirname, file)} (Form #${formIndex})`);
            dups.forEach(([id, count]) => {
                console.log(`  id="${id}" appears ${count} times.`);
                foundIssues = true;
            });
        }
    }
});

if (!foundIssues) {
    console.log("No duplicate IDs found within the same form blocks globally.");
}
