const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const pagesDir = path.join(frontendDir, 'src', 'pages');
const partialsDir = path.join(frontendDir, 'src', 'partials');

function getAllFiles(dir, exts = ['.html']) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(full, exts));
    } else if (exts.some(ext => item.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

const htmlFiles = [
  ...getAllFiles(pagesDir, ['.html']),
  path.join(frontendDir, 'index.html'),
  path.join(frontendDir, '404.html')
];

const results = {
  mobileBottomNavOverlap: [],
  tablesWithoutScrollWrapper: [],
  brokenOrInconsistentHeaders: [],
  inputsWithoutLabelsOrAria: [],
  unresponsiveFlexRows: [],
  arbitraryZIndexes: [],
  mojibakeOccurrences: []
};

htmlFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(rootDir, file).replace(/\\/g, '/');
  const isAdmin = rel.includes('/admin/');

  // 1. Mobile Bottom Nav overlap check:
  // Non-admin pages on mobile usually have fixed bottom bar; check if body/main has pb-16/pb-20/pb-24
  if (!isAdmin && !rel.includes('404') && !rel.includes('500') && !rel.includes('choose-role')) {
    const hasBottomPadding = /class=\"[^\"]*(?:pb-(?:16|20|24|28|32)|padding-bottom)[^\"]*\"/.test(content);
    if (!hasBottomPadding && !content.includes('header-minimal')) {
      results.mobileBottomNavOverlap.push({
        file: rel,
        warning: 'Page might miss bottom padding (pb-20/pb-24) to prevent content being covered by mobile bottom navigation bar.'
      });
    }
  }

  // 2. Tables without overflow wrapper
  const tableMatches = content.match(/<table[\s\S]*?<\/table>/g);
  if (tableMatches) {
    tableMatches.forEach(tbl => {
      // Check if inside overflow-x-auto
      const idx = content.indexOf(tbl);
      const preceding = content.substring(Math.max(0, idx - 300), idx);
      if (!preceding.includes('overflow-x-auto') && !preceding.includes('overflow-x-scroll')) {
        results.tablesWithoutScrollWrapper.push({
          file: rel,
          snippet: tbl.substring(0, 80) + '...'
        });
      }
    });
  }

  // 3. Header / Footer placeholder consistency
  if (!isAdmin && !rel.includes('choose-role') && !rel.includes('login') && !rel.includes('reset-password') && !rel.includes('seller-onboarding') && !rel.includes('publish')) {
    const hasHeader = content.includes('header-placeholder') || content.includes('<header');
    const hasFooter = content.includes('footer-placeholder') || content.includes('<footer');
    if (!hasHeader || !hasFooter) {
      results.brokenOrInconsistentHeaders.push({
        file: rel,
        hasHeader,
        hasFooter
      });
    }
  }

  // 4. Inputs without labels/aria
  const inputMatches = content.match(/<input(?![^>]*type=["'](?:hidden|checkbox|radio|submit|button)["'])[^>]*>/g);
  if (inputMatches) {
    let unlabelled = 0;
    inputMatches.forEach(inp => {
      if (!inp.includes('aria-label') && !inp.includes('placeholder') && !inp.includes('id=')) {
        unlabelled++;
      }
    });
    if (unlabelled > 0) {
      results.inputsWithoutLabelsOrAria.push({ file: rel, count: unlabelled });
    }
  }

  // 5. Arbitrary z-indexes
  const zMatches = content.match(/z-\[(\d+)\]/g);
  if (zMatches) {
    const unique = [...new Set(zMatches)];
    results.arbitraryZIndexes.push({ file: rel, zIndexes: unique });
  }

  // 6. Mojibake
  const mojibakeRegex = /(Ã©|Ã |Ã¨|Ã´|â€™|âš|âœ|Ãª|Ã§|Ã¹|Ã®|Ã»|Ã¢)/g;
  let mbCount = 0;
  while (mojibakeRegex.exec(content)) mbCount++;
  if (mbCount > 0) {
    results.mojibakeOccurrences.push({ file: rel, count: mbCount });
  }
});

console.log(JSON.stringify(results, null, 2));
