const fs = require('fs');
const files = [
  'services/components-loader.js',
  'pages/customer-dashboard.html',
  'pages/forum.html',
  'pages/login.html',
  'pages/publish.html',
  'pages/seller-onboarding.html',
  'pages/vendor-dashboard.html',
  'pages/admin/products.html',
  'pages/admin/promos.html',
  'pages/admin/settings.html'
];
files.forEach(f => {
  try {
    const c = fs.readFileSync(f, 'utf8');
    const formRegex = /<form[\s\S]*?<\/form>/gi;
    let fm;
    while((fm = formRegex.exec(c)) !== null) {
      const formContent = fm[0];
      const tagRegex = /<(input|select|textarea)[^>]*>/gi;
      let tm;
      const ids = {};
      while((tm = tagRegex.exec(formContent)) !== null) {
        const tag = tm[0];
        const matchSingle = tag.match(/id='([^']*)'/i);
        const matchDouble = tag.match(/id="([^"]*)"/i);
        let id = '<NO_ID>';
        if (matchSingle) id = matchSingle[1];
        else if (matchDouble) id = matchDouble[1];
        
        ids[id] = (ids[id] || 0) + 1;
      }
      const dups = Object.entries(ids).filter(([k,v]) => v > 1);
      if (dups.length > 0) {
        console.log('--- ' + f + ' ---');
        dups.forEach(([k,v]) => console.log('Duplicate:', k, '(', v, 'times)'));
      }
    }
  } catch(e){}
});
