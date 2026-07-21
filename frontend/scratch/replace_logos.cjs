const fs = require('fs');
const path = require('path');
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}
const replaceRegex = /(https:\/\/res\.cloudinary\.com\/dzhnphyp3\/image\/upload\/[^"'\s]*\/Logo_(NewKet_Pour_Les_HEADERs_Only|Header_Officiel(_non)?|NewKet)_PNG\.png|\/Images\/Logo NewKet PNG\.png|https:\/\/newket\.vercel\.app\/Images\/Logo NewKet PNG\.png)/gi;

const newLogo = '/icons/icon-512.png';

let count = 0;
walkDir('.', function(filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.cjs') || filePath.endsWith('.json')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (replaceRegex.test(content)) {
            let newContent = content.replace(replaceRegex, newLogo);
            fs.writeFileSync(filePath, newContent);
            console.log('Updated: ' + filePath);
            count++;
        }
    }
});
console.log('Total files updated: ' + count);
