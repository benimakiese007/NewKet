import net from 'node:net';
import http from 'node:http';
import { exec, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.resolve(ROOT_DIR, 'frontend');
const BACKEND_DIR = path.resolve(ROOT_DIR, 'backend');

const FRONT_PORT = 5173;
const BACK_PORT = 3000;
const FRONT_URL = `http://localhost:${FRONT_PORT}`;
const BACK_URL = `http://localhost:${BACK_PORT}`;

/**
 * Verifie rapidement si un port TCP est ouvert
 */
function isPortInUse(port, host = '127.0.0.1', timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      status = true;
      socket.destroy();
    });

    socket.once('timeout', () => {
      socket.destroy();
    });

    socket.once('error', () => {
      // Port ferme ou refuse
    });

    socket.once('close', () => {
      resolve(status);
    });

    socket.connect(port, host);
  });
}

/**
 * Ouvre une URL dans le navigateur par defaut de l'utilisateur
 */
function openBrowser(url) {
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`, { shell: 'cmd.exe' });
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

/**
 * Lance le Frontend dans une fenetre Windows dediee
 */
function launchFrontendWindow() {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'NewKet - Frontend (Vite:5173)', 'cmd.exe', '/k', 'npm run dev'], {
      cwd: FRONTEND_DIR,
      stdio: 'ignore',
      shell: false,
      detached: true,
    }).unref();
  } else {
    spawn('npm', ['run', 'dev'], { cwd: FRONTEND_DIR, stdio: 'inherit', detached: true }).unref();
  }
}

/**
 * Lance le Backend dans une fenetre Windows dediee
 */
function launchBackendWindow() {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'NewKet - Backend (API:3000)', 'cmd.exe', '/k', 'npm run dev'], {
      cwd: BACKEND_DIR,
      stdio: 'ignore',
      shell: false,
      detached: true,
    }).unref();
  } else {
    spawn('npm', ['run', 'dev'], { cwd: BACKEND_DIR, stdio: 'inherit', detached: true }).unref();
  }
}

/**
 * Tue un port sur Windows en recuperant son PID via netstat
 */
function killPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      exec(`fuser -k ${port}/tcp`, () => resolve());
      return;
    }

    exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
        return;
      }

      const lines = stdout.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            pids.add(pid);
          }
        }
      }

      if (pids.size === 0) {
        resolve(false);
        return;
      }

      let killedCount = 0;
      for (const pid of pids) {
        exec(`taskkill /F /PID ${pid}`, () => {
          killedCount++;
          if (killedCount === pids.size) {
            resolve(true);
          }
        });
      }
    });
  });
}

async function handleFront() {
  console.log('==================================================');
  console.log('       SERVEUR FRONTEND - NEWKET (Vite)');
  console.log('==================================================\n');

  process.stdout.write('   Verification du port 5173... ');
  const isUp = await isPortInUse(FRONT_PORT);

  if (isUp) {
    console.log('[ EN LIGNE ]');
    console.log('\n   [✓] Le Frontend tourne DEJA sur : ' + FRONT_URL);
    console.log('   [i] Aucun doublon ne sera lance.');
    console.log('   [>] Affichage dans votre navigateur...');
    openBrowser(FRONT_URL);
  } else {
    console.log('[ INACTIF ]');
    console.log('\n   [+] Demarrage du Frontend dans une nouvelle fenetre...');
    console.log('   [+] URL cible : ' + FRONT_URL);
    launchFrontendWindow();
    console.log('   [✓] Fenetre lancee avec succes.');
    console.log('   [>] Ouverture du navigateur dans quelques instants...');
    setTimeout(() => openBrowser(FRONT_URL), 2000);
  }

  console.log('\n==================================================');
  console.log('   Appuyez sur une touche pour revenir au menu...');
}

async function handleBack() {
  console.log('==================================================');
  console.log('       SERVEUR BACKEND - NEWKET (API Express)');
  console.log('==================================================\n');

  process.stdout.write('   Verification du port 3000... ');
  const isUp = await isPortInUse(BACK_PORT);

  if (isUp) {
    console.log('[ EN LIGNE ]');
    console.log('\n   [✓] Le Backend tourne DEJA sur : ' + BACK_URL);
    console.log('   [i] Aucun doublon ne sera lance.');
    console.log('   [✓] API active et operationnelle.');
  } else {
    console.log('[ INACTIF ]');
    console.log('\n   [+] Demarrage du Backend dans une nouvelle fenetre...');
    console.log('   [+] URL cible : ' + BACK_URL);
    launchBackendWindow();
    console.log('   [✓] Fenetre du backend lancee avec succes.');
  }

  console.log('\n==================================================');
  console.log('   Appuyez sur une touche pour revenir au menu...');
}

async function handleAll() {
  console.log('==================================================');
  console.log('       FULLSTACK NEWKET - FRONTEND + BACKEND');
  console.log('==================================================\n');

  process.stdout.write('   [1/2] Test du Backend (port 3000)...  ');
  const backUp = await isPortInUse(BACK_PORT);
  console.log(backUp ? '[ DEJA EN LIGNE ]' : '[ A DEMARRER ]');

  process.stdout.write('   [2/2] Test du Frontend (port 5173)... ');
  const frontUp = await isPortInUse(FRONT_PORT);
  console.log(frontUp ? '[ DEJA EN LIGNE ]' : '[ A DEMARRER ]');

  console.log('');

  // Gestion intelligente
  if (backUp && frontUp) {
    console.log('   [✓] Les DEUX serveurs tournent DEJA !');
    console.log('   [i] Aucun doublon inutile ne sera allume.');
    console.log('   [>] Affichage de NewKet dans le navigateur...');
    openBrowser(FRONT_URL);
  } else {
    if (!backUp) {
      console.log('   [+] Lancement du Backend dans une fenetre dediee...');
      launchBackendWindow();
    } else {
      console.log('   [✓] Backend deja operationnel.');
    }

    if (!frontUp) {
      console.log('   [+] Lancement du Frontend dans une fenetre dediee...');
      launchFrontendWindow();
    } else {
      console.log('   [✓] Frontend deja operationnel.');
    }

    console.log('\n   [>] Ouverture de NewKet dans votre navigateur...');
    setTimeout(() => openBrowser(FRONT_URL), 2500);
  }

  console.log('\n==================================================');
  console.log('   Appuyez sur une touche pour revenir au menu...');
}

async function handleStatus() {
  console.log('==================================================');
  console.log('          ETAT DES SERVEURS NEWKET');
  console.log('==================================================\n');

  const [frontUp, backUp] = await Promise.all([
    isPortInUse(FRONT_PORT),
    isPortInUse(BACK_PORT),
  ]);

  console.log(`   Frontend (Vite)    :  Port ${FRONT_PORT}  ->  ` + (frontUp ? '[ EN LIGNE  -  ' + FRONT_URL + ' ]' : '[ ARRETE ]'));
  console.log(`   Backend  (Express) :  Port ${BACK_PORT}  ->  ` + (backUp ? '[ EN LIGNE  -  ' + BACK_URL + ' ]' : '[ ARRETE ]'));

  console.log('\n==================================================');
  console.log('   Appuyez sur une touche pour revenir au menu...');
}

async function handleStop() {
  console.log('==================================================');
  console.log('       ARRET & LIBERATION DES PORTS NEWKET');
  console.log('==================================================\n');

  process.stdout.write('   Arret des processus sur le port 5173 (Frontend)... ');
  const killedFront = await killPort(FRONT_PORT);
  console.log(killedFront ? '[ LIBERE ]' : '[ ETAIT DEJA LIBRE ]');

  process.stdout.write('   Arret des processus sur le port 3000 (Backend)...  ');
  const killedBack = await killPort(BACK_PORT);
  console.log(killedBack ? '[ LIBERE ]' : '[ ETAIT DEJA LIBRE ]');

  console.log('\n   [✓] Nettoyage termine.');
  console.log('\n==================================================');
  console.log('   Appuyez sur une touche pour revenir au menu...');
}

async function main() {
  const arg = process.argv[2] || '--status';

  switch (arg) {
    case '--front':
      await handleFront();
      break;
    case '--back':
      await handleBack();
      break;
    case '--all':
      await handleAll();
      break;
    case '--status':
      await handleStatus();
      break;
    case '--stop':
      await handleStop();
      break;
    default:
      console.log(`Usage: node server-launcher.mjs [--front|--back|--all|--status|--stop]`);
      break;
  }
}

main().catch((err) => {
  console.error('Erreur:', err);
  process.exit(1);
});
