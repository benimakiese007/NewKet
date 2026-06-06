const fs = require('fs');
const path = require('path');

const replacements = {
  'Ã©': 'é',
  'Ã¨': 'è',
  'Ã\xa0': 'à',
  'Ã ': 'à',
  'Ã¢': 'â',
  'Ã§': 'ç',
  'Ãª': 'ê',
  'Ã®': 'î',
  'Ã´': 'ô',
  'Ã»': 'û',
  'Ã‰': 'É',
  'Â°': '°',
  'Ã€': 'À',
  'Ã¯': 'ï',
  'Å“': 'œ'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  
  for (const [bad, good] of Object.entries(replacements)) {
    if (content.includes(bad)) {
      content = content.split(bad).join(good);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed encoding in: ${filePath}`);
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        traverse(fullPath);
      }
    } else {
      if (fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.css') || fullPath.endsWith('.json') || fullPath.endsWith('.md')) {
        processFile(fullPath);
      }
    }
  }
}

const targetDir = __dirname;
console.log(`Starting encoding fix in ${targetDir}`);
traverse(targetDir);
console.log('Done!');
