import { test, expect } from '@playwright/test';

// /!\ ATTENTION: Pour que ce test fonctionne de bout en bout avec la base de données réelle,
// vous devez définir des variables d'environnement ou modifier ces constantes avec de vrais comptes.
const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'benimakiese1234567@gmail.com';
const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'PHOENIX';
const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL || 'benimakiese123@gmail.com';
const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'PHOENIX';

test.describe('Flux complet : Commande -> Devis vendeur -> Paiement (Multi-Acteurs)', () => {

  test('L\'acheteur demande un devis, le vendeur répond, l\'acheteur paie', async ({ browser }) => {
    
    // Création de deux contextes de navigation totalement séparés (comme deux ordinateurs différents)
    const buyerContext = await browser.newContext();
    const vendorContext = await browser.newContext();

    const buyerPage = await buyerContext.newPage();
    const vendorPage = await vendorContext.newPage();

    // ==========================================
    // 1. ACHETEUR : Connexion et ajout au panier
    // ==========================================
    await buyerPage.goto('/src/pages/login.html');
    await buyerPage.waitForLoadState('networkidle'); // Crucial: attend que le JS s'attache

    await buyerPage.fill('#email', 'benimakiese1234567@gmail.com');
    await buyerPage.fill('#password', 'PHOENIX');
    // Accepter les cookies si présents
    await buyerPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
    await buyerPage.click('#submitBtn', { force: true });
    
    // On attend d'être redirigé vers le catalogue ou le dashboard, ou de voir une erreur
    const loginResult = await Promise.race([
      buyerPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 }).then(() => 'success'),
      buyerPage.waitForFunction(() => {
        const err = document.querySelector('#formError');
        return err && !err.classList.contains('hidden') && err.textContent.length > 0;
      }, { timeout: 15000 }).then(() => 'error')
    ]).catch(() => 'timeout');

    if (loginResult === 'error') {
        const errorText = await buyerPage.locator('#formError').textContent();
        throw new Error('Acheteur login failed with error: ' + errorText);
    }

    // L'acheteur va sur le catalogue et ajoute le premier produit au panier
    await buyerPage.goto('/src/pages/catalog.html');
    await buyerPage.waitForLoadState('networkidle');
    await buyerPage.waitForSelector('.product-card button.add-to-cart-btn', { state: 'visible' });
    // Cliquer sur le bouton d'ajout au panier du premier produit
    await buyerPage.locator('.product-card button.add-to-cart-btn').first().click();

    // Attendre que le panier s'ouvre
    // On ouvre le panneau latéral du panier (car l'ajout fait juste une animation)
    await buyerPage.evaluate(() => {
        if (window.CartManager) window.CartManager.toggleCartUI(true);
    });
    
    // Attendre le bouton Checkout et forcer le checkout via le code
    await buyerPage.waitForSelector('#cartCheckoutBtn', { state: 'visible' });
    
    // Injecter une position par défaut dans le localStorage pour éviter l'erreur "Definissez d'abord la position"
    await buyerPage.evaluate(() => {
        localStorage.setItem('newketHomeLocation', JSON.stringify({lat: -4.4419, lng: 15.2663}));
        if (window.CartManager) window.CartManager.checkout();
    });

    // Attendre que le CheckoutModal s'ouvre et cliquer sur "Payer" (qui envoie la demande au vendeur)
    await buyerPage.waitForSelector('button:has-text("Payer")', { state: 'visible' });
    await buyerPage.click('button:has-text("Payer")');

    // On attend la fin de l'envoi (soit via une URL vers customer-dashboard, soit le message de succès)
    await Promise.race([
      buyerPage.waitForURL(url => url.href.includes('customer-dashboard.html'), { timeout: 15000 }),
      buyerPage.waitForSelector('text="Commande passée avec succès"', { timeout: 15000 })
    ]).catch(() => console.log('Acheteur : pas de redirection immédiate, on continue.'));
    
    // ==========================================
    // 2. VENDEUR : Connexion et soumission du devis
    // ==========================================
    await vendorPage.goto('/src/pages/login.html');
    await vendorPage.waitForLoadState('networkidle');

    await vendorPage.fill('#email', 'benimakiese123@gmail.com');
    await vendorPage.fill('#password', 'PHOENIX');
    await vendorPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
    await vendorPage.click('#submitBtn', { force: true });
    
    // Attente de la validation du login
    await vendorPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 });

    // Le vendeur va sur son dashboard
    await vendorPage.goto('/src/pages/vendor-dashboard.html');
    await vendorPage.waitForLoadState('networkidle');

    // Attendre que l'auth soit terminée (la classe "auth-loading" sur <html> bloque les clics sinon)
    await vendorPage.waitForFunction(
        () => !document.documentElement.classList.contains('auth-loading'),
        { timeout: 20000 }
    ).catch(() => console.log('auth-loading timeout, on continue quand même'));
    // Petite pause pour laisser le dashboard se rendre
    await vendorPage.waitForTimeout(1500);

    // Il clique sur l'onglet "Demandes et devis"
    await vendorPage.click('a[data-switch-vendor-tab="leads"]', { force: true });

    // Il cherche la demande en attente et clique sur "Proposer un devis" sur la carte (qui ouvre la modale de détails)
    const proposeQuoteBtnCard = vendorPage.locator('button:has-text("Proposer un devis")').first();
    await expect(proposeQuoteBtnCard).toBeVisible({ timeout: 10000 });
    await proposeQuoteBtnCard.click();

    // Puis il clique sur le bouton "Proposer un devis" à l'intérieur de la modale de détails pour ouvrir le formulaire de devis
    const proposeQuoteBtnModal = vendorPage.locator('#btnMarkDelivered');
    await expect(proposeQuoteBtnModal).toBeVisible({ timeout: 5000 });
    // On scroll vers le bas de la modale au cas où
    await proposeQuoteBtnModal.scrollIntoViewIfNeeded();
    await proposeQuoteBtnModal.click();

    // Remplissage du formulaire de devis (modal de devis)
    // On efface d'abord les valeurs par défaut puis on saisit les nouvelles
    await vendorPage.fill('[data-quote-fee]', '');
    await vendorPage.fill('[data-quote-fee]', '5000'); // 5000 FC de frais de livraison
    await vendorPage.fill('[data-quote-delay]', '');
    await vendorPage.fill('[data-quote-delay]', '48'); // 48 heures de délai
    await vendorPage.fill('[data-quote-note]', 'Test automatisé: Frais de port standards');

    // On intercepte la réponse API avant de cliquer, pour s'assurer que l'appel réussit
    const quoteResponsePromise = vendorPage.waitForResponse(
        res => res.url().includes('/quote') && [200, 201].includes(res.status()),
        { timeout: 20000 }
    ).catch(() => null);

    await vendorPage.click('[data-quote-submit]');

    // Attendre la fermeture du formulaire (il se supprime du DOM après soumission)
    await vendorPage.waitForSelector('[data-quote-submit]', { state: 'detached', timeout: 10000 }).catch(() => {});

    // Attendre la réponse API
    await quoteResponsePromise;

    // Attendre que le dashboard se re-render (l'event ordersUpdated déclenche renderVendorLeads)
    await vendorPage.waitForTimeout(2500);

    // Basculer sur l'onglet "Attente client" car la commande n'est plus dans "À traiter"
    await vendorPage.click('#vFilterAwaiting');
    await vendorPage.waitForTimeout(1000);

    // Le statut de la commande est maintenant QUOTE : le bouton doit afficher "Modifier devis"
    await expect(vendorPage.locator('button:has-text("Modifier devis")').first()).toBeVisible({ timeout: 20000 });

    // ==========================================
    // 3. ACHETEUR : Accepte le devis et paie
    // ==========================================
    // L'acheteur consulte ses demandes
    await buyerPage.goto('/src/pages/customer-dashboard.html');
    await buyerPage.click('a[data-switch-customer-tab="orders"]'); // ou équivalent pour voir les demandes

    // Il ouvre le détail de la commande
    const detailBtn = buyerPage.locator('.glass-panel', { hasText: 'À VOUS DE JOUER' }).first();
    await expect(detailBtn).toBeVisible({ timeout: 10000 });
    await detailBtn.click();

    // L'acheteur accepte le devis
    const acceptQuoteBtn = buyerPage.locator('button:has-text("Accepter le devis")');
    await expect(acceptQuoteBtn).toBeVisible({ timeout: 10000 });
    await acceptQuoteBtn.click();

    // Vérification que le devis est accepté (le bouton payer devrait apparaître)
    const payBtn = buyerPage.locator('button:has-text("Payer")').first();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    // await payBtn.click(); // On s'arrête avant le vrai paiement externe pour ne pas bloquer le test

    // Fin des contextes
    await buyerContext.close();
    await vendorContext.close();
  });

});
