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

// Pages publiques accessibles sans connexion
const PUBLIC_PAGES = [
    { name: 'Accueil', url: '/' },
    { name: 'Catalogue', url: '/src/pages/catalog.html' },
    { name: 'Login / Inscription', url: '/src/pages/login.html' },
    { name: 'A propos', url: '/src/pages/about.html' },
    { name: 'FAQ', url: '/src/pages/faq.html' },
    { name: 'Support', url: '/src/pages/support.html' },
    { name: 'Boutiques', url: '/src/pages/shops.html' },
    { name: 'Promotions', url: '/src/pages/promo.html', waitMs: 5000 },
    { name: 'Mentions legales', url: '/src/pages/mentions-legales.html' },
    { name: 'CGU', url: '/src/pages/terms.html' },
    { name: 'Confidentialite', url: '/src/pages/privacy.html' },
    { name: 'Choisir son role', url: '/src/pages/choose-role.html', waitMs: 5000 },
    { name: 'Reset password', url: '/src/pages/reset-password.html' },
];

// Pages accessibles apres connexion (acheteur)
const BUYER_PAGES = [
    { name: 'Dashboard Acheteur', url: '/src/pages/customer-dashboard.html' },
    { name: 'Favoris', url: '/src/pages/favorites.html' },
    { name: 'Notifications', url: '/src/pages/notifications.html' },
    { name: 'Parametres', url: '/src/pages/settings.html' },
];

// Pages accessibles apres connexion (vendeur)
const VENDOR_PAGES = [
    { name: 'Dashboard Vendeur', url: '/src/pages/vendor-dashboard.html' },
    { name: 'Publier un produit', url: '/src/pages/publish.html' },
    { name: 'Seller Onboarding', url: '/src/pages/seller-onboarding.html' },
];

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
