import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pagesDir = path.join(__dirname, 'src', 'pages');
const rootDir = __dirname; // frontend

const htmlFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
const brokenLinks = [];

htmlFiles.forEach(file => {
    const filePath = path.join(pagesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find href="..."
    const hrefMatches = [...content.matchAll(/href="([^"]+)"/g)];
    hrefMatches.forEach(match => {
        let link = match[1];
        if (link.startsWith('http') || link.startsWith('#') || link.startsWith('mailto:')) return;
        
        // Remove query strings and hashes
        link = link.split('?')[0].split('#')[0];
        if (!link) return;
        
        let absolutePath;
        if (link.startsWith('/')) {
            absolutePath = path.join(rootDir, link);
        } else {
            absolutePath = path.resolve(path.dirname(filePath), link);
        }
        
        if (!fs.existsSync(absolutePath)) {
            brokenLinks.push({ file, link, type: 'href', resolved: absolutePath });
        }
    });
    
    // Find src="..."
    const srcMatches = [...content.matchAll(/src="([^"]+)"/g)];
    srcMatches.forEach(match => {
        let link = match[1];
        if (link.startsWith('http') || link.startsWith('//')) return;
        
        link = link.split('?')[0].split('#')[0];
        if (!link) return;
        
        let absolutePath;
        if (link.startsWith('/')) {
            absolutePath = path.join(rootDir, link);
        } else {
            absolutePath = path.resolve(path.dirname(filePath), link);
        }
        
        if (!fs.existsSync(absolutePath)) {
            brokenLinks.push({ file, link, type: 'src', resolved: absolutePath });
        }
    });
});

console.log(`Found ${brokenLinks.length} broken links:`);
brokenLinks.forEach(b => console.log(`[${b.file}] ${b.type} -> ${b.link}`));
