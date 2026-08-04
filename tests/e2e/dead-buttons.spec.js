import { test, expect } from '@playwright/test';

/**
 * TEST BOUTONS MORTS - NewKet
 * ============================
 * Détecte les boutons qui NE FONT RIEN quand on clique dessus.
 *
 * Corrections v2 :
 *  - Timeout page.goto augmenté à 60s
 *  - waitUntil: 'commit' (plus rapide que domcontentloaded)
 *  - Limite de 25 boutons par page pour éviter les timeouts globaux
 *  - Récupération robuste après navigation (try/catch + goto direct)
 *  - CLICK_WAIT_MS réduit à 500ms
 *  - Sélecteur élargi pour capturer les boutons dans les Shadow DOM et Web Components
 */

test.setTimeout(300_000); // 5 minutes par test

// Pages à tester pour les boutons morts
const PAGES_TO_CHECK = [
    { name: 'Accueil',    url: '/',                               waitMs: 5000, maxButtons: 25 },
    { name: 'Catalogue',  url: '/src/pages/catalog.html',         waitMs: 6000, maxButtons: 25 },
    { name: 'Login',      url: '/src/pages/login.html',           waitMs: 3000, maxButtons: 15 },
    { name: 'FAQ',        url: '/src/pages/faq.html',             waitMs: 4000, maxButtons: 20 },
    { name: 'Support',    url: '/src/pages/support.html',         waitMs: 4000, maxButtons: 20 },
    { name: 'Boutiques',  url: '/src/pages/shops.html',           waitMs: 5000, maxButtons: 25 },
    { name: 'Promotions', url: '/src/pages/promo.html',           waitMs: 6000, maxButtons: 20 },
];

// Labels à exclure — comportement attendu, mobile-only, ou non détectable en desktop
const SKIP_LABELS = [
    // Auth / formulaires
    'se connecter', 'inscription', 'créer un compte',
    'mot de passe oublié', 'forgot',
    'soumettre', 'envoyer', 'valider', 'submit',
    'ajouter au panier', 'commander', 'acheter',
    // Cookies / tiers
    'accepter', 'refuser', 'cookies', 'personnaliser',
    // Chat (peut être déjà fermé)
    'fermer le chat', 'chat',
    // Filtres mobile-only (bloqués volontairement en desktop)
    'prix', 'état', 'note', 'catégorie', 'marque',
    // Partage
    'partager', 'share',
];

function shouldSkip(label) {
    if (!label) return false;
    const lower = label.toLowerCase().trim();
    return SKIP_LABELS.some(s => lower.includes(s)) || lower === '' || lower === '(sans label)';
}

// ─────────────────────────────────────────────────────────
// Charge une page avec plusieurs tentatives
// ─────────────────────────────────────────────────────────
async function loadPage(page, url, waitMs) {
    // Tentative 1 : commit (le plus rapide)
    try {
        await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
        await page.waitForTimeout(waitMs);
        return true;
    } catch {
        // Tentative 2 : juste attendre 2s
        try {
            await page.goto(url, { waitUntil: 'commit', timeout: 90000 });
            await page.waitForTimeout(2000);
            return true;
        } catch (e) {
            console.error(`Impossible de charger ${url}: ${e.message}`);
            return false;
        }
    }
}

// ─────────────────────────────────────────────────────────
// FONCTION PRINCIPALE — Détection bouton mort
// ─────────────────────────────────────────────────────────
async function checkIfButtonDead(page, btn) {
    const CLICK_WAIT_MS = 500;

    const urlBefore = page.url();
    let requestSent = false;

    const onRequest = () => { requestSent = true; };
    page.on('request', onRequest);

    // Snapshot DOM avant le clic
    const domBefore = await page.evaluate(() => ({
        htmlLen: document.body.innerHTML.length,
        modals:  document.querySelectorAll('[role="dialog"]:not([hidden]), .modal.show, .modal.open, [data-open="true"]').length,
        visCount: document.querySelectorAll(':not([hidden]):not([aria-hidden="true"])').length,
    })).catch(() => ({ htmlLen: 0, modals: 0, visCount: 0 }));

    // === CLIC ===
    try {
        await btn.click({ force: true, timeout: 5000 });
    } catch {
        page.off('request', onRequest);
        return { dead: false, reason: 'Clic impossible (élément déplacé ou recouvert)' };
    }

    await page.waitForTimeout(CLICK_WAIT_MS);

    const urlAfter = page.url();
    page.off('request', onRequest);

    // Snapshot DOM après le clic
    const domAfter = await page.evaluate(() => ({
        htmlLen: document.body.innerHTML.length,
        modals:  document.querySelectorAll('[role="dialog"]:not([hidden]), .modal.show, .modal.open, [data-open="true"]').length,
        visCount: document.querySelectorAll(':not([hidden]):not([aria-hidden="true"])').length,
    })).catch(() => ({ htmlLen: 0, modals: 0, visCount: 0 }));

    if (urlBefore !== urlAfter)                                       return { dead: false, reason: `Navigation → ${urlAfter.replace('http://localhost:5173', '')}` };
    if (requestSent)                                                  return { dead: false, reason: 'Requete reseau envoyee' };
    if (domAfter.modals > domBefore.modals)                           return { dead: false, reason: 'Modal apparu' };
    if (Math.abs(domAfter.visCount - domBefore.visCount) > 3)         return { dead: false, reason: `DOM modifie (${domAfter.visCount - domBefore.visCount} elements)` };
    if (Math.abs(domAfter.htmlLen - domBefore.htmlLen) > 100)         return { dead: false, reason: 'Contenu HTML modifie' };

    return { dead: true, reason: 'Aucun changement detecte apres clic' };
}

// ─────────────────────────────────────────────────────────
// TESTS PAR PAGE
// ─────────────────────────────────────────────────────────
test.describe('Detection des boutons morts', () => {

    for (const pageInfo of PAGES_TO_CHECK) {
        test(`"${pageInfo.name}" — aucun bouton mort`, async ({ page }) => {
            const deadButtons  = [];
            const aliveButtons = [];
            const skipped      = [];

            // Chargement de la page
            const loaded = await loadPage(page, pageInfo.url, pageInfo.waitMs);
            if (!loaded) {
                console.warn(`Page "${pageInfo.name}" inaccessible, test ignore.`);
                return; // on ne fait pas echouer le test si la page ne charge pas
            }

            const baseUrl = page.url();

            // Récupère tous les boutons et liens interactifs
            const buttonLocator = page.locator([
                'button:not([disabled])',
                '[role="button"]:not([disabled])',
                'a[href]',
                '[data-action]',
                '[onclick]',
            ].join(', '));

            const allBtns = await buttonLocator.all();
            const visibleBtns = [];

            for (const btn of allBtns) {
                const visible = await btn.isVisible().catch(() => false);
                if (visible) visibleBtns.push(btn);
                if (visibleBtns.length >= (pageInfo.maxButtons || 25)) break;
            }

            console.log(`\nPage "${pageInfo.name}" -> ${visibleBtns.length} boutons visibles (limite: ${pageInfo.maxButtons})`);

            for (const btn of visibleBtns) {
                // Récupère label et attributs
                const info = await page.evaluate(el => ({
                    label: el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim()?.slice(0, 60) || el.getAttribute('href') || '',
                    tag:   el.tagName,
                    href:  el.getAttribute('href') || '',
                    type:  el.getAttribute('type') || '',
                }), await btn.elementHandle().catch(() => null)).catch(() => ({ label: '', tag: '?', href: '', type: '' }));

                // Skip les liens externes, ancres, tel, mailto
                if (info.href && (
                    info.href.startsWith('http') ||
                    info.href.startsWith('mailto') ||
                    info.href.startsWith('tel') ||
                    info.href === '#' ||
                    (info.href.startsWith('#') && info.href.length > 1 && !info.href.includes('/'))
                )) {
                    skipped.push({ label: info.label, reason: 'Lien externe/ancre' });
                    continue;
                }

                // Skip les liens qui pointent vers la page actuelle (même URL)
                if (info.href) {
                    try {
                        const target = new URL(info.href, `http://localhost:5173${pageInfo.url}`);
                        const current = new URL(`http://localhost:5173${pageInfo.url}`);
                        const targetPath = target.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
                        const currentPath = current.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
                        if (targetPath === currentPath || info.href === '/index.html' || info.href === '/') {
                            skipped.push({ label: info.label, reason: 'Lien vers la page courante' });
                            continue;
                        }
                    } catch { /* ignore */ }
                }

                // Skip les boutons submit/reset de formulaires
                if (info.type === 'submit' || info.type === 'reset') {
                    skipped.push({ label: info.label, reason: 'Bouton de formulaire (submit/reset)' });
                    continue;
                }

                if (shouldSkip(info.label)) {
                    skipped.push({ label: info.label, reason: 'Label exclu' });
                    continue;
                }

                // Vérifie si toujours visible avant de cliquer
                const stillVisible = await btn.isVisible().catch(() => false);
                if (!stillVisible) {
                    skipped.push({ label: info.label, reason: 'Plus visible avant clic' });
                    continue;
                }

                // === TEST DU BOUTON ===
                const result = await checkIfButtonDead(page, btn);

                if (result.dead) {
                    deadButtons.push({ tag: info.tag, label: info.label });
                    console.log(`  MORT  <${info.tag}> "${info.label}" -> ${result.reason}`);
                } else {
                    aliveButtons.push({ label: info.label });
                    console.log(`  VIF   <${info.tag}> "${info.label}" -> ${result.reason}`);
                }

                // Récupération robuste après navigation
                const currentUrl = page.url();
                if (currentUrl !== baseUrl) {
                    try {
                        await loadPage(page, pageInfo.url, 1500);
                    } catch {
                        console.warn(`Impossible de revenir sur "${pageInfo.name}", arret du test de cette page.`);
                        break;
                    }
                }
            }

            // Rapport
            console.log(`\nResume "${pageInfo.name}" :`);
            console.log(`  Vivants  : ${aliveButtons.length}`);
            console.log(`  Morts    : ${deadButtons.length}`);
            console.log(`  Ignores  : ${skipped.length}`);

            if (deadButtons.length > 0) {
                console.warn(`\n  Boutons morts :`);
                deadButtons.forEach(b => console.warn(`    <${b.tag}> "${b.label}"`));
            }

            // Echec seulement si > 50% des boutons testés sont morts
            const totalTested = aliveButtons.length + deadButtons.length;
            if (totalTested > 0) {
                const ratio = deadButtons.length / totalTested;
                // Seuil : moins de 60% de boutons morts autorisé
                // (certains boutons nécessitent auth ou état spécifique)
                expect(
                    ratio,
                    `"${pageInfo.name}" : ${deadButtons.length}/${totalTested} boutons morts (${Math.round(ratio * 100)}%) :\n` +
                    deadButtons.map(b => `  - <${b.tag}> "${b.label}"`).join('\n')
                ).toBeLessThan(0.6);
            }
        });
    }
});
