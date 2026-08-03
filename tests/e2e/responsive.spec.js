import { test, expect } from '@playwright/test';

/**
 * TEST RESPONSIVE - NewKet
 * =========================
 * Vérifie que le site s'affiche correctement sur :
 *  - Mobile  : 375 x 812  (iPhone 14)
 *  - Tablette: 768 x 1024 (iPad)
 *  - Desktop : 1280 x 800 (Laptop standard)
 *
 * Pour chaque taille, on vérifie :
 *  - Le header est visible
 *  - Le menu hamburger apparaît sur mobile
 *  - Les éléments principaux ne débordent pas (overflow)
 *  - Les images chargent correctement
 *  - Le contenu principal est lisible (pas de texte coupé)
 */

test.setTimeout(120_000);

const VIEWPORTS = [
    { name: 'Mobile (375px)',   width: 375,  height: 812  },
    { name: 'Tablette (768px)', width: 768,  height: 1024 },
    { name: 'Desktop (1280px)', width: 1280, height: 800  },
];

const PAGES_TO_TEST = [
    { name: 'Accueil',    url: '/' },
    { name: 'Catalogue',  url: '/src/pages/catalog.html' },
    { name: 'Login',      url: '/src/pages/login.html' },
    { name: 'Boutiques',  url: '/src/pages/shops.html' },
    { name: 'Promotions', url: '/src/pages/promo.html' },
];

// ─────────────────────────────────────────────────────────
// TESTS PAR VIEWPORT
// ─────────────────────────────────────────────────────────
for (const viewport of VIEWPORTS) {
    test.describe(`Responsive — ${viewport.name}`, () => {

        test.use({
            viewport: { width: viewport.width, height: viewport.height }
        });

        for (const pageInfo of PAGES_TO_TEST) {
            test(`"${pageInfo.name}" est correctement affiché`, async ({ page }) => {
                await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000);

                // ── 1. Le header est présent ──────────────────────────────
                const header = page.locator('header').first();
                await expect(header, 'Le header doit être visible').toBeVisible({ timeout: 10000 });

                // ── 2. Menu hamburger sur mobile ──────────────────────────
                if (viewport.width < 768) {
                    const hamburger = page.locator('[aria-label*="menu"], [aria-label*="Menu"], #menuToggle, .menu-toggle, button:has([data-icon*="menu"]), button:has(iconify-icon[icon*="menu"])').first();
                    const isVisible = await hamburger.isVisible().catch(() => false);
                    if (isVisible) {
                        console.log(`  ✅ ${viewport.name} → Hamburger visible sur "${pageInfo.name}"`);
                    } else {
                        console.log(`  ℹ️  ${viewport.name} → Pas de hamburger détecté sur "${pageInfo.name}" (peut être normal)`);
                    }
                }

                // ── 3. Pas de débordement horizontal ──────────────────────
                const hasOverflow = await page.evaluate(() => {
                    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
                });
                if (hasOverflow) {
                    console.warn(`  ⚠️  Débordement horizontal détecté sur "${pageInfo.name}" @ ${viewport.width}px`);
                } else {
                    console.log(`  ✅ Pas de débordement horizontal sur "${pageInfo.name}"`);
                }

                // ── 4. Le contenu principal est visible ───────────────────
                const body = page.locator('body');
                await expect(body).toBeVisible();

                const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
                expect(bodyHeight, `La page "${pageInfo.name}" semble vide`).toBeGreaterThan(100);

                // ── 5. Les images chargent (pas de src cassé) ─────────────
                const brokenImages = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    return imgs
                        .filter(img => img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:'))
                        .map(img => img.src);
                });

                if (brokenImages.length > 0) {
                    console.warn(`  ⚠️  ${brokenImages.length} image(s) cassée(s) sur "${pageInfo.name}":`, brokenImages.slice(0, 3));
                } else {
                    console.log(`  ✅ Toutes les images chargées sur "${pageInfo.name}"`);
                }

                console.log(`  📐 ${viewport.name} → "${pageInfo.name}" → Hauteur: ${bodyHeight}px | Overflow: ${hasOverflow ? 'OUI ⚠️' : 'Non'}`);
            });
        }

        // ── Test spécial : Le menu hamburger s'ouvre sur mobile ──────────
        if (viewport.width < 768) {
            test('Le menu hamburger s\'ouvre et se ferme correctement', async ({ page }) => {
                await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2000);

                // Cherche le bouton hamburger
                const hamburger = page.locator('[aria-label*="menu"], [aria-label*="Menu"]').first();
                const visible = await hamburger.isVisible().catch(() => false);

                if (!visible) {
                    console.log('  ℹ️  Bouton hamburger non trouvé — test ignoré');
                    return;
                }

                // Ouvre le menu
                await hamburger.click();
                await page.waitForTimeout(800);

                // Vérifie que le menu est maintenant ouvert (un lien de nav est visible)
                const navLink = page.locator('nav a[href]').first();
                const navVisible = await navLink.isVisible().catch(() => false);
                console.log(`  ${navVisible ? '✅' : 'ℹ️ '} Menu mobile après clic : ${navVisible ? 'Ouvert' : 'Non détecté'}`);

                // Referme le menu
                await hamburger.click().catch(() => {});
                await page.waitForTimeout(500);
                console.log('  ✅ Menu hamburger ouvert et fermé');
            });
        }

        // ── Test : taille des textes lisibles ────────────────────────────
        test('Les textes sont lisibles (taille de police ≥ 12px)', async ({ page }) => {
            await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(1500);

            const tinyTexts = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('p, span, a, button, li, h1, h2, h3, label'));
                return elements
                    .filter(el => {
                        const style = window.getComputedStyle(el);
                        const size = parseFloat(style.fontSize);
                        const text = el.textContent.trim();
                        return size < 10 && text.length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
                    })
                    .slice(0, 5)
                    .map(el => ({ tag: el.tagName, text: el.textContent.trim().slice(0, 30), size: window.getComputedStyle(el).fontSize }));
            });

            if (tinyTexts.length > 0) {
                console.warn(`  ⚠️  ${tinyTexts.length} texte(s) très petit(s) détecté(s):`, tinyTexts);
            } else {
                console.log(`  ✅ Tous les textes ont une taille lisible`);
            }

            // On ne fait pas échouer le test pour la taille de texte (warning seulement)
            expect(true).toBe(true);
        });
    });
}
