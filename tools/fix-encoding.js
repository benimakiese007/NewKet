const fs = require('fs');
const path = require('path');

const replacements = {
    'é': 'é',
    'Ã¨': 'è',
    'Ãª': 'ê',
    'Ã«': 'ë',
    'Ã ': 'à',
    'Ã¢': 'â',
    'Ã§': 'ç',
    'Ã®': 'î',
    'Ã¯': 'ï',
    'Ã´': 'ô',
    'Ã¶': 'ö',
    'Ã¹': 'ù',
    'Ã»': 'û',
    'Ã¼': 'ü',
    'Ã ': 'À',
    'Ã‚': 'Â',
    'Ã†': 'Æ',
    'Ã‡': 'Ç',
    'Ã‰': 'É',
    'ÃŠ': 'Ê',
    'Ã‹': 'Ë',
    'ÃŽ': 'Î',
    'Ã': 'Ï',
    'Ã”': 'Ô',
    'Ãœ': 'Ü',
    'Å“': 'œ',
    'Å’': 'Œ',
    'â‚¬': '€',
    'â€™': "'",
    'â€œ': '"',
    'â€': '"',
    'â€“': '–',
    'â€”': '—',
    'Â«': '«',
    'Â»': '»',
    'Â°': '°',
    'Â': ' ' // Â space usually comes before nbsp
};

function processDirectory(directory) {
    if (!fs.existsSync(directory)) return;
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
        if (file === 'node_modules' || file === 'dist' || file === '.git' || file === 'venv') continue;
        
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.json') || file.endsWith('.py')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            for (const [bad, good] of Object.entries(replacements)) {
                if (content.includes(bad)) {
                    content = content.split(bad).join(good);
                    modified = true;
                }
            }
            
            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Fixed encoding in ${fullPath}`);
            }
        }
    }
}

processDirectory(path.join(__dirname, 'frontend'));
processDirectory(path.join(__dirname, 'backend'));
console.log('Done');
