const fs = require('fs');
const path = require('path');

const frontendRoot = 'c:\\Users\\tmaut\\Downloads\\THE PHOENIX\\NewKet\\frontend';

const findFiles = (dir) => {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('dist')) {
      results = results.concat(findFiles(filePath));
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
};

const allFiles = findFiles(frontendRoot);

let totalChanged = 0;

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const initialContent = content;

  content = content.replace(/href=["']\.\.\/manifest\.json["']/g, 'href="/manifest.json"');
  content = content.replace(/href=["']manifest\.json["']/g, 'href="/manifest.json"');

  content = content.replace(/href=["']\.\.\/index\.html["']/g, 'href="/"');
  content = content.replace(/href=["']index\.html["']/g, 'href="/"');

  content = content.replace(/href=["']\/src\/pages\/([^"']+)["']/g, 'href="/pages/$1"');

  // Fix index.html relative link in JS template literals like mobile-nav.html which are fetched using innerHTML
  // Or in actual HTML files.
  content = content.replace(/src=["']Images\/default\.png["']/g, 'src="../assets/Images/default.png"');

  if (content !== initialContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file.replace(frontendRoot, '')}`);
    totalChanged++;
  }
});

console.log(`Fixed links in ${totalChanged} files.`);
