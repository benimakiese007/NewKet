const fs = require('fs');
const path = require('path');

const adminDir = 'c:\\Users\\tmaut\\Downloads\\THE PHOENIX\\NewKet\\frontend\\src\\pages\\admin';
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.html'));

console.log(`Checking ${files.length} HTML files...`);
const missing = [];
for (const file of files) {
    const filePath = path.join(adminDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/<title>([^<]*)<\/title>/i);
    if (match) {
        console.log(`${file}: ${match[1]}`);
    } else {
        console.log(`${file}: MISSING TITLE`);
        missing.push(file);
    }
}
console.log(`\nMissing titles in: ${missing.join(', ') || 'None'}`);

// Also search for javascript:void(0) in these files
console.log('\nChecking for javascript:void(0)...');
for (const file of files) {
    const filePath = path.join(adminDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const count = (content.match(/javascript:void\(0\)/g) || []).length;
    if (count > 0) {
        console.log(`${file}: found ${count} occurrences`);
    }
}
