const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const pagesDir = path.join(frontendDir, 'src', 'pages');
const partialsDir = path.join(frontendDir, 'src', 'partials');
const cssDir = path.join(frontendDir, 'src', 'assets', 'css');

function getAllFiles(dir, exts = ['.html', '.js', '.css']) {
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
  ...getAllFiles(partialsDir, ['.html']),
  path.join(frontendDir, 'index.html'),
  path.join(frontendDir, '404.html')
];

const report = {
  mojibake: [],
  viewportIssues: [],
  hardcodedOverflowWidths: [],
  brokenLinksOrAssets: [],
  darkModeInconsistencies: [],
  zindexIssues: [],
  buttonTouchTargetOrAria: [],
  cssSyntaxOrUnmatched: []
};

// Check HTML files
htmlFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(rootDir, file).replace(/\\/g, '/');

  // 1. Mojibake / encoding errors
  const mojibakeRegex = /(Ã©|Ã |Ã¨|Ã´|â€™|âš|âœ|Ãª|Ã§|Ã¹|Ã®|Ã»|Ã¢)/g;
  let m;
  let mojibakeCount = 0;
  while ((m = mojibakeRegex.exec(content)) !== null) {
    mojibakeCount++;
  }
  if (mojibakeCount > 0) {
    report.mojibake.push({ file: rel, count: mojibakeCount });
  }

  // 2. Viewport check (pages only)
  if (!file.includes('partials') && !content.includes('viewport') && !content.includes('header-placeholder')) {
    report.viewportIssues.push({ file: rel, issue: 'Missing viewport tag' });
  }

  // 3. Overflow risks: large fixed inline styles or fixed Tailwind widths without responsive wrapper
  const fixedWidthMatch = content.match(/style=\"[^\"]*width:\s*([4-9]\d{2,}|[1-9]\d{3,})px[^\"]*\"/g);
  if (fixedWidthMatch) {
    report.hardcodedOverflowWidths.push({ file: rel, fixedInlineWidths: fixedWidthMatch });
  }

  // 4. Broken asset references (e.g. href or src pointing to non-existent local files)
  const srcRegex = /(?:src|href)=["'](\/(?:assets|images|img|css|js)\/[^"']+)["']/g;
  let srcM;
  while ((srcM = srcRegex.exec(content)) !== null) {
    const assetUrl = srcM[1].split('?')[0].split('#')[0];
    const publicPath = path.join(frontendDir, 'public', assetUrl);
    const srcPath = path.join(frontendDir, 'src', assetUrl);
    const rootPublicPath = path.join(rootDir, 'public', assetUrl);
    if (!fs.existsSync(publicPath) && !fs.existsSync(srcPath) && !fs.existsSync(rootPublicPath)) {
      // ignore dynamic templates or api
      if (!assetUrl.includes('${') && !assetUrl.includes('{{')) {
        report.brokenLinksOrAssets.push({ file: rel, brokenPath: assetUrl });
      }
    }
  }

  // 5. Dark mode: heavy contrasts where text is dark but container has no dark bg, or hardcoded dark text
  const hardcodedLightCards = content.match(/class=\"[^\"]*(?:bg-white|bg-gray-50|bg-slate-50)[^\"]*\"/g);
  if (hardcodedLightCards) {
    let missingDark = 0;
    hardcodedLightCards.forEach(cls => {
      if (!cls.includes('dark:bg-')) missingDark++;
    });
    if (missingDark > 5) {
      report.darkModeInconsistencies.push({ file: rel, missingDarkBgCount: missingDark });
    }
  }

  // 6. High Z-Index clashes (> 99999 or 9999 without scale)
  const zClash = content.match(/z-\[(\d+)\]/g);
  if (zClash) {
    const hugeZ = zClash.filter(z => {
      const num = parseInt(z.replace(/\D/g, ''), 10);
      return num >= 9999;
    });
    if (hugeZ.length > 0) {
      report.zindexIssues.push({ file: rel, zIndexes: [...new Set(hugeZ)] });
    }
  }
});

// CSS Audit
const cssFiles = getAllFiles(cssDir, ['.css']);
cssFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(rootDir, file).replace(/\\/g, '/');

  // Check for duplicate @keyframes or broken braces
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    report.cssSyntaxOrUnmatched.push({ file: rel, error: `Mismatched braces: ${openBraces} { vs ${closeBraces} }` });
  }
});

console.log(JSON.stringify(report, null, 2));
