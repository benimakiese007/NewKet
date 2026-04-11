const fs = require('fs');
const path = require('path');

const p = 'c:\\Users\\tmaut\\Downloads\\THE PHOENIX\\NewKet\\frontend\\src\\pages\\admin\\reviews.html';
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(/<title>Avis & \ufffdvaluations \| NewKet Admin<\/title>/, '<title>Avis & Évaluations | NewKet Admin</title>');
content = content.replace(/valuations \| NewKet Admin/, 'Évaluations | NewKet Admin');
fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed reviews.html');
