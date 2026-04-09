const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const regex = /id=["']([^"']+)["']/g;
const ids = {};
let m;
while ((m = regex.exec(content)) !== null) {
  ids[m[1]] = (ids[m[1]] || 0) + 1;
}

const dups = Object.entries(ids).filter(([k,v]) => v > 1);
if (dups.length > 0) {
  console.log('--- index.html ---');
  dups.forEach(([k,v]) => console.log(k, v));
}
