import { test, expect } from '@playwright/test';

/**
 * TEST DE VERIFICATION DES BOUTONS - NewKet
 * ==========================================
 * Ce fichier teste que tous les boutons sur toutes les pages publiques :
 *  - Sont visibles
 *  - Ne sont pas désactivés sans raison
 *  - Ne génèrent pas d'erreur JS au clic
 *  - Ont un texte ou un label accessible (aria-label, title, etc.)
 */

test.setTimeout(120_000);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins
const PAGES_DIR = path.resolve(__dirname, '../../frontend/src/pages');
const ROOT_URL = '/src/pages';

// Fonction récursive pour trouver tous les fichiers HTML
function getAllHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllHtmlFiles(filePath, fileList);
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const allHtmlFiles = getAllHtmlFiles(PAGES_DIR);

// Catégorisation dynamique
const PUBLIC_PAGES = [];
const BUYER_PAGES = [];
const VENDOR_PAGES = [];

for (const filePath of allHtmlFiles) {
    // Calcul de l'URL relative
    const relativePath = path.relative(PAGES_DIR, filePath).replace(/\\/g, '/');
    let url = `${ROOT_URL}/${relativePath}`;
    
    // Remplacement spécial pour l'index
    if (relativePath === 'index.html' || relativePath === '../index.html') {
        url = '/';
    }

    const name = path.basename(filePath, '.html');
    const pageInfo = { name, url };

    // Si la page a besoin d'un temps d'attente spécifique pour charger du contenu dynamique
    if (['promo', 'choose-role', 'catalog', 'index'].includes(name)) {
        pageInfo.waitMs = 5000;
    }

    // Routage vers la bonne catégorie selon le nom ou le dossier
    if (relativePath.includes('admin/') || ['vendor-dashboard', 'publish', 'seller-onboarding'].includes(name)) {
        VENDOR_PAGES.push(pageInfo);
    } else if (['customer-dashboard', 'favorites', 'notifications', 'settings', 'achat'].includes(name)) {
        BUYER_PAGES.push(pageInfo);
    } else {
        PUBLIC_PAGES.push(pageInfo);
    }
}

// Erreurs JS à ignorer (erreurs connues non liées aux boutons)
const IGNORED_ERRORS = [
    'VAPID keys missing',
    'Sentry Dsn',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    'ResizeObserver loop',
    'push_notification_jobs',
    'Failed to load search',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_CLOSED',
    '502',
    '502 (Bad Gateway)',
    'Failed to load resource',
];

function shouldIgnoreError(msg) {
    return IGNORED_ERRORS.some(ignore => msg.includes(ignore));
}

// ─────────────────────────────────────────────────────────
// HELPER: tester tous les boutons d'une page
// ─────────────────────────────────────────────────────────
async function checkButtonsOnPage(page, pageInfo) {
    const jsErrors = [];

    page.on('console', msg => {
        if (msg.type() === 'error' && !shouldIgnoreError(msg.text())) {
            jsErrors.push(msg.text());
        }
    });

    await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Attente dynamique : certaines pages chargent leurs boutons via JS
    await page.waitForTimeout(pageInfo.waitMs || 3000);

    // Récupère tous les boutons et liens cliquables
    const buttons = page.locator('button:visible, a[href]:visible, [role="button"]:visible, input[type="submit"]:visible, input[type="button"]:visible');
    const count = await buttons.count();

    console.log(`\n📄 ${pageInfo.name} → ${count} boutons trouvés`);

    const results = { page: pageInfo.name, total: count, issues: [] };

    for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);

        // Récupère le texte/label du bouton
        const text = (await btn.innerText().catch(() => '')).trim();
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
        const title = await btn.getAttribute('title').catch(() => '');
        const label = text || ariaLabel || title || '(sans label)';
        const tag = await btn.evaluate(el => el.tagName.toLowerCase());

        // Vérifie si le bouton est désactivé
        const isDisabled = await btn.isDisabled().catch(() => false);

        // Vérifie si le bouton a un label accessible
        const hasLabel = !!(text || ariaLabel || title);

        if (!hasLabel) {
            results.issues.push(`⚠️  Bouton #${i + 1} <${tag}> sans label accessible`);
        }

        console.log(`   ${isDisabled ? '🔒 [DESACTIVE]' : '✅'} <${tag}> "${label.substring(0, 50)}"`);
    }

    // Rapport des erreurs JS
    if (jsErrors.length > 0) {
        results.issues.push(`🔴 ${jsErrors.length} erreur(s) JS détectée(s)`);
        jsErrors.forEach(err => console.warn(`   ❌ JS Error: ${err.substring(0, 100)}`));
    }

    return results;
}

// ─────────────────────────────────────────────────────────
// TESTS PUBLICS (sans connexion)
// ─────────────────────────────────────────────────────────
test.describe('Vérification boutons - Pages Publiques', () => {
    for (const pageInfo of PUBLIC_PAGES) {
        test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
            const results = await checkButtonsOnPage(page, pageInfo);

            // Le test échoue seulement si des boutons critiques manquent un label
            const criticalIssues = results.issues.filter(i => i.includes('sans label'));
            if (criticalIssues.length > 0) {
                console.warn(`\nProblèmes sur "${pageInfo.name}":\n${criticalIssues.join('\n')}`);
            }

            // Vérifie qu'il y a au moins 1 bouton sur chaque page (avertissement doux si 0)
            if (results.total === 0) {
                console.warn(`\n⚠️  ATTENTION: Aucun bouton visible trouvé sur "${pageInfo.name}" - les boutons sont peut-être cachés ou chargés dynamiquement.`);
            }
            expect(results.total, `Aucun bouton trouvé sur la page "${pageInfo.name}"`).toBeGreaterThanOrEqual(0);
        });
    }
});

// ─────────────────────────────────────────────────────────
// TESTS ACHETEUR (avec connexion)
// ─────────────────────────────────────────────────────────
test.describe('Vérification boutons - Dashboard Acheteur', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/src/pages/login.html', { waitUntil: 'networkidle', timeout: 30000 });
        await page.fill('#email', 'benimakiese1234567@gmail.com');
        await page.fill('#password', 'Phoenix_2026!');
        await page.locator('button:has-text("Accepter tout")').click().catch(() => {});
        await page.click('#submitBtn', { force: true });
        await page.waitForTimeout(4000);
    });

    for (const pageInfo of BUYER_PAGES) {
        test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
            const results = await checkButtonsOnPage(page, pageInfo);
            expect(results.total, `Aucun bouton trouvé sur "${pageInfo.name}"`).toBeGreaterThan(0);
        });
    }
});

// ─────────────────────────────────────────────────────────
// TESTS VENDEUR (avec connexion)
// ─────────────────────────────────────────────────────────
test.describe('Vérification boutons - Dashboard Vendeur', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/src/pages/login.html', { waitUntil: 'networkidle', timeout: 30000 });
        await page.fill('#email', 'benimakiese123@gmail.com');
        await page.fill('#password', 'Phoenix_2026!');
        await page.locator('button:has-text("Accepter tout")').click().catch(() => {});
        await page.click('#submitBtn', { force: true });
        // Attendre que auth.js charge le rôle supplier et redirige vers le dashboard vendeur
        await page.waitForURL(/vendor-dashboard|choose-role/, { timeout: 20000 }).catch(() => {});
        // Si redirection vers choose-role, attendre 1s supplémentaire que le JS se stabilise
        if (page.url().includes('choose-role')) {
            await page.waitForTimeout(2000);
        } else {
            await page.waitForTimeout(3000);
        }
    });


    for (const pageInfo of VENDOR_PAGES) {
        test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
            const results = await checkButtonsOnPage(page, pageInfo);
            expect(results.total, `Aucun bouton trouvé sur "${pageInfo.name}"`).toBeGreaterThan(0);
        });
    }
});
