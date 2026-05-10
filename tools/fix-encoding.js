const fs = require('fs');
const path = require('path');

const replacements = {
    'é': 'é',
    'è': 'è',
    'ê': 'ê',
    'ë': 'ë',
    'à': 'à',
    'â': 'â',
    'ç': 'ç',
    'î': 'î',
    'ï': 'ï',
    'ô': 'ô',
    'ö': 'ö',
    'ù': 'ù',
    'û': 'û',
    'ü': 'ü',
    'à': 'À',
    'Ã‚': 'Â',
    'Ã†': 'Æ',
    'Ã‡': 'Ç',
    'É': 'É',
    'ÃŠ': 'Ê',
    'Ã‹': 'Ë',
    'ÃŽ': 'Î',
    'Ã': 'Ï',
    'Ã”': 'Ô',
    'Ãœ': 'Ü',
    'Å“': 'œ',
    'Å’': 'Œ',
    'â‚¬': '€',
    '’': "'",
    '“': '"',
    '”': '"',
    '–': '–',
    '—': '—',
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
