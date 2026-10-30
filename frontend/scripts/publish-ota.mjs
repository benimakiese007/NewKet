#!/usr/bin/env node
/**
 * NewKet — Script de publication OTA Self-Hosted
 * ===============================================
 * Déploie une mise à jour instantanée pour Android & iOS sans passer par les Stores
 * ni par les serveurs payants de Capgo Cloud.
 *
 * Utilisation :
 *   npm run ota:publish
 *   npm run ota:publish -- 1.0.2 "Correction bug panier"
 *   node scripts/publish-ota.mjs --version 1.0.2 --notes "Hotfix"
 */

import { execSync } from 'child_process';
import { createWriteStream, readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDir = resolve(__dirname, '..');
const rootDir = resolve(frontendDir, '..');

// 1. Charger les variables d'environnement (backend/.env ou frontend/.env)
dotenv.config({ path: resolve(rootDir, 'backend', '.env') });
dotenv.config({ path: resolve(frontendDir, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
    console.error('[ERREUR] ERREUR : SUPABASE_SERVICE_ROLE_KEY introuvable dans backend/.env');
    process.exit(1);
}

// 2. Déterminer la version
const pkgPath = resolve(frontendDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, ''));

// Parse arguments
const args = process.argv.slice(2);
let targetVersion = '';
let releaseNotes = '';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
        targetVersion = args[++i];
    } else if (args[i] === '--notes' && args[i + 1]) {
        releaseNotes = args[++i];
    } else if (!targetVersion && !args[i].startsWith('--')) {
        targetVersion = args[i];
    } else if (!releaseNotes && !args[i].startsWith('--')) {
        releaseNotes = args[i];
    }
}

// Si pas de version fournie, incrémenter le patch de package.json
if (!targetVersion) {
    const parts = (pkg.version || '1.0.0').split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    targetVersion = parts.join('.');
}

releaseNotes = releaseNotes || `Mise à jour OTA v${targetVersion} (${new Date().toLocaleDateString('fr-FR')})`;

console.log('\n========================================');
console.log('[OTA] NewKet - Publication Version ' + targetVersion);
console.log('========================================\n');

// Mettre à jour package.json avec la nouvelle version
pkg.version = targetVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('[OK] package.json mis a jour -> ' + targetVersion);

// 3. Build Frontend avec Vite
console.log('\n[1/3] Compilation du frontend (Vite)...');
try {
    execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });
    console.log('[OK] Build termine dans frontend/dist');
} catch (e) {
    console.error(`[ERREUR] Echec du build Vite :`, e.message);
    process.exit(1);
}

// 4. Compression du dossier dist en zip standard (compatible iOS/Android SSZipArchive)
const zipName = `bundle-v${targetVersion}.zip`;
const zipPath = resolve(frontendDir, zipName);

console.log('\n[2/3] Creation de l archive standard ' + zipName + '...');
async function createZip() {
    return new Promise((res, rej) => {
        if (existsSync(zipPath)) unlinkSync(zipPath);
        const output = createWriteStream(zipPath);
        const archive = new ZipArchive({ zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`[OK] Archive creee avec succes (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
            res();
        });

        output.on('error', (err) => rej(err));
        archive.on('error', (err) => rej(err));
        archive.pipe(output);
        archive.directory(resolve(frontendDir, 'dist'), false);
        archive.finalize();
    });
}

try {
    await createZip();
} catch (e) {
    console.error(`[ERREUR] Echec de la compression :`, e.message);
    process.exit(1);
}

// 5. Upload sur Supabase Storage
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadAndPublish() {
    console.log('\n[3/3] Upload vers Supabase Storage (bucket app-releases)...');
    const fileBuffer = readFileSync(zipPath);

    const { error: uploadError } = await supabase.storage
        .from('app-releases')
        .upload(zipName, fileBuffer, {
            contentType: 'application/zip',
            upsert: true
        });

    if (uploadError) {
        console.error(`[ERREUR] Echec de l'upload vers Supabase Storage :`, uploadError.message);
        try { unlinkSync(zipPath); } catch (_) {}
        process.exit(1);
    }

    const bundleUrl = `${SUPABASE_URL}/storage/v1/object/public/app-releases/${zipName}`;
    console.log('[OK] Upload reussi : ' + bundleUrl);

    // 6. Enregistrement dans la table app_versions
    console.log('\n[OK] Enregistrement dans la table app_versions...');
    const { error: dbError } = await supabase
        .from('app_versions')
        .upsert({
            version: targetVersion,
            bundle_url: bundleUrl,
            channel: 'production',
            is_active: true,
            min_native_version: '1.0.0',
            release_notes: releaseNotes,
            created_at: new Date().toISOString()
        }, { onConflict: 'version' });

    if (dbError) {
        console.error(`[ERREUR] Erreur enregistrement table app_versions :`, dbError.message);
        try { unlinkSync(zipPath); } catch (_) {}
        process.exit(1);
    }

    // 7. Nettoyage du zip local
    try { unlinkSync(zipPath); } catch (_) {}

    console.log('\n========================================\n[SUCCES] PUBLICATION OTA REUSSIE !\n========================================');
    console.log(`----------------------------------------`);
    console.log(`- Version       : ${targetVersion}`);
    console.log(`- Canal         : production`);
    console.log(`- Notes         : ${releaseNotes}`);
    console.log(`- URL Bundle    : ${bundleUrl}`);
    console.log(`----------------------------------------`);
    console.log(`📱 Tous les appareils mobiles (iOS & Android) vont récupérer`);
    console.log(`   cette version automatiquement au prochain mouvement.\n`);
}

uploadAndPublish();
