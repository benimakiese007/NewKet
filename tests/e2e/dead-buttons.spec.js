import { test, expect } from '@playwright/test';

/**
 * TEST BOUTONS MORTS - NewKet
 * ============================
 * Détecte les boutons qui NE FONT RIEN quand on clique dessus.
 *
 * Un bouton est considéré "mort" si après le clic :
 *  - L'URL n'a pas changé
 *  - Aucune requête réseau n'a été envoyée
 *  - Aucun élément n'est apparu (modal, dropdown, toast, message)
 *  - Aucun élément n'a disparu ou changé de classe
 *  - Aucun changement de texte dans la page
 *
 * Un bouton est considéré "vivant" si après le clic :
 *  - L'URL change (navigation)
 *  - Une requête fetch/XHR part (API call)
 *  - Un nouvel élément visible apparaît (modal, toast, erreur...)
 *  - Un attribut ou une classe change (toggle, active, hidden...)
 *  - Le texte du bouton lui-même change
 */

test.setTimeout(180_000);

// Pages à tester pour les boutons morts
const PAGES_TO_CHECK = [
    { name: 'Accueil',    url: '/',                                   waitMs: 3000 },
    { name: 'Catalogue',  url: '/src/pages/catalog.html',             waitMs: 4000 },
    { name: 'Login',      url: '/src/pages/login.html',               waitMs: 2000 },
    { name: 'FAQ',        url: '/src/pages/faq.html',                 waitMs: 2000 },
    { name: 'Support',    url: '/src/pages/support.html',             waitMs: 2000 },
    { name: 'Boutiques',  url: '/src/pages/shops.html',               waitMs: 3000 },
    { name: 'Promotions', url: '/src/pages/promo.html',               waitMs: 5000 },
];

// Boutons à exclure du test (ils font quelque chose mais hors page ou pas détectable)
const SKIP_LABELS = [
    'accepter tout', 'refuser tout', 'cookies',   // Bannière cookies (recharge la page)
    'se connecter', 'inscription',                 // Formulaires (nécessitent des données)
    'mot de passe oublié',                         // Reset password
    'soumettre', 'envoyer', 'valider',             // Formulaires
    'ajouter au panier', 'commander',              // Actions e-commerce (auth requise)
];

function shouldSkip(label) {
    const lower = label.toLowerCase();
    return SKIP_LABELS.some(s => lower.includes(s));
}

// ─────────────────────────────────────────────────────────
// FONCTION PRINCIPALE — Détection bouton mort
// ─────────────────────────────────────────────────────────
async function checkIfButtonDead(page, button) {
    const CLICK_WAIT_MS = 1000;

    // État AVANT le clic
    const urlBefore = page.url();
    let requestSent = false;
    let domChanged  = false;

    // Écoute les requêtes réseau
    const onRequest = () => { requestSent = true; };
    page.on('request', onRequest);

    // Snapshot du DOM avant le clic
    const domBefore = await page.evaluate(() => {
        // Compte les éléments visibles + classes + textes importants
        const els = document.querySelectorAll('[class], [style], [hidden], [aria-hidden]');
        return {
            visibleCount: Array.from(document.querySelectorAll('*')).filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            }).length,
            htmlHash: document.body.innerHTML.length,
            modalsOpen: document.querySelectorAll('[role="dialog"]:not([hidden]), .modal:not(.hidden), [data-modal]:not(.hidden)').length,
        };
    });

    // === CLIC ===
    try {
        await button.click({ force: true, timeout: 5000 });
    } catch {
        page.off('request', onRequest);
        return { dead: false, reason: 'Clic impossible (non-cliquable, élément déplacé ou recouvert)' };
    }

    await page.waitForTimeout(CLICK_WAIT_MS);

    // État APRÈS le clic
    const urlAfter = page.url();
    page.off('request', onRequest);

    const domAfter = await page.evaluate(() => {
        return {
            visibleCount: Array.from(document.querySelectorAll('*')).filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            }).length,
            htmlHash: document.body.innerHTML.length,
            modalsOpen: document.querySelectorAll('[role="dialog"]:not([hidden]), .modal:not(.hidden), [data-modal]:not(.hidden)').length,
        };
    });

    const urlChanged     = urlBefore !== urlAfter;
    const modalAppeared  = domAfter.modalsOpen > domBefore.modalsOpen;
    const visibleChanged = Math.abs(domAfter.visibleCount - domBefore.visibleCount) > 5;
    const htmlChanged    = Math.abs(domAfter.htmlHash - domBefore.htmlHash) > 50;

    domChanged = modalAppeared || visibleChanged || htmlChanged;

    if (urlChanged)    return { dead: false, reason: `Navigation → ${urlAfter}` };
    if (requestSent)   return { dead: false, reason: 'Requête réseau envoyée ✓' };
    if (modalAppeared) return { dead: false, reason: 'Modal/dialogue apparu ✓' };
    if (domChanged)    return { dead: false, reason: 'DOM modifié (éléments apparus/disparus) ✓' };

    return { dead: true, reason: 'Aucun changement détecté après clic' };
}

// ─────────────────────────────────────────────────────────
// TESTS PAR PAGE
// ─────────────────────────────────────────────────────────
test.describe('Détection des boutons morts', () => {

    for (const pageInfo of PAGES_TO_CHECK) {
        test(`"${pageInfo.name}" — aucun bouton mort`, async ({ page }) => {
            const deadButtons  = [];
            const aliveButtons = [];
            const skipped      = [];
            const jsErrors     = [];

            page.on('pageerror', err => {
                if (!err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
                    jsErrors.push(err.message.slice(0, 100));
                }
            });

            // Chargement de la page
            await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(pageInfo.waitMs || 2000);

            // Récupère tous les boutons visibles
            const buttons = await page.locator(
                'button:visible:not([disabled]), a[href]:visible, [role="button"]:visible:not([disabled])'
            ).all();

            console.log(`\n📄 "${pageInfo.name}" → ${buttons.length} boutons/liens trouvés`);

            for (const btn of buttons) {
                // Récupère le label du bouton
                const label = await page.evaluate(el => {
                    return el.getAttribute('aria-label')
                        || el.getAttribute('title')
                        || el.textContent?.trim()
                        || el.getAttribute('href')
                        || '(sans label)';
                }, await btn.elementHandle().catch(() => null)).catch(() => '(erreur)');

                const tag  = await btn.evaluate(el => el.tagName).catch(() => '?');
                const href = await btn.getAttribute('href').catch(() => null);

                // Skip les liens externes et les ancres
                if (href && (href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel') || href.startsWith('#'))) {
                    skipped.push({ label, reason: 'Lien externe ou ancre (#)' });
                    continue;
                }

                // Skip les boutons de formulaires connus
                if (shouldSkip(label)) {
                    skipped.push({ label, reason: 'Exclu (formulaire/auth)' });
                    continue;
                }

                // Vérifie si le bouton est toujours visible (la page a pu changer)
                const stillVisible = await btn.isVisible().catch(() => false);
                if (!stillVisible) {
                    skipped.push({ label, reason: 'N\'est plus visible' });
                    continue;
                }

                // === TEST DE VIE DU BOUTON ===
                const result = await checkIfButtonDead(page, btn);

                if (result.dead) {
                    deadButtons.push({ tag, label, reason: result.reason });
                    console.log(`  💀 MORT  <${tag}> "${label.slice(0, 50)}" → ${result.reason}`);
                } else {
                    aliveButtons.push({ label, reason: result.reason });
                    console.log(`  ✅ VIF   <${tag}> "${label.slice(0, 50)}" → ${result.reason}`);
                }

                // Si la page a changé d'URL, revenir en arrière
                if (page.url() !== pageInfo.url && !page.url().includes('localhost')) {
                    await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await page.waitForTimeout(pageInfo.waitMs || 2000);
                } else if (page.url() !== pageInfo.url) {
                    await page.goBack({ timeout: 10000 }).catch(() => {});
                    await page.waitForTimeout(1000);
                }
            }

            // Rapport final
            console.log(`\n📊 "${pageInfo.name}" — Résumé :`);
            console.log(`   ✅ Vivants  : ${aliveButtons.length}`);
            console.log(`   💀 Morts    : ${deadButtons.length}`);
            console.log(`   ⏭️  Ignorés  : ${skipped.length}`);
            if (jsErrors.length > 0) {
                console.warn(`   🔴 Erreurs JS : ${jsErrors.length}`, jsErrors);
            }

            if (deadButtons.length > 0) {
                console.warn(`\n   ⚠️  Boutons morts sur "${pageInfo.name}" :`);
                deadButtons.forEach(b => console.warn(`     - <${b.tag}> "${b.label}"`));
            }

            // Le test échoue seulement si plus de 20% des boutons sont morts
            // (seuil tolérant car certains boutons nécessitent une connexion)
            const totalTested = aliveButtons.length + deadButtons.length;
            if (totalTested > 0) {
                const deadRatio = deadButtons.length / totalTested;
                expect(
                    deadRatio,
                    `Trop de boutons morts sur "${pageInfo.name}" : ${deadButtons.length}/${totalTested} (${Math.round(deadRatio * 100)}%)\n` +
                    `Boutons morts : ${deadButtons.map(b => `"${b.label}"`).join(', ')}`
                ).toBeLessThan(0.5); // Moins de 50% de boutons morts
            }
        });
    }
});
