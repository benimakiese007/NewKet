const fs = require('fs');
const path = require('path');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk(path.join(__dirname, 'pages'), function(err, results) {
  if (err) throw err;
  results.filter(f => f.endsWith('.html')).forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const regex = /id=["']([^"']+)["']/g;
    const ids = {};
    let m;
    while ((m = regex.exec(content)) !== null) {
      ids[m[1]] = (ids[m[1]] || 0) + 1;
    }
    const dups = Object.entries(ids).filter(([k,v]) => v > 1);
    if (dups.length > 0) {
      console.log('---', path.relative(__dirname, file), '---');
      dups.forEach(([k,v]) => console.log(k, v));
    }
  });
});
