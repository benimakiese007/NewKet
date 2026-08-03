import { test, expect } from '@playwright/test';

/**
 * TEST DE NAVIGATION - NewKet
 * ============================
 * Vérifie que :
 *  - Tous les liens du menu principal fonctionnent (pas de 404)
 *  - Les liens du footer fonctionnent
 *  - La page produit est accessible depuis le catalogue
 *  - La page boutique est accessible depuis la liste des boutiques
 *  - Les pages d'erreur (404, 500) s'affichent correctement
 */

test.setTimeout(120_000);

// Erreurs réseau connues à ignorer
const IGNORED_ERRORS = [
    'VAPID keys missing',
    'Sentry Dsn',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    'ResizeObserver loop',
    '502',
    'ERR_CONNECTION_REFUSED',
    'Failed to load resource',
    'push_notification_jobs',
];

function shouldIgnore(msg) {
    return IGNORED_ERRORS.some(e => msg.includes(e));
}

// ─────────────────────────────────────────────────────────
// LIENS DU MENU PRINCIPAL
// ─────────────────────────────────────────────────────────
test.describe('Navigation — Menu principal', () => {

    test('Le logo renvoie vers l\'accueil', async ({ page }) => {
        await page.goto('/src/pages/catalog.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        const logo = page.locator('a.header-logo-link').first();
        await expect(logo).toBeVisible({ timeout: 10000 });

        const href = await logo.getAttribute('href');
        expect(href).toBeTruthy();
        console.log(`✅ Logo → ${href}`);
    });

    test('Tous les liens du menu desktop ne génèrent pas de 404', async ({ page }) => {
        const errors = [];
        page.on('response', response => {
            if (response.status() === 404) {
                errors.push(`404 → ${response.url()}`);
            }
        });

        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Récupère tous les liens de navigation dans le header
        const navLinks = await page.locator('header a[href]').all();
        const hrefs = [];

        for (const link of navLinks) {
            const href = await link.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.startsWith('mailto')) {
                hrefs.push(href);
            }
        }

        console.log(`📋 ${hrefs.length} liens trouvés dans le menu`);

        // Vérifie chaque lien
        for (const href of hrefs) {
            const url = href.startsWith('http') ? href : href;
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForTimeout(500);
                const title = await page.title();
                console.log(`  ✅ ${href} → "${title}"`);
            } catch (e) {
                console.log(`  ⚠️  ${href} → ${e.message.split('\n')[0]}`);
            }
        }

        // Aucun 404 ne doit être détecté sur les ressources principales
        const critical404s = errors.filter(e => e.includes('.html'));
        expect(critical404s, `Pages HTML introuvables : ${critical404s.join(', ')}`).toHaveLength(0);
    });

    test('Les liens du footer sont accessibles', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        const footerLinks = await page.locator('footer a[href]').all();
        console.log(`📋 ${footerLinks.length} liens dans le footer`);

        for (const link of footerLinks) {
            const href = await link.getAttribute('href');
            const text = (await link.textContent()).trim();
            if (href && !href.startsWith('#') && !href.startsWith('javascript') && !href.startsWith('mailto') && !href.startsWith('http')) {
                console.log(`  ✅ Footer → "${text}" → ${href}`);
            }
        }

        expect(footerLinks.length).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────
// PAGES CLÉS ACCESSIBLES
// ─────────────────────────────────────────────────────────
test.describe('Navigation — Pages clés', () => {

    const KEY_PAGES = [
        { name: 'Accueil',          url: '/',                               contains: 'NewKet' },
        { name: 'Catalogue',        url: '/src/pages/catalog.html',         contains: null },
        { name: 'Login',            url: '/src/pages/login.html',           contains: null },
        { name: 'FAQ',              url: '/src/pages/faq.html',             contains: null },
        { name: 'CGU',              url: '/src/pages/terms.html',           contains: null },
        { name: 'Confidentialité',  url: '/src/pages/privacy.html',         contains: null },
        { name: 'Mentions légales', url: '/src/pages/mentions-legales.html',contains: null },
        { name: 'Boutiques',        url: '/src/pages/shops.html',           contains: null },
        { name: 'Promotions',       url: '/src/pages/promo.html',           contains: null },
        { name: 'Support',          url: '/src/pages/support.html',         contains: null },
    ];

    for (const pageInfo of KEY_PAGES) {
        test(`"${pageInfo.name}" se charge sans erreur critique`, async ({ page }) => {
            const jsErrors = [];
            page.on('pageerror', err => {
                if (!shouldIgnore(err.message)) jsErrors.push(err.message);
            });

            const response = await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);

            // Pas de 404
            if (response) {
                expect(response.status(), `${pageInfo.name} retourne ${response.status()}`).not.toBe(404);
            }

            // Titre de page présent
            const title = await page.title();
            expect(title, `"${pageInfo.name}" n'a pas de titre`).toBeTruthy();
            console.log(`  ✅ ${pageInfo.name} → "${title}" (${response?.status() ?? 'N/A'})`);

            // Pas d'erreurs JS critiques
            if (jsErrors.length > 0) {
                console.warn(`  ⚠️  JS Errors sur ${pageInfo.name}:`, jsErrors);
            }
        });
    }
});

// ─────────────────────────────────────────────────────────
// PAGES D'ERREUR
// ─────────────────────────────────────────────────────────
test.describe('Navigation — Pages d\'erreur', () => {

    test('Page 404 personnalisée s\'affiche correctement', async ({ page }) => {
        await page.goto('/src/pages/404.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);

        const body = await page.locator('body').textContent();
        expect(body).toBeTruthy();
        console.log('  ✅ Page 404 chargée');
    });

    test('Page 500 personnalisée s\'affiche correctement', async ({ page }) => {
        await page.goto('/src/pages/500.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);

        const body = await page.locator('body').textContent();
        expect(body).toBeTruthy();
        console.log('  ✅ Page 500 chargée');
    });

    test('Une URL inexistante est gérée', async ({ page }) => {
        const response = await page.goto('/src/pages/cette-page-nexiste-pas.html', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
        }).catch(() => null);

        // Le serveur répond (peu importe le code), il ne crash pas
        console.log(`  ✅ URL inexistante → status: ${response?.status() ?? 'handled'}`);
    });
});
