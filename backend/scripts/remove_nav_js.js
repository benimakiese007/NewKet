const fs = require('fs');
const path = require('path');

const dirPath = "c:\\Users\\tmaut\\Downloads\\THE PHOENIX\\NewKet";

let filesRemoved = [];
let filesNoNav = [];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.html')) {
                results.push(file);
            }
        }
    });
    return results;
}

const htmlFiles = walk(dirPath);

htmlFiles.forEach(file => {
    const originalContent = fs.readFileSync(file, 'utf8');
    let newContent = originalContent;

    // First pattern matching using the comment text
    const commentStart = "<!-- ========== MOBILE BOTTOM NAV ========== -->";
    let startIdx = newContent.indexOf(commentStart);

    if (startIdx !== -1) {
        let endIdx = newContent.indexOf("</nav>", startIdx);
        if (endIdx !== -1) {
            newContent = newContent.substring(0, startIdx) + newContent.substring(endIdx + 6);
        }
    } else {
        // Second pattern based on specific classes
        const navSig = 'class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between sm:hidden';
        startIdx = newContent.indexOf(navSig);
        if (startIdx !== -1) {
            let navStart = newContent.lastIndexOf("<nav", startIdx);
            if (navStart !== -1) {
                let endIdx = newContent.indexOf("</nav>", startIdx);
                if (endIdx !== -1) {
                    newContent = newContent.substring(0, navStart) + newContent.substring(endIdx + 6);
                }
            }
        }
    }

    // Ensure we delete any extra trailing whitespace leaving pure \n after removal
    if (newContent !== originalContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        filesRemoved.push(file);
    } else {
        filesNoNav.push(file);
    }
});

console.log(`Removed nav from ${filesRemoved.length} files:`);
filesRemoved.forEach(f => console.log(` - ${f}`));
console.log(`Could not find nav in ${filesNoNav.length} files.`);
