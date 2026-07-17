import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '../../');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

// Charger le map
const mapPath = path.join(__dirname, '../image_migration_map.json');
if (!fs.existsSync(mapPath)) {
  console.error("❌ Fichier image_migration_map.json introuvable !");
  process.exit(1);
}

const imageMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const fileNamesToUrls = {};

// Associer chaque nom de fichier à son URL Cloudinary
for (const [relPath, info] of Object.entries(imageMap)) {
  const fileName = path.basename(info.fullPath);
  fileNamesToUrls[fileName] = info.uploadedUrl;
}

const extensionsToProcess = ['.html', '.js', '.css', '.jsx', '.ts', '.tsx'];
let filesModifiedCount = 0;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [fileName, url] of Object.entries(fileNamesToUrls)) {
    if (!url) continue;

    // Regex pour attraper les chemins d'images dans les attributs src="", href="", ou url('')
    // Cherche n'importe quel chemin qui se termine par le nom du fichier, entouré de guillemets ou parenthèses
    // Exemple : src="../../assets/Images/logo.png" -> src="URL_CLOUDINARY"
    //           url('../Images/logo.png') -> url('URL_CLOUDINARY')
    
    // Pattern pour les guillemets simples ou doubles
    const regexQuotes = new RegExp(`(['"])([^'"]*\\/${fileName}|${fileName})(['"])`, 'g');
    if (regexQuotes.test(content)) {
      content = content.replace(regexQuotes, `$1${url}$3`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Mis à jour : ${path.relative(PROJECT_ROOT, filePath)}`);
    filesModifiedCount++;
  }
}

function scanDirAndReplace(directory) {
  if (!fs.existsSync(directory)) return;

  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'assets'].includes(file)) continue; // on skip assets car ce sont les sources, pas besoin de remplacer dedans
      scanDirAndReplace(fullPath);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (extensionsToProcess.includes(ext)) {
        processFile(fullPath);
      }
    }
  }
}

console.log("🔍 Début du remplacement des chemins dans le frontend...");
scanDirAndReplace(FRONTEND_DIR);
console.log(`\n🎉 Terminé ! ${filesModifiedCount} fichiers ont été mis à jour.`);
