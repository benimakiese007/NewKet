import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const backendSrc = path.join(repoRoot, 'backend', 'src');
const apiBackendRoot = path.join(frontendRoot, 'api', '_backend');
const apiBackendSrc = path.join(apiBackendRoot, 'src');

if (!fs.existsSync(backendSrc)) {
  throw new Error(`Backend source folder not found: ${backendSrc}`);
}

fs.rmSync(apiBackendRoot, { recursive: true, force: true });
fs.mkdirSync(apiBackendRoot, { recursive: true });
fs.cpSync(backendSrc, apiBackendSrc, { recursive: true });

console.log(`[sync-backend-for-vercel] Copied ${backendSrc} -> ${apiBackendSrc}`);
