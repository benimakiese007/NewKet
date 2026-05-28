import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';

const BACKEND_DIR = fileURLToPath(new URL('../backend/', import.meta.url));
const FRONTEND_DIR = fileURLToPath(new URL('../frontend/', import.meta.url));

const FRONTEND_HEALTH = 'http://localhost:5173/@vite/client';
const BACKEND_HEALTH = 'http://localhost:3000/api/health';

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function isUp(url, timeoutMs = 750) {
  return await new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port,
          path: `${parsed.pathname}${parsed.search}`,
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        (res) => {
          res.resume();
          done(res.statusCode >= 200 && res.statusCode < 400);
        }
      );

      req.on('error', () => done(false));
      req.setTimeout(timeoutMs, () => {
        try {
          req.destroy();
        } catch {
          // ignore
        }
        done(false);
      });
      req.end();
    } catch {
      done(false);
    }
  });
}

function runNpmScript({ name, cwd, extraArgs = [] }) {
  const npmCmd = getNpmCommand();
  const child = spawn(npmCmd, ['run', name, ...extraArgs], {
    cwd,
    stdio: 'inherit',
    shell: false,
  });
  return child;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--check')) {
    const [frontendOk, backendOk] = await Promise.all([
      isUp(FRONTEND_HEALTH, 500),
      isUp(BACKEND_HEALTH, 500),
    ]);
    console.log(JSON.stringify({ frontendOk, backendOk }));
    process.exit(frontendOk && backendOk ? 0 : 1);
  }

  const backendAlreadyUp = await isUp(BACKEND_HEALTH, 500);
  const frontendAlreadyUp = await isUp(FRONTEND_HEALTH, 500);

  /** @type {import('node:child_process').ChildProcess[]} */
  const children = [];

  if (!backendAlreadyUp) {
    children.push(runNpmScript({ name: 'dev', cwd: BACKEND_DIR }));
  } else {
    console.log(`[dev] Backend already running (${BACKEND_HEALTH})`);
  }

  if (!frontendAlreadyUp) {
    children.push(runNpmScript({ name: 'dev', cwd: FRONTEND_DIR }));
  } else {
    console.log(`[dev] Frontend already running (${FRONTEND_HEALTH})`);
  }

  const shutdown = (signal) => {
    for (const child of children) {
      try {
        child.kill(signal);
      } catch {
        // ignore
      }
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  for (const child of children) {
    child.on('exit', (code) => {
      if (typeof code === 'number' && code !== 0) {
        process.exitCode = code;
      }
    });
  }

  // Keep parent alive while children run.
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[dev] Failed to start dev servers:', err);
  process.exit(1);
});
