import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, 'src', 'services');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
let totalCleaned = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    const lines = content.split('\n');
    const cleaned = lines.filter(line => {
        if (line.trim().startsWith('//')) return true; // keep comments
        if (!line.includes('console.log')) return true;
        
        // Remove known debug logs
        const lower = line.toLowerCase();
        if (lower.includes('[newket') || lower.includes('[usermanager]') || lower.includes('auth state change')) {
            return false;
        }
        return true;
    });
    
    const newContent = cleaned.join('\n');
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Cleaned ${file}`);
        totalCleaned++;
    }
});

console.log(`Successfully cleaned ${totalCleaned} files.`);
