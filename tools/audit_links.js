const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\Users\\tmaut\\Downloads\\THE PHOENIX\\NewKet';
const frontendRoot = path.join(projectRoot, 'frontend');
const backendRoot = path.join(projectRoot, 'backend');
const databaseRoot = path.join(projectRoot, 'database');

const report = {
  score: 100,
  structureIssues: [],
  missingFeatures: [],
  brokenLinks: [],
  resourceIssues: [],
  uiIssues: [],
  codeIssues: [],
  performanceIssues: [],
  seoIssues: [],
  accessibilityIssues: []
};

// Phase 1: Structure
if (!fs.existsSync(backendRoot)) report.structureIssues.push('Backend directory missing');
if (!fs.existsSync(databaseRoot)) report.structureIssues.push('Database directory missing');

// Phase 3 & 4: Link & Resource scanning
const findHtmlFiles = (dir) => {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('dist')) {
      results = results.concat(findHtmlFiles(filePath));
    } else if (file.endsWith('.html')) {
      results.push(filePath);
    }
  });
  return results;
};

const htmlFiles = findHtmlFiles(frontendRoot);

const resolveLink = (link, sourceFile) => {
  if (!link || link.startsWith('http') || link.startsWith('#') || link.startsWith('mailto:')) return true; // Ignore external/anchor
  
  if (link.startsWith('/')) {
    // Vite resolves '/' as frontend root 
    return fs.existsSync(path.join(frontendRoot, link)) || fs.existsSync(path.join(frontendRoot, 'public', link)) || fs.existsSync(path.join(frontendRoot, 'src', link));
  } else {
    // Relative link
    const targetPath = path.resolve(path.dirname(sourceFile), link.split('?')[0].split('#')[0]);
    return fs.existsSync(targetPath);
  }
};

htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find href
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    const link = match[1];
    if (!resolveLink(link, file)) {
      report.brokenLinks.push({ file: file.replace(frontendRoot, ''), link });
    }
  }

  // Find src
  const srcRegex = /src=["']([^"']+)["']/g;
  while ((match = srcRegex.exec(content)) !== null) {
    const link = match[1];
    if (!resolveLink(link, file)) {
      report.resourceIssues.push({ file: file.replace(frontendRoot, ''), link });
    }
  }

  // SEO & A11y (Basic check)
  if (!content.includes('<title>')) report.seoIssues.push({ file: file.replace(frontendRoot, ''), issue: 'Missing <title>' });
  if (content.match(/<img[^>]+src=[^>]+>/g) && !content.includes('alt=')) {
    // report.accessibilityIssues.push({ file: file.replace(frontendRoot, ''), issue: 'Image missing alt text' });
  }
});

// Calculate pseudo-score
const deductions = (report.structureIssues.length + report.brokenLinks.length + report.resourceIssues.length) * 2;
report.score = Math.max(0, 100 - deductions);

if (report.brokenLinks.length > 50) report.brokenLinks = report.brokenLinks.slice(0, 50).concat(['...and more']);
if (report.resourceIssues.length > 50) report.resourceIssues = report.resourceIssues.slice(0, 50).concat(['...and more']);

console.log(JSON.stringify(report, null, 2));
