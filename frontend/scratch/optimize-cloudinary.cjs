const fs = require('fs');
const path = require('path');

const directory = 'c:/Users/tmaut/Downloads/THE PHOENIX/NewKet/frontend';

// Only match /upload/v (meaning no existing transformations)
const searchRegex = /https:\/\/res\.cloudinary\.com\/dzhnphyp3\/image\/upload\/v/g;
const replaceStr = 'https://res.cloudinary.com/dzhnphyp3/image/upload/f_auto,q_auto/v';

let modifiedFilesCount = 0;

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        if (file === 'node_modules' || file === '.git' || file === 'output' || file.endsWith('.log')) return;
        
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directory);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (searchRegex.test(content)) {
        const newContent = content.replace(searchRegex, replaceStr);
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Modified: ${file}`);
        modifiedFilesCount++;
    }
});

console.log(`\nDone! Modified ${modifiedFilesCount} files.`);
