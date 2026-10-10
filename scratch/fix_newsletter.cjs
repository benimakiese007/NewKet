const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../frontend/src/pages/admin/newsletter.html');
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
  ['GÃ©rez les abonnÃ©s', 'Gérez les abonnés'],
  ['Total abonnÃ©s', 'Total abonnés'],
  ['DÃ©sabonnÃ©s', 'Désabonnés'],
  ['Liste des abonnÃ©s', 'Liste des abonnés'],
  ['DÃ©sabonner', 'Désabonner'],
  ['DÃ©sabonné', 'Désabonné'],
  ['DÃ©sabonnÃ©', 'Désabonné'],
  ['DÃ©tail', 'Détail'],
  ['Ã‰chec', 'Échec'],
  ['synchronisÃ©', 'synchronisé'],
  ['rÃ©ussi', 'réussi'],
  ['rÃ©cupÃ©ration', 'récupération'],
  ['abonnÃ© Ã\xa0 exporter', 'abonné à exporter'],
  ['abonnÃ© Ã  exporter', 'abonné à exporter'],
  ['abonnÃ©s', 'abonnés'],
  ['abonnÃ©', 'abonné'],
  ['Statut / ValiditÃ©', 'Statut / Validité'],
  ['DÃ©sabonner ce contact', 'Désabonner ce contact'],
  ['Ã ', 'à '],
  ['Ã©', 'é'],
  ['Ã¨', 'è'],
  ['Ãª', 'ê'],
  ['Ã§', 'ç'],
  ['Ã¹', 'ù'],
  ['Ã®', 'î'],
  ['Ã´', 'ô'],
  ['Ã»', 'û'],
  ['â€™', "'"],
  ['â€œ', '"'],
  ['â€', '"']
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Newsletter encoding successfully fixed!');
