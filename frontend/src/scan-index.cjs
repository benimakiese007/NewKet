const fs = require('fs');
const c = fs.readFileSync('index.html', 'utf8');
const m = [...c.matchAll(/\bid="([^"]+)"/g)];
const map = {};
m.forEach(x => { map[x[1]] = (map[x[1]] || 0) + 1; });
console.log('All IDs in index.html:');
Object.entries(map).forEach(([k, v]) => console.log((v > 1 ? 'DUPLICATE: ' : '  ') + k + ' x' + v));
