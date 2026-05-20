import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');
const backendDir = path.resolve(repoRoot, 'backend');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const procs = [];

function start(label, cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env },
  });
  procs.push(child);
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (typeof code === 'number' && code !== 0) {
      console.error(`[dev:full] ${label} exited with code ${code}`);
    }
  });
  return child;
}

function shutdown() {
  for (const p of procs) {
    try {
      if (!p.killed) p.kill('SIGINT');
    } catch {}
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

console.log('[dev:full] Starting backend + frontend…');
start('backend', npmCmd, ['run', 'dev'], backendDir);
start('frontend', npmCmd, ['run', 'dev'], frontendDir);

