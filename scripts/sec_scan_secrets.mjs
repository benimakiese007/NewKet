/**
 * sec_scan_secrets.mjs
 * Scanner intelligent de secrets hardcodes.
 * Classe automatiquement les resultats en : REEL / INCERTAIN / FAUX POSITIF
 * N'affiche que les alertes reelles et incertaines.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

// ─── COULEURS CONSOLE ────────────────────────────────────────────────────────
const C = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

// ─── PATTERNS : VRAIS SECRETS (haute confiance) ──────────────────────────────
const REAL_SECRET_PATTERNS = [
  { name: 'Clé OpenAI',          regex: /sk-proj-[A-Za-z0-9_-]{20,}/ },
  { name: 'Clé OpenAI (legacy)', regex: /["']sk-[A-Za-z0-9]{40,}["']/ },
  { name: 'Clé Anthropic',       regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'Clé Google API',      regex: /AIzaSy[A-Za-z0-9_-]{33}/ },
  { name: 'Token GitHub',        regex: /ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}/ },
  { name: 'Token Slack',         regex: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Clé Stripe live',     regex: /pk_live_[A-Za-z0-9]{24,}|sk_live_[A-Za-z0-9]{24,}/ },
  { name: 'Clé AWS',             regex: /AKIA[A-Z0-9]{16}/ },
  { name: 'Clé SendGrid',        regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/ },
  { name: 'URL avec mot de passe', regex: /:\/\/[^:/"'\s]+:[^@/"'\s]{4,}@/ },
  { name: 'Mot de passe en dur', regex: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{6,}["']/ },
  { name: 'Clé Supabase service_role', regex: /service_role.*eyJ[A-Za-z0-9+/=]{50,}/ },
  { name: 'Clé Supabase secret',       regex: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: 'Token Supabase personal',   regex: /sbp_[A-Za-z0-9_-]{20,}/ },
];

// ─── PATTERNS : FAUX POSITIFS (exclure automatiquement) ─────────────────────
const FALSE_POSITIVE_PATTERNS = [
  /\$\{[^}]+\}/,              // Template literal  ${variable}
  /\.value\b/,                // Lecture DOM : input.value
  /getElementById/,           // Accès DOM
  /querySelector/,            // Accès DOM
  /autocomplete=/,            // Attribut HTML
  /type=["']password["']/,    // Input HTML
  /placeholder=/,             // Attribut HTML
  /import\.meta\.env/,        // Variable d'environnement Vite
  /process\.env\./,           // Variable d'environnement Node
  /window\.[A-Za-z]/,         // Objet window global
  /document\./,               // Objet document
  /\.addEventListener/,       // Event listener
  /\/\/.*(?:password|token|secret)/i,  // Commentaire avec mot-clé
  /class="[^"]*password/i,    // Classe CSS
  /id="[^"]*password/i,       // ID HTML
  /name="[^"]*password/i,     // Attribut name HTML
  /for="[^"]*password/i,      // Label HTML
  /function\s+\w*(?:password|Password)/,  // Nom de fonction
  /(?:new|current|confirm|forgot|update|change|reset|sync)\s*(?:Password|password)/,
  /(?:password|pwd|token)(?:Form|Group|Input|Btn|Feedback|Container|Strength|Hint|Manager|Field)/i,
  /mask-image/i,              // CSS mask-image (contient sk-)
  /\berrMsg\b|\berrmsg\b/,    // Variable errMsg (contient sg.)
  /supabase\.auth\./,         // Appel API Supabase dynamique
  /auth\.(signIn|signUp|updateUser|resetPassword)/i,
  /localStorage\.getItem/,    // Lecture localStorage
  /sessionStorage\.getItem/,  // Lecture sessionStorage
  /NKToken/i,                 // Token interne fidélité NewKet
  /nk_token/i,                // Token interne fidélité NewKet
  /Bearer \$\{/,              // Bearer dynamique
  /access_token\}/,           // access_token dans template literal
  /\.css:/,                   // Fichier CSS
  /\.png:|\.jpg:|\.jpeg:|\.gif:|\.svg:/,  // Fichiers image
  /evaluatePassword/,         // Fonction d'évaluation
  /commonPwds/,               // Liste de mots de passe communs (légitime)
  /\bPwd\b|\bpwd\b(?=[A-Z])/,// Variable préfixée Pwd (pwdInput, etc.)
];

// ─── EXTENSIONS A SCANNER ────────────────────────────────────────────────────
const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx',
  '.html', '.htm', '.vue', '.svelte',
  '.json', '.yaml', '.yml', '.toml',
  '.env.example', '.env.sample',
  '.sh', '.bash',
]);

// ─── DOSSIERS CIBLES ─────────────────────────────────────────────────────────
const SCAN_DIRS = [
  'frontend/src',
  'backend/src',
  'api',
  'supabase/functions',
];

// ─── DOSSIERS A IGNORER ──────────────────────────────────────────────────────
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.cache', 'dist', 'build',
  '.vercel', '.next', 'coverage', '.tmp_pdf',
]);

// ─── COLLECTE DES FICHIERS ───────────────────────────────────────────────────
function collectFiles(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return files; }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (stat.isFile()) {
      const ext = extname(entry).toLowerCase();
      // Inclure aussi les fichiers .env.example/.env.sample
      if (SCAN_EXTENSIONS.has(ext) || entry.endsWith('.env.example') || entry.endsWith('.env.sample')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// ─── CLASSIFICATION D'UNE LIGNE ──────────────────────────────────────────────
function classifyLine(line, filePath) {
  // 1. Vérifier si c'est un vrai secret
  for (const { name, regex } of REAL_SECRET_PATTERNS) {
    if (regex.test(line)) {
      return { level: 'REEL', reason: name };
    }
  }

  // 2. Vérifier si c'est un faux positif connu
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(line)) {
      return { level: 'FAUX_POSITIF', reason: pattern.toString() };
    }
  }

  // 3. Heuristique : valeur entre guillemets longue et complexe = incertain
  const quotedValue = line.match(/(?:password|secret|api_key|token|key)\s*[=:]\s*["']([^"']{8,})["']/i);
  if (quotedValue) {
    const val = quotedValue[1];
    const looksReal = /[A-Z]/.test(val) && /[0-9]/.test(val) && /[a-z]/.test(val);
    const isCommonWord = /^(password|motdepasse|secret|token|key|example|test|demo|your_|placeholder|changeme|xxx)$/i.test(val.trim());
    if (looksReal && !isCommonWord) {
      return { level: 'INCERTAIN', reason: 'Valeur entre guillemets complexe' };
    }
  }

  return { level: 'FAUX_POSITIF', reason: 'Aucun pattern réel détecté' };
}

// ─── SCAN PRINCIPAL ──────────────────────────────────────────────────────────
const ROOT = process.cwd();
let totalFiles = 0;
let totalLines = 0;
let realCount = 0;
let uncertainCount = 0;

const results = { REEL: [], INCERTAIN: [] };

// Mots-clés qui déclenchent l'analyse d'une ligne
const TRIGGER_KEYWORDS = /password|secret|api[_-]?key|token|passwd|pwd|bearer|private_key|client_secret|access_key|supabase_key|auth/i;

console.log(C.bold('\n╔══════════════════════════════════════════════════════════╗'));
console.log(C.bold('║     SCANNER INTELLIGENT DE SECRETS HARDCODES             ║'));
console.log(C.bold('╚══════════════════════════════════════════════════════════╝\n'));

for (const scanDir of SCAN_DIRS) {
  const fullDir = join(ROOT, scanDir);
  const files = collectFiles(fullDir);

  for (const filePath of files) {
    totalFiles++;
    let content;
    try { content = readFileSync(filePath, 'utf8'); } catch { continue; }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      totalLines++;

      if (!TRIGGER_KEYWORDS.test(line)) continue;

      const relPath = relative(ROOT, filePath).replace(/\\/g, '/');
      const { level } = classifyLine(line, filePath);

      if (level === 'REEL') {
        realCount++;
        results.REEL.push({ file: relPath, lineNum: i + 1, content: line.trim() });
      } else if (level === 'INCERTAIN') {
        uncertainCount++;
        results.INCERTAIN.push({ file: relPath, lineNum: i + 1, content: line.trim() });
      }
      // FAUX_POSITIF → ignoré silencieusement
    }
  }
}

// ─── AFFICHAGE DES RESULTATS ─────────────────────────────────────────────────
if (results.REEL.length > 0) {
  console.log(C.bold(C.red('🚨 SECRETS REELS DETECTES — ACTION REQUISE\n')));
  for (const r of results.REEL) {
    console.log(C.red(`  [DANGER] ${r.file}:${r.lineNum}`));
    console.log(C.dim(`           ${r.content.substring(0, 100)}`));
    console.log();
  }
} else {
  console.log(C.green('✅ Aucun secret réel détecté.\n'));
}

if (results.INCERTAIN.length > 0) {
  console.log(C.bold(C.yellow('⚠️  INCERTAINS — Vérification humaine recommandée\n')));
  for (const r of results.INCERTAIN) {
    console.log(C.yellow(`  [?] ${r.file}:${r.lineNum}`));
    console.log(C.dim(`      ${r.content.substring(0, 100)}`));
    console.log();
  }
} else {
  console.log(C.green('✅ Aucune ligne incertaine.\n'));
}

// ─── RESUME ──────────────────────────────────────────────────────────────────
console.log(C.bold('══════════════════════════════════════════════════════════'));
console.log(C.bold('  RÉSUMÉ DU SCAN'));
console.log(C.bold('══════════════════════════════════════════════════════════'));
console.log(`  Fichiers analysés  : ${C.cyan(totalFiles)}`);
console.log(`  Lignes analysées   : ${C.cyan(totalLines.toLocaleString('fr-FR'))}`);
console.log(`  🚨 Secrets réels   : ${realCount > 0 ? C.red(realCount) : C.green(realCount)}`);
console.log(`  ⚠️  Incertains      : ${uncertainCount > 0 ? C.yellow(uncertainCount) : C.green(uncertainCount)}`);
console.log(`  ✅ Faux positifs   : ${C.dim('filtrés automatiquement')}`);

if (realCount === 0 && uncertainCount === 0) {
  console.log(C.bold(C.green('\n  🎉 CODE PROPRE — Aucun secret détecté !\n')));
} else if (realCount > 0) {
  console.log(C.bold(C.red('\n  ⛔ Corrigez les secrets réels immédiatement !\n')));
} else {
  console.log(C.bold(C.yellow('\n  Vérifiez les lignes incertaines manuellement.\n')));
}
console.log(C.bold('══════════════════════════════════════════════════════════\n'));
