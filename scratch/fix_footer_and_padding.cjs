/**
 * fix_footer_and_padding.cjs
 * 1. Ajoute <div id="footer-placeholder"> avant </body> si absent
 * 2. Ajoute pb-24 au wrapper <main> si absent (mobile bottom nav padding)
 */

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'frontend', 'src', 'pages');

// Pages qui ont besoin du footer-placeholder (les dashboards/error pages sont exclues)
const footerTargets = [
  'catalog.html',
  'favorites.html',
  'invoice-verify.html',
  'lens.html',
  'notifications.html',
  'payment-cancel.html',
  'payment-success.html',
  'product.html',
  'promo.html',
  'settings.html',
  'shop.html',
  'shops.html',
  'support.html',
  'system-health.html',
  'achat.html',
];

// Pages qui ont besoin de pb-24 sur leur <main> ou wrapper principal
// (toutes les pages avec nav mobile en bas)
const paddingTargets = [
  'catalog.html',
  'favorites.html',
  'invoice-verify.html',
  'kinshasa.html',
  'lens.html',
  'notifications.html',
  'payment-cancel.html',
  'payment-success.html',
  'product.html',
  'publish.html',
  'seller-onboarding.html',
  'settings.html',
  'shop.html',
  'shops.html',
  'system-health.html',
  'index.html',
  'achat.html',
];

let footerAdded = [];
let footerSkipped = [];
let paddingAdded = [];
let paddingSkipped = [];
let errors = [];

// ── STEP 1: Footer placeholder ────────────────────────────────────────────────
console.log('\n=== STEP 1: Footer placeholders ===');
for (const file of footerTargets) {
  const filePath = path.join(pagesDir, file);
  if (!fs.existsSync(filePath)) {
    errors.push(`NOT FOUND: ${file}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('footer-placeholder')) {
    footerSkipped.push(file);
    console.log(`  SKIP (already has footer-placeholder): ${file}`);
    continue;
  }
  if (!content.includes('</body>')) {
    errors.push(`NO </body> TAG: ${file}`);
    continue;
  }
  // Insert before </body>
  content = content.replace('</body>', '  <div id="footer-placeholder"></div>\n</body>');
  fs.writeFileSync(filePath, content, 'utf8');
  footerAdded.push(file);
  console.log(`  ✓ Added footer-placeholder: ${file}`);
}

// ── STEP 2: Mobile bottom padding (pb-24) ─────────────────────────────────────
console.log('\n=== STEP 2: Mobile bottom padding (pb-24) ===');
for (const file of paddingTargets) {
  const filePath = path.join(pagesDir, file);
  if (!fs.existsSync(filePath)) {
    errors.push(`NOT FOUND: ${file}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  if (/\bpb-24\b/.test(content) || /\bpb-safe\b/.test(content)) {
    paddingSkipped.push(file);
    console.log(`  SKIP (already has pb-24/pb-safe): ${file}`);
    continue;
  }

  // Strategy: add pb-24 to the first <main class="..." or <main> tag
  // If no <main>, add to the first <div id="main-content"... or <div class="container"...
  let modified = false;

  // Try <main ...> first
  const mainTagMatch = content.match(/<main([^>]*)>/);
  if (mainTagMatch) {
    const originalTag = mainTagMatch[0];
    const attrs = mainTagMatch[1];
    let newTag;
    if (attrs.includes('class="')) {
      newTag = originalTag.replace('class="', 'class="pb-24 ');
    } else if (attrs.includes("class='")) {
      newTag = originalTag.replace("class='", "class='pb-24 ");
    } else {
      // No class attr — add one
      newTag = `<main${attrs} class="pb-24">`;
    }
    content = content.replace(originalTag, newTag);
    modified = true;
    fs.writeFileSync(filePath, content, 'utf8');
    paddingAdded.push(file + ' (on <main>)');
    console.log(`  ✓ Added pb-24 on <main>: ${file}`);
    continue;
  }

  // No <main> — try id="main-content"
  const mainDivMatch = content.match(/<div([^>]*?)id="main-content"([^>]*)>/);
  if (mainDivMatch) {
    const originalTag = mainDivMatch[0];
    let newTag;
    if (originalTag.includes('class="')) {
      newTag = originalTag.replace('class="', 'class="pb-24 ');
    } else if (originalTag.includes("class='")) {
      newTag = originalTag.replace("class='", "class='pb-24 ");
    } else {
      newTag = originalTag.replace('>', ' class="pb-24">');
    }
    content = content.replace(originalTag, newTag);
    fs.writeFileSync(filePath, content, 'utf8');
    paddingAdded.push(file + ' (on #main-content)');
    console.log(`  ✓ Added pb-24 on #main-content div: ${file}`);
    continue;
  }

  // Fallback: try first <div class="container..."> or <div class="max-w-...">
  const containerMatch = content.match(/<div class="(container|max-w-[^"]*(?:mx-auto)[^"]*)"([^>]*)>/);
  if (containerMatch) {
    const originalTag = containerMatch[0];
    const newTag = originalTag.replace('class="', 'class="pb-24 ');
    content = content.replace(originalTag, newTag);
    fs.writeFileSync(filePath, content, 'utf8');
    paddingAdded.push(file + ' (on container div)');
    console.log(`  ✓ Added pb-24 on container div: ${file}`);
    continue;
  }

  paddingSkipped.push(file + ' — no suitable wrapper found (MANUAL REVIEW NEEDED)');
  console.log(`  ⚠ No suitable wrapper found: ${file} — needs manual review`);
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Footer added   : ${footerAdded.length} files`);
footerAdded.forEach(f => console.log(`  + ${f}`));
console.log(`Footer skipped : ${footerSkipped.length} files (already had it)`);
console.log(`Padding added  : ${paddingAdded.length} files`);
paddingAdded.forEach(f => console.log(`  + ${f}`));
console.log(`Padding skipped: ${paddingSkipped.length} files`);
paddingSkipped.forEach(f => console.log(`  ~ ${f}`));
if (errors.length) {
  console.log(`Errors         : ${errors.length}`);
  errors.forEach(e => console.log(`  ✗ ${e}`));
}
console.log('========================================\n');
