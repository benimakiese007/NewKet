const fs = require('fs');
const glob = require('glob');

async function checkIds(pattern) {
    const files = require('glob').sync(pattern);
    files.forEach(f => {
      try {
        const c = fs.readFileSync(f, 'utf8');
        const formRegex = /<form[\s\S]*?<\/form>/gi;
        let fm;
        while((fm = formRegex.exec(c)) !== null) {
          const formContent = fm[0];
          const tagRegex = /<(input|select|textarea|button)[^>]*>/gi;
          let tm;
          const ids = {};
          while((tm = tagRegex.exec(formContent)) !== null) {
            const tag = tm[0];
            const matchSingle = tag.match(/id='([^']+)'/i);
            const matchDouble = tag.match(/id="([^"]+)"/i);
            
            if (matchSingle || matchDouble) {
                let id = matchSingle ? matchSingle[1] : matchDouble[1];
                ids[id] = (ids[id] || 0) + 1;
            }
          }
          const dups = Object.entries(ids).filter(([k,v]) => v > 1);
          if (dups.length > 0) {
            console.log('--- ' + f + ' ---');
            dups.forEach(([k,v]) => console.log('Duplicate ID inside same form:', k, '(', v, 'times)'));
          }
        }
      } catch(e){}
    });
}
checkIds('**/*.html');
checkIds('**/*.js');
