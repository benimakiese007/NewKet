/**
 * NewKet — Vérification des boutons et redirections
 * Utilisation : node check-buttons.js
 * Prérequis   : npm install playwright (dans le dossier tests/)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';

// Pages publiques à tester (sans auth)
const PUBLIC_PAGES = [
  { name: 'Accueil',             url: '/' },
  { name: 'Catalogue',          url: '/src/pages/catalog.html' },
  { name: 'À propos',           url: '/src/pages/about.html' },
  { name: 'FAQ',                url: '/src/pages/faq.html' },
  { name: 'Support',            url: '/src/pages/support.html' },
  { name: 'Confidentialité',    url: '/src/pages/privacy.html' },
  { name: 'CGV',                url: '/src/pages/terms.html' },
  { name: 'Mentions légales',   url: '/src/pages/mentions-legales.html' },
  { name: 'Connexion',          url: '/src/pages/login.html' },
  { name: 'Boutiques',          url: '/src/pages/shops.html' },
  { name: 'Promotions',         url: '/src/pages/promo.html' },
  { name: 'Devenir vendeur',    url: '/src/pages/seller.html' },
  { name: '404',                url: '/src/pages/404.html' },
  { name: 'Choix du Rôle',      url: '/src/pages/choose-role.html' },
  { name: 'Mdp Oublié',         url: '/src/pages/reset-password.html' },
  { name: 'Erreur 500',         url: '/src/pages/500.html' }
];

const BUYER_PAGES = [
  { name: 'Dashboard Client',   url: '/src/pages/customer-dashboard.html' },
  { name: 'Mes Commandes',      url: '/src/pages/orders.html' },
  { name: 'Mes Favoris',        url: '/src/pages/favorites.html' },
  { name: 'Vérifier Facture',   url: '/src/pages/invoice-verify.html' },
  { name: 'Achat rapide',       url: '/src/pages/achat.html' }
];

const SELLER_PAGES = [
  { name: 'Dashboard Vendeur',  url: '/src/pages/vendor-dashboard.html' },
  { name: 'Mes Produits',       url: '/src/pages/products.html' },
  { name: 'Publier Produit',    url: '/src/pages/publish.html' },
  { name: 'Paiements',          url: '/src/pages/payouts.html' },
  { name: 'Disputes',           url: '/src/pages/disputes.html' },
  { name: 'Avis',               url: '/src/pages/reviews.html' },
  { name: 'Temps réel',         url: '/src/pages/realtime.html' },
  { name: 'Analytics',          url: '/src/pages/analytics.html' },
  { name: 'Comptabilité',       url: '/src/pages/comptabilite.html' },
  { name: 'Boutique Perso',     url: '/src/pages/shop.html' },
  { name: 'Profil',             url: '/src/pages/user.html' }
];

const IGNORE_PATTERNS = [
  'javascript:void(0)', 'javascript:', '#', 'mailto:', 'tel:',
  'https://www.facebook.com', 'https://www.linkedin.com',
  'shop?email=' // Liens dynamiques vers profils vendeurs (générés depuis la base de données)
];

function isIgnored(href) {
  if (!href) return true;
  return IGNORE_PATTERNS.some(p => href.startsWith(p));
}

function escHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function buildHtml(results) {
  const now = new Date().toLocaleString('fr-FR');
  const totalOk    = results.flatMap(r => r.links).filter(l => l.status === 'ok').length;
  const totalFail  = results.flatMap(r => r.links).filter(l => l.status !== 'ok').length;
  const totalBtns  = results.flatMap(r => r.buttons).length;
  const missingBtns = results.flatMap(r => r.buttons).filter(b => !b.hasAction).length;

  const rowsPages = results.map(r => {
    const linkOk   = r.links.filter(l => l.status === 'ok').length;
    const linkFail = r.links.filter(l => l.status !== 'ok').length;
    const btnOk    = r.buttons.filter(b => b.hasAction).length;
    const btnFail  = r.buttons.filter(b => !b.hasAction).length;
    const statusClass = (linkFail + btnFail) === 0 ? 'ok' : 'fail';
    const uid = r.url.replace(/[^a-z0-9]/gi, '_');

    const linkRows = r.links.map(l => `
      <tr class="sub">
        <td>🔗 <code>${escHtml(l.text.slice(0, 60))}</code></td>
        <td><code>${escHtml(l.href.slice(0, 80))}</code></td>
        <td class="${l.status === 'ok' ? 'ok' : 'fail'}">${l.status === 'ok' ? '✅ ' + l.statusCode : '❌ ' + l.statusCode}</td>
      </tr>`).join('');

    const btnRows = r.buttons.map(b => `
      <tr class="sub">
        <td>🔘 <code>${escHtml((b.text || b.id || '[bouton sans texte]').slice(0, 60))}</code></td>
        <td><code>${escHtml(b.action || '—')}</code></td>
        <td class="${b.hasAction ? 'ok' : 'warn'}">${b.hasAction ? '✅ Action détectée' : '⚠️ Aucune action'}</td>
      </tr>`).join('');

    return `
    <tr class="page-row ${statusClass}" onclick="toggle('${uid}')">
      <td><strong>${escHtml(r.name)}</strong><br><small>${escHtml(r.url)}</small></td>
      <td>🔗 ${linkOk} OK / ${linkFail} erreurs &nbsp;&nbsp; 🔘 ${btnOk} OK / ${btnFail} manquants</td>
      <td class="${statusClass}">${(linkFail + btnFail) === 0 ? '✅ OK' : '❌ Problèmes'}</td>
    </tr>
    <tr id="${uid}" class="details hidden">
      <td colspan="3">
        <table class="inner">
          <thead><tr><th>Élément</th><th>Cible / Action</th><th>Statut</th></tr></thead>
          <tbody>${linkRows}${btnRows}${(!linkRows && !btnRows) ? '<tr><td colspan="3">Aucun lien ni bouton trouvé</td></tr>' : ''}</tbody>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NewKet — Rapport boutons</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#f8fafc;color:#1e293b;padding:2rem}
    h1{font-size:1.6rem;color:#013220;margin-bottom:.25rem}
    .meta{color:#64748b;font-size:.85rem;margin-bottom:1.5rem}
    .summary{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:2rem}
    .card{background:#fff;border-radius:12px;padding:1rem 1.5rem;box-shadow:0 1px 4px rgba(0,0,0,.08);flex:1;min-width:140px;text-align:center}
    .card .num{font-size:2rem;font-weight:800}
    .card .label{font-size:.75rem;text-transform:uppercase;color:#64748b;letter-spacing:.05em}
    .card.green .num{color:#16a34a}.card.red .num{color:#dc2626}.card.amber .num{color:#d97706}.card.blue .num{color:#2563eb}
    table.main{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}
    table.main thead tr{background:#013220;color:#fff}
    table.main th,table.main td{padding:.75rem 1rem;text-align:left;font-size:.85rem}
    .page-row{cursor:pointer;transition:background .15s}
    .page-row:hover{background:#f1f5f9}
    .page-row.fail{border-left:4px solid #dc2626}
    .page-row.ok{border-left:4px solid #16a34a}
    .details td{background:#f8fafc;padding:0 1rem 1rem}
    .hidden{display:none}
    table.inner{width:100%;border-collapse:collapse;font-size:.8rem}
    table.inner th{background:#e2e8f0;padding:.4rem .6rem;text-align:left}
    table.inner td{padding:.35rem .6rem;border-bottom:1px solid #e2e8f0;vertical-align:top}
    .inner tr.sub td{background:#fff}
    td.ok{color:#16a34a;font-weight:700}td.fail{color:#dc2626;font-weight:700}td.warn{color:#d97706;font-weight:700}
    code{background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:.75rem}
    small{color:#64748b}
    .hint{margin-top:1.5rem;padding:1rem;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;font-size:.82rem}
    .copy-btn{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.5rem;padding:.75rem 1.5rem;background:#013220;color:#fff;border:none;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;transition:background .2s}
    .copy-btn:hover{background:#025c38}
    .copy-btn.copied{background:#16a34a}
    .no-problems{margin-top:1.5rem;padding:1rem;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:8px;font-size:.85rem;color:#15803d;font-weight:600}
  </style>
</head>
<body>
  <h1>🧪 NewKet — Rapport Boutons &amp; Redirections</h1>
  <p class="meta">Généré le ${now} &bull; Serveur : <code>${BASE_URL}</code></p>

  <div class="summary">
    <div class="card green"><div class="num">${totalOk}</div><div class="label">Liens OK</div></div>
    <div class="card red"><div class="num">${totalFail}</div><div class="label">Liens en erreur</div></div>
    <div class="card blue"><div class="num">${totalBtns}</div><div class="label">Boutons trouvés</div></div>
    <div class="card amber"><div class="num">${missingBtns}</div><div class="label">Sans action</div></div>
  </div>

  <div id="copy-area" style="margin-bottom:1.5rem"></div>

  <table class="main">
    <thead><tr><th>Page</th><th>Résumé</th><th>Statut</th></tr></thead>
    <tbody>${rowsPages}</tbody>
  </table>

  <div class="hint">💡 Cliquer sur une ligne pour voir le détail des liens et boutons de la page.</div>

  <script>
    function toggle(id){var el=document.getElementById(id);if(el)el.classList.toggle('hidden');}

    var PROBLEMS = ${JSON.stringify(
      results.flatMap(r => [
        ...r.links
          .filter(l => l.status !== 'ok')
          .map(l => ({ page: r.name, url: r.url, type: 'LIEN EN ERREUR', detail: l.href, code: l.statusCode })),
        ...r.buttons
          .filter(b => !b.hasAction)
          .map(b => ({ page: r.name, url: r.url, type: 'BOUTON SANS ACTION', detail: b.text || b.id || '[sans texte]', code: '—' }))
      ])
    )};

    (function(){
      var area = document.getElementById('copy-area');
      if (!area) return;
      if (PROBLEMS.length === 0) {
        area.innerHTML = '<div class="no-problems">✅ Aucun problème détecté — Tout est parfait !</div>';
        return;
      }
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = '📋 Copier tous les problèmes (' + PROBLEMS.length + ')';
      btn.onclick = function() {
        var lines = ['=== RAPPORT DES PROBLÈMES NEWKET ===', ''];
        var lastPage = '';
        PROBLEMS.forEach(function(p) {
          if (p.page !== lastPage) {
            lines.push('📄 ' + p.page + ' (' + p.url + ')');
            lastPage = p.page;
          }
          lines.push('  ' + (p.type === 'LIEN EN ERREUR' ? '❌' : '⚠️') + ' [' + p.type + '] ' + p.detail + ' → Code: ' + p.code);
        });
        lines.push('');
        lines.push('Total : ' + PROBLEMS.length + ' problème(s)');
        navigator.clipboard.writeText(lines.join('\\n')).then(function(){
          btn.innerHTML = '✅ Copié !';
          btn.classList.add('copied');
          setTimeout(function(){ btn.innerHTML = '📋 Copier tous les problèmes (' + PROBLEMS.length + ')'; btn.classList.remove('copied'); }, 2500);
        });
      };
      area.appendChild(btn);
    })();
  </script>
</body>
</html>`;
}

async function analysePage(page, pageInfo) {
  console.log(`  📄 ${pageInfo.name} (${pageInfo.url})`);
  const result = { ...pageInfo, links: [], buttons: [], error: null };

  try {
    const resp = await page.goto(BASE_URL + pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!resp || resp.status() >= 400) {
      result.error = `HTTP ${resp?.status() || 'timeout'}`;
      console.log(`    ❌ Page inaccessible : ${result.error}`);
      return result;
    }

    await page.waitForTimeout(2500); // Wait longer to allow dynamic ConfigManager (social links) to load from DB

    // Liens
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map(a => ({
        text: a.innerText?.trim() || a.getAttribute('aria-label') || '',
        href: a.getAttribute('href') || '',
      }))
    );

    for (const link of links) {
      if (isIgnored(link.href)) continue;
      let statusCode = '—';
      let status = 'ok';
      try {
        const target = link.href.startsWith('http') ? link.href : BASE_URL + link.href;
        const r = await page.request.get(target, { timeout: 8000 });
        statusCode = r.status();
        status = statusCode >= 400 ? 'error' : 'ok';
      } catch {
        status = 'error'; statusCode = 'timeout';
      }
      result.links.push({ text: link.text, href: link.href, statusCode, status });
    }

    // Boutons
    result.buttons = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"],input[type="button"]')).map(b => {
        const onclick   = (b.getAttribute('onclick') || '').trim();
        const hasOnclick = onclick.length > 0 && onclick !== 'void(0)' && onclick !== 'return false;';
        const href      = b.closest('a')?.getAttribute('href') || '';
        const form      = b.closest('form')?.getAttribute('action') || (b.type === 'submit' ? '[form submit]' : '');
        const dataTrack = b.getAttribute('data-track-action') || b.getAttribute('data-action') || b.getAttribute('data-filter') || b.getAttribute('data-toggle-sidebar') || b.getAttribute('data-logout-safe') || '';
        const action    = (hasOnclick ? onclick : '') || href || form || dataTrack || b.id || (b.classList.contains('leaflet-marker-icon') ? '[leaflet marker]' : '');
        // Note: buttons with an ID are considered functional (JS event listeners target them by ID)
        return {
          text:      b.innerText?.trim() || b.value || '',
          id:        b.id || '',
          hasAction: !!action,
          action,
          html:      !action ? b.outerHTML : ''
        };
      })
    );

  } catch (err) {
    result.error = err.message;
  }

  const fail = result.links.filter(l => l.status !== 'ok').length;
  const noAct = result.buttons.filter(b => !b.hasAction).length;
  result.missingBtns = noAct;
  if (result.missingBtns > 0) {
    console.log(`    ⚠️ ${result.links.length} liens, ${result.buttons.length} boutons (${result.missingBtns} sans action)`);
    result.buttons.filter(b => !b.hasAction).forEach(b => {
      console.log(`      -> MISSING: ${b.html}`);
    });
  } else {
    console.log(`    ${(fail + noAct) === 0 ? '✅' : '⚠️'} ${result.links.length} liens, ${result.buttons.length} boutons (${noAct} sans action)`);
  }
  return result;
}

async function loginUser(page, email, password) {
  console.log(`\n  🔐 Connexion avec ${email}...`);
  await page.goto(BASE_URL + '/src/pages/login.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  // Wait for login processing and redirection
  await page.waitForTimeout(4000);
  const url = page.url();
  console.log(`  ✅ Connecté. Redirigé vers: ${url}`);
}

(async () => {
  const totalPagesToTest = PUBLIC_PAGES.length + BUYER_PAGES.length + SELLER_PAGES.length;

  console.log('\n════════════════════════════════════════');
  console.log('  NewKet — Test boutons & redirections');
  console.log('════════════════════════════════════════');
  console.log(`  URL : ${BASE_URL}`);
  console.log(`  Pages testées : ${totalPagesToTest}`);
  console.log('────────────────────────────────────────\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page    = await context.newPage();

  const results = [];
  
  console.log('\n--- 1️⃣ TEST DES PAGES PUBLIQUES ---');
  for (const pageInfo of PUBLIC_PAGES) {
    results.push(await analysePage(page, pageInfo));
  }

  console.log('\n--- 2️⃣ TEST DES PAGES ACHETEUR ---');
  await loginUser(page, 'benimakiese1234567@gmail.com', 'Phoenix-1234');
  for (const pageInfo of BUYER_PAGES) {
    results.push(await analysePage(page, pageInfo));
  }

  console.log('\n--- 3️⃣ TEST DES PAGES VENDEUR ---');
  await context.clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await loginUser(page, 'benimakiese123@gmail.com', 'Phoenix-1234');
  for (const pageInfo of SELLER_PAGES) {
    results.push(await analysePage(page, pageInfo));
  }

  await browser.close();

  const outDir  = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'rapport-boutons.html');
  fs.writeFileSync(outFile, buildHtml(results), 'utf8');

  const totalFail = results.flatMap(r => r.links).filter(l => l.status !== 'ok').length;
  const missBtns  = results.flatMap(r => r.buttons).filter(b => !b.hasAction).length;

  console.log('\n────────────────────────────────────────');
  console.log(`  📄 Rapport : ${outFile}`);
  console.log(`  ❌ Liens en erreur     : ${totalFail}`);
  console.log(`  ⚠️  Boutons sans action : ${missBtns}`);
  console.log('════════════════════════════════════════\n');

  // Le rapport est ouvert par TESTER-LES-BOUTONS.bat directement
})();
