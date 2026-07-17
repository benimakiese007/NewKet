import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Setup pour lire le .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const PROJECT_ROOT = path.join(__dirname, '../../');

// Liste des dossiers/fichiers à vérifier pour les images
const directoriesToScan = [
  path.join(PROJECT_ROOT, 'PaymentSystemLogos'),
  path.join(PROJECT_ROOT, 'frontend', 'src', 'assets', 'Images'),
  PROJECT_ROOT // On va scanner la racine pour les logos isolés
];

const imageMap = {};
const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];

async function uploadImage(filePath, folderPath) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `newket_assets/${folderPath}`,
      use_filename: true,
      unique_filename: false,
      overwrite: true
    });
    return result.secure_url;
  } catch (error) {
    console.error(`❌ Erreur d'upload pour ${filePath}:`, error.message);
    return null;
  }
}

function scanDir(directory, relativeFolder = '') {
  if (!fs.existsSync(directory)) return;

  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Éviter de scanner des dossiers profonds ou inutiles si on scanne la racine
      if (directory === PROJECT_ROOT && ['node_modules', '.git', 'backend', 'frontend'].includes(file)) {
        continue;
      }
      // Recursion
      if (directory !== PROJECT_ROOT) {
         scanDir(fullPath, path.join(relativeFolder, file).replace(/\\/g, '/'));
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (validExtensions.includes(ext)) {
         // C'est une image !
         const relativePathToRoot = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
         
         // Ajouter à la liste à uploader
         imageMap[relativePathToRoot] = { fullPath, uploadedUrl: null, folder: relativeFolder };
      }
    }
  }
}

async function main() {
  console.log("🔍 Recherche des images locales...");
  for (const dir of directoriesToScan) {
     const relativeFolder = path.relative(PROJECT_ROOT, dir).replace(/\\/g, '/');
     scanDir(dir, relativeFolder === '' ? 'racine' : relativeFolder);
  }

  const imagePaths = Object.keys(imageMap);
  console.log(`📸 ${imagePaths.length} images trouvées. Début de l'upload vers Cloudinary...`);

  for (const relPath of imagePaths) {
    console.log(`⬆️ Upload de: ${relPath}`);
    const imgInfo = imageMap[relPath];
    const url = await uploadImage(imgInfo.fullPath, imgInfo.folder);
    if (url) {
      imgInfo.uploadedUrl = url;
      console.log(`✅ Succès: ${url}`);
    }
  }

  // Sauvegarder la carte des images pour l'Étape 2
  const mapPath = path.join(__dirname, '../image_migration_map.json');
  fs.writeFileSync(mapPath, JSON.stringify(imageMap, null, 2));
  console.log(`\n🎉 Terminé ! Le fichier de correspondances a été sauvegardé dans: image_migration_map.json`);
}

main();
