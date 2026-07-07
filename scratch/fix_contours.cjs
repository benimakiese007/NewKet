const fs = require('fs');
const path = require('path');

const targetDir = path.join(process.cwd(), 'frontend', 'src');

const classesToRemove = [
    'bg-white', 'bg-white/50', 'bg-white/10', 'bg-gray-50', 'bg-gray-100', 'bg-gray-100/80', 'bg-red-50',
    'hover:bg-gray-100', 'hover:bg-gray-200', 'hover:bg-red-50', 'hover:bg-white', 'hover:bg-white/10',
    'border', 'border-gray-100', 'border-gray-100/50', 'border-red-200',
    'shadow-sm',
    'rounded-xl', 'rounded-2xl', 'rounded-full', 'rounded-lg',
    'w-8', 'h-8', 'w-9', 'h-9', 'w-10', 'h-10', 'w-12', 'h-12'
];
const regexStr = '\\b(' + classesToRemove.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b\\s*';
const classRegex = new RegExp(regexStr, 'g');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // match <button ...> ... solar:close-circle-bold ... </button>
            const btnRegex = /<button[^>]*>[\s\S]*?<iconify-icon[^>]*icon=["']solar:close-circle-bold["'][\s\S]*?<\/button>/gi;
            
            let changed = false;
            let newContent = content.replace(btnRegex, (match) => {
                const openTagRegex = /^<button([^>]*)>/i;
                return match.replace(openTagRegex, (openTagMatch, inner) => {
                    const newInner = inner.replace(/class=["']([^"']*)["']/gi, (classMatch, classString) => {
                        let newClassStr = classString.replace(classRegex, '').replace(/\s+/g, ' ').trim();
                        return `class="${newClassStr}"`;
                    });
                    return `<button${newInner}>`;
                });
            });
            
            if (content !== newContent) {
                console.log('Modified: ' + fullPath);
                fs.writeFileSync(fullPath, newContent, 'utf8');
            }
        }
    }
}

processDir(targetDir);
console.log('Done');
