const fs = require('fs');

const file = 'pages/login.html';
const content = fs.readFileSync(file, 'utf8');

const regex = /id=["']([^"']+)["']/g;
const ids = {};
let m;
while ((m = regex.exec(content)) !== null) {
  const id = m[1];
  ids[id] = (ids[id] || 0) + 1;
}

Object.entries(ids).filter(([k,v]) => v > 1).forEach(([k,v]) => {
  console.log('DUPLICATE:', k, v);
});
