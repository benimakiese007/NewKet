const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../frontend');

function walk(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'scratch') return;
            walk(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;
            
            const replacementRoot = file.endsWith('components-loader.js') ? '{{ROOT}}' : '/';
            
            const logoMainRegex = /https:\/\/res\.cloudinary\.com\/dzhnphyp3\/image\/upload\/[^"']*Logo_NewKet_Pour_Les_HEADERs_Only\.png/g;
            const logoFallbackRegex = /https:\/\/res\.cloudinary\.com\/dzhnphyp3\/image\/upload\/[^"']*Logo_Header_Officiel_PNG\.png/g;
            
            content = content.replace(logoMainRegex, replacementRoot + 'Images/Logo_NewKet_Pour_Les_HEADERs_Only.png');
            content = content.replace(logoFallbackRegex, replacementRoot + 'Images/Logo_Header_Officiel_PNG.png');
            
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    });
}

walk(dir);
console.log('Done replacing Cloudinary URLs.');
