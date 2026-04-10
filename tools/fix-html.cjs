const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const srcDir = path.join(baseDir, 'src');

const filesToUpdate = [];

function findHtmlFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        if (item === 'node_modules' || item === 'dist' || item === '.git') continue;
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findHtmlFiles(fullPath);
        } else if (fullPath.endsWith('.html')) {
            filesToUpdate.push(fullPath);
        }
    }
}

findHtmlFiles(baseDir);

const bundleServices = [
    'supabase-client.js',
    'supabase-adapter.js',
    'auth.js',
    'cart.js',
    'favorites.js',
    'currency.js',
    'products.js',
    'orders.js',
    'managers.js',
    'ui-helpers.js',
    'ui.js',
    'search.js',
    'components-loader.js',
    'realtime-notifications.js',
    'main.js',
    'theme.js'
];

const specificServices = [
    'admin-layout.js',
    'config-manager.js',
    'forum.js',
    'newsletter.js'
];

let updatedCount = 0;

for (const file of filesToUpdate) {
    let content = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    const relativePathFromBase = path.relative(baseDir, file);

    // Calculate relative path to services
    let servicesPath;
    if (dir === baseDir) {
        servicesPath = './src/services';
    } else {
        const relativeFromSrc = path.relative(srcDir, dir);
        if (relativeFromSrc === '') {
            servicesPath = './services';
        } else {
            const depth = relativeFromSrc.split(path.sep).filter(p => p !== '' && p !== '.').length;
            servicesPath = '../'.repeat(depth) + 'services';
        }
    }

    // Calculate relative path to assets/css
    let cssPath;
    if (dir === baseDir) {
        cssPath = './src/assets/css/input.css';
    } else {
        const relativeFromSrc = path.relative(srcDir, dir);
        if (relativeFromSrc === '') {
            cssPath = './assets/css/input.css';
        } else {
            const depth = relativeFromSrc.split(path.sep).filter(p => p !== '' && p !== '.').length;
            cssPath = '../'.repeat(depth) + 'assets/css/input.css';
        }
    }

    let hasChanged = false;

    // 1. Fix CSS absolute path
    if (content.includes('href="/src/input.css"')) {
        content = content.replace(/href="\/src\/input\.css"/g, `href="${cssPath}"`);
        hasChanged = true;
    }

    // 2. Fix page links to be relative
    const relativeFromSrc = path.relative(srcDir, dir);
    if (relativeFromSrc.startsWith('pages')) {
        if (content.includes('href="/src/pages/')) {
            content = content.replace(/href="\/src\/pages\//g, 'href="./');
            hasChanged = true;
        }
    } else if (dir === baseDir) {
        if (content.includes('href="/src/pages/')) {
            content = content.replace(/href="\/src\/pages\//g, 'href="./src/pages/');
            hasChanged = true;
        }
    }

    // 3. Bundling scripts: deduplicate and use app.js
    const lines = content.split('\n');
    let newLines = [];
    let insertedAppJs = false;
    let scriptsChanged = false;

    for (let line of lines) {
        let skipLine = false;
        const lowerLine = line.toLowerCase();

        // Already has app.js? (make sure path is correct)
        if (lowerLine.includes('script') && lowerLine.includes('app.js')) {
            const spaces = line.match(/^\s*/)[0];
            newLines.push(`${spaces}<script type="module" src="${servicesPath}/app.js"></script>`);
            insertedAppJs = true;
            scriptsChanged = true;
            continue;
        }

        // Check if it's a bundle service
        for (const serv of bundleServices) {
            if (lowerLine.includes('script') && lowerLine.includes(serv)) {
                if (!insertedAppJs) {
                    const spaces = line.match(/^\s*/)[0];
                    newLines.push(`${spaces}<script type="module" src="${servicesPath}/app.js"></script>`);
                    insertedAppJs = true;
                }
                skipLine = true;
                scriptsChanged = true;
                break;
            }
        }
        if (skipLine) continue;

        // Check for specific services
        let fixedSpecific = false;
        for (const serv of specificServices) {
            if (lowerLine.includes('script') && lowerLine.includes(serv)) {
                const spaces = line.match(/^\s*/)[0];
                newLines.push(`${spaces}<script type="module" src="${servicesPath}/${serv}"></script>`);
                fixedSpecific = true;
                scriptsChanged = true;
                break;
            }
        }
        if (fixedSpecific) continue;

        // Lazy loading images
        if (line.includes('<img ') && !line.includes('loading=')) {
            line = line.replace('<img ', '<img loading="lazy" ');
            scriptsChanged = true;
        }

        newLines.push(line);
    }

    if (scriptsChanged || hasChanged) {
        fs.writeFileSync(file, newLines.join('\n'));
        console.log(`Updated ${relativePathFromBase}`);
        updatedCount++;
    }
}

console.log(`Finished. Updated ${updatedCount} files.`);
