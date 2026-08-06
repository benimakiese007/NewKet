import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

// ── Clés Supabase ──────────────────────────────────────────────────
let supabaseUrl = '';
let supabaseKey = '';
try {
    const env = fs.readFileSync(path.join(ROOT_DIR, 'backend', '.env'), 'utf8');
    const urlMatch = env.match(/SUPABASE_URL=(.+)/);
    const keyMatch = env.match(/SUPABASE_SECRET_KEY=(.+)/);
    if (urlMatch) supabaseUrl = urlMatch[1].trim();
    if (keyMatch) supabaseKey = keyMatch[1].trim();
} catch (e) {
    console.warn("⚠️  Impossible de lire backend/.env — stats Supabase ignorées.");
}

// ── Garde-fou : même logique que le frontend ───────────────────────
const FALLBACK_SIGNATURES = ['default.', 'logo-newket', 'garde-fou', 'broken_image_404', 'this-url-does-not-exist'];

function isFallbackImage(imageStr) {
    if (!imageStr) return true;
    const img = String(imageStr).toLowerCase().trim();
    if (['', 'null', 'undefined', '[]'].includes(img)) return true;
    return FALLBACK_SIGNATURES.some(sig => img.includes(sig));
}

function probeUrl(url) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(url);
            const proto = parsed.protocol === 'https:' ? https : http;
            const req = proto.request({
                method: 'HEAD',
                hostname: parsed.hostname,
                path: parsed.pathname + parsed.search,
                headers: { 'User-Agent': 'NewKet-Watchdog/1.0' }
            }, (res) => {
                resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
            });
            req.on('error', () => resolve({ ok: false, status: 'ERR' }));
            req.setTimeout(6000, () => { req.destroy(); resolve({ ok: false, status: 'TIMEOUT' }); });
            req.end();
        } catch { resolve({ ok: false, status: 'INVALID_URL' }); }
    });
}

// ── Scanner les fichiers HTML ──────────────────────────────────────
let ui = { pages: 0, lines: 0, buttons: 0, modals: 0, forms: 0, inputs: 0, images: 0, links: 0, icons: 0 };

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (['node_modules', 'dist', '.git', 'scratch'].includes(file)) continue;
            scanDirectory(fullPath);
        } else if (file.endsWith('.html')) {
            ui.pages++;
            const c = fs.readFileSync(fullPath, 'utf8');
            ui.lines   += c.split('\n').length;
            ui.buttons += (c.match(/<button/gi) || []).length;
            ui.modals  += (c.match(/<(div|dialog)[^>]+id="[^"]*modal[^"]*"[^>]*>/gi) || []).length;
            ui.forms   += (c.match(/<form/gi) || []).length;
            ui.inputs  += (c.match(/<(input|textarea|select)/gi) || []).length;
            ui.images  += (c.match(/<img/gi) || []).length;
            ui.links   += (c.match(/<a[\s>]/gi) || []).length;
            ui.icons   += (c.match(/<(iconify-icon|svg)/gi) || []).length;
        }
    }
}

// ── Requête Supabase générique ─────────────────────────────────────
async function fetchSupabase(endpoint) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    return res.json();
}

// ── Stats produits ─────────────────────────────────────────────────
async function getProductStats() {
    const products = await fetchSupabase('products?select=id,name,image,category,users(name,email)&is_archived=eq.false');
    if (!Array.isArray(products)) return null;

    let totalImages = 0, avecPlusieurs = 0, avecUne = 0, sansImage = 0;
    let maxImages = 0, produitMax = '';
    const gardeFouList = [];
    const brokenList = [];

    process.stdout.write('\n   🌐 Probe des images produits');

    for (const p of products) {
        // Extraire la première URL propre (gère les formats "url,url2" et "url||url2")
        const rawImg = Array.isArray(p.image)
            ? p.image[0]
            : (p.image || '').split('||')[0].split(',')[0].trim();
        const vendeur = p.users?.name || p.users?.email || 'Inconnu';

        // Comptage images
        if (!p.image || p.image.trim() === '') {
            sansImage++;
        } else {
            const imgs = p.image.split(',').map(i => i.trim()).filter(Boolean);
            totalImages += imgs.length;
            if (imgs.length === 1) avecUne++;
            if (imgs.length > 1) avecPlusieurs++;
            if (imgs.length > maxImages) { maxImages = imgs.length; produitMax = p.name; }
        }

        // Garde-fou : vérif signature
        if (isFallbackImage(rawImg)) {
            gardeFouList.push({ name: p.name, vendeur, image: rawImg || '(vide)', status: 'FALLBACK' });
            continue;
        }

        // Garde-fou : probe HTTP
        process.stdout.write('.');
        const probe = await probeUrl(rawImg);
        if (!probe.ok) {
            brokenList.push({ name: p.name, vendeur, image: rawImg, status: probe.status });
        }
    }

    process.stdout.write(' OK\n');

    return {
        total: products.length, totalImages,
        moyenne: (totalImages / products.length).toFixed(1),
        avecPlusieurs, avecUne, sansImage, maxImages, produitMax,
        gardeFou: gardeFouList,
        broken: brokenList
    };
}

// ── Stats utilisateurs ─────────────────────────────────────────────
async function getUserStats() {
    const users = await fetchSupabase('users?select=role');
    if (!Array.isArray(users)) return null;
    const counts = {};
    users.forEach(u => counts[u.role] = (counts[u.role] || 0) + 1);
    return { total: users.length, counts };
}

// ── Main ───────────────────────────────────────────────────────────
async function run() {
    console.log("🔍 Analyse en cours...");
    scanDirectory(FRONTEND_DIR);

    let prodStats = null;
    let userStats = null;

    if (supabaseUrl && supabaseKey) {
        try { prodStats = await getProductStats(); } catch (e) { console.warn("⚠️  Produits inaccessibles."); }
        try { userStats = await getUserStats(); } catch (e) { console.warn("⚠️  Utilisateurs inaccessibles."); }
    }

    const n = (v) => (v || 0).toLocaleString('fr-FR');
    const totalGardeFou = (prodStats?.gardeFou?.length || 0) + (prodStats?.broken?.length || 0);

    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║     📊 NEWKET — BILAN COMPLET        ║`);
    console.log(`╚══════════════════════════════════════╝`);

    console.log(`\n📁  INTERFACE (Code HTML)`);
    console.log(`    Pages HTML              : ${n(ui.pages)}`);
    console.log(`    Lignes de code          : ${n(ui.lines)}`);

    console.log(`\n🖱️   INTERACTIONS`);
    console.log(`    Boutons <button>        : ${n(ui.buttons)}`);
    console.log(`    Liens cliquables <a>    : ${n(ui.links)}`);

    console.log(`\n📝  SAISIE DE DONNÉES`);
    console.log(`    Formulaires <form>      : ${n(ui.forms)}`);
    console.log(`    Champs de saisie        : ${n(ui.inputs)}`);

    console.log(`\n🎨  VISUELS ET STRUCTURE`);
    console.log(`    Modales (popups)        : ${n(ui.modals)}`);
    console.log(`    Images en dur <img>     : ${n(ui.images)}`);
    console.log(`    Icônes (SVG/Iconify)    : ${n(ui.icons)}`);

    if (prodStats) {
        console.log(`\n📦  PRODUITS (Supabase)`);
        console.log(`    Produits en ligne       : ${n(prodStats.total)}`);
        console.log(`    Images au total         : ${n(prodStats.totalImages)}`);
        console.log(`    Moyenne images/produit  : ${prodStats.moyenne}`);
        console.log(`    Avec plusieurs images   : ${n(prodStats.avecPlusieurs)}`);
        console.log(`    Avec 1 seule image      : ${n(prodStats.avecUne)}`);
        console.log(`    Sans image              : ${n(prodStats.sansImage)}`);
        console.log(`    Record (max)            : ${prodStats.maxImages} images → "${prodStats.produitMax}"`);

        console.log(`\n🚨  GARDE-FOU`);
        if (totalGardeFou === 0) {
            console.log(`    ✅ Aucun problème détecté — tout est OK !`);
        } else {
            console.log(`    ⚠️  Produits en garde-fou  : ${totalGardeFou}`);
            prodStats.gardeFou.forEach(p => {
                console.log(`    🟡 [FALLBACK] ${p.name} (${p.vendeur})`);
            });
            prodStats.broken.forEach(p => {
                console.log(`    🔴 [HTTP ${p.status}] ${p.name} (${p.vendeur})`);
            });
        }
    }

    if (userStats) {
        console.log(`\n👥  UTILISATEURS (Supabase)`);
        console.log(`    Total                   : ${n(userStats.total)}`);
        console.log(`    👑 Admins               : ${n(userStats.counts['admin'] || 0)}`);
        console.log(`    🏪 Vendeurs (supplier)  : ${n(userStats.counts['supplier'] || 0)}`);
        console.log(`    🛒 Acheteurs (customer) : ${n(userStats.counts['customer'] || 0)}`);
    }

    console.log(`\n══════════════════════════════════════`);
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });
