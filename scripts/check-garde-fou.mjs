import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

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
    console.error("❌ Impossible de lire backend/.env");
    process.exit(1);
}

// ── Même logique que le frontend pour détecter un garde-fou ────────
const FALLBACK_SIGNATURES = ['default.', 'logo-newket', 'garde-fou', 'broken_image_404', 'this-url-does-not-exist'];

function isFallbackImage(imageStr) {
    if (!imageStr) return true;
    let img = String(imageStr).toLowerCase().trim();
    if (img === '' || img === 'null' || img === 'undefined' || img === '[]') return true;
    return FALLBACK_SIGNATURES.some(sig => img.includes(sig));
}

// ── Vérification de l'accessibilité d'une URL (HEAD request) ───────
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
        } catch {
            resolve({ ok: false, status: 'INVALID_URL' });
        }
    });
}

async function run() {
    console.log("🔍 Vérification des garde-fous en cours...\n");

    // Récupérer tous les produits actifs avec leur vendeur
    const res = await fetch(
        `${supabaseUrl}/rest/v1/products?select=id,name,image,category,users(name,email)&is_archived=eq.false`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const products = await res.json();

    if (!Array.isArray(products)) {
        console.error("❌ Erreur Supabase :", products);
        process.exit(1);
    }

    const gardeFou = [];        // Image manquante / fallback détecté sans probe
    const brokenUrl = [];       // Image présente mais URL inaccessible (probe HTTP)
    const ok = [];

    for (const p of products) {
        const img = Array.isArray(p.image) ? p.image[0] : (p.image || '').split(',')[0].trim();
        const vendeur = p.users?.name || p.users?.email || 'Inconnu';

        // 1. Vérif via signature (rapide, sans réseau)
        if (isFallbackImage(img)) {
            gardeFou.push({ name: p.name, image: img || '(vide)', vendeur, category: p.category });
            continue;
        }

        // 2. Probe HTTP pour vérifier si l'URL est vraiment accessible
        process.stdout.write(`   🌐 Probe: ${p.name.substring(0, 40)}...`);
        const probe = await probeUrl(img);
        process.stdout.write(`\r                                                                      \r`);

        if (!probe.ok) {
            brokenUrl.push({ name: p.name, image: img, vendeur, category: p.category, status: probe.status });
        } else {
            ok.push(p.name);
        }
    }

    const totalProblemes = gardeFou.length + brokenUrl.length;

    console.log(`╔══════════════════════════════════════╗`);
    console.log(`║     🚨 RAPPORT GARDE-FOU NEWKET      ║`);
    console.log(`╚══════════════════════════════════════╝\n`);
    console.log(`  Produits vérifiés  : ${products.length}`);
    console.log(`  ✅ Produits OK     : ${ok.length}`);
    console.log(`  🟡 Total problèmes : ${totalProblemes}\n`);

    if (gardeFou.length > 0) {
        console.log(`🟡 IMAGES MANQUANTES / FALLBACK (${gardeFou.length}) :`);
        console.log(`${'─'.repeat(50)}`);
        gardeFou.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.name}`);
            console.log(`     Vendeur   : ${p.vendeur}`);
            console.log(`     Catégorie : ${p.category || '—'}`);
            console.log(`     Image     : ${p.image}`);
            console.log('');
        });
    }

    if (brokenUrl.length > 0) {
        console.log(`🔴 URLS INACCESSIBLES (${brokenUrl.length}) :`);
        console.log(`${'─'.repeat(50)}`);
        brokenUrl.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.name}`);
            console.log(`     Vendeur   : ${p.vendeur}`);
            console.log(`     Catégorie : ${p.category || '—'}`);
            console.log(`     HTTP      : ${p.status}`);
            console.log(`     URL       : ${p.image}`);
            console.log('');
        });
    }

    if (totalProblemes === 0) {
        console.log(`  🎉 Aucun garde-fou déclenché. Toutes les images sont OK !`);
    }

    console.log(`══════════════════════════════════════`);
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });
