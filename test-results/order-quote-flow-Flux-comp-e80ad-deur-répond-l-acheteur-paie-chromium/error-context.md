# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: order-quote-flow.spec.js >> Flux complet : Commande -> Devis vendeur -> Paiement (Multi-Acteurs) >> L'acheteur demande un devis, le vendeur répond, l'acheteur paie
- Location: tests\e2e\order-quote-flow.spec.js:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Modifier devis")').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button:has-text("Modifier devis")').first()

```

```yaml
- navigation:
  - button:
    - img
  - link "Accueil NewKet":
    - /url: /
    - img "NewKet Logo"
  - button:
    - img
- main:
  - complementary:
    - button "Réduire le menu":
      - img
    - paragraph: Ma Boutique
    - heading "Mwana Kwata" [level=2]
    - navigation:
      - link "Tableau de bord":
        - /url: "#dashboard"
      - link "Analyses & Stats":
        - /url: "#analytics"
      - link "Publier un article":
        - /url: /src/pages/publish.html
      - link "Mes Produits":
        - /url: "#products"
      - link "Demandes et devis clients":
        - /url: "#leads"
        - text: Demandes et devis 1
      - link "Mes Achats":
        - /url: "#purchases"
      - link "Codes promo":
        - /url: "#promos"
      - link "Paiements":
        - /url: "#payouts"
      - link "Paramètres":
        - /url: "#settings"
  - heading "Demandes clients" [level=2]
  - paragraph: Filtre “À traiter” = demandes qui nécessitent une action.
  - button "À traiter 1" [pressed]
  - button "Attente client"
  - button "En Livraison"
  - button "Terminé"
  - button "Litiges"
  - button "Tout"
  - img
  - paragraph: "1"
  - paragraph: À traiter
  - img
  - paragraph: "2"
  - paragraph: Attend client
  - img
  - paragraph: "0"
  - paragraph: En livraison
  - img
  - paragraph: "2"
  - paragraph: Terminées
  - img
  - paragraph: "0"
  - paragraph: Litiges
  - img
  - textbox "Rechercher par client ou produit..."
  - img
  - paragraph: Montre Rolex Submariner Acier
  - img
  - text: Buyo Buyo 7/27/2026
  - img
  - text: "+243990924250"
  - paragraph: 2 850 000 FC
  - text: À traiter À vous de jouer
  - button "Proposer un devis"
```

# Test source

```ts
  18  |     const buyerPage = await buyerContext.newPage();
  19  |     const vendorPage = await vendorContext.newPage();
  20  | 
  21  |     // ==========================================
  22  |     // 1. ACHETEUR : Connexion et ajout au panier
  23  |     // ==========================================
  24  |     await buyerPage.goto('/src/pages/login.html');
  25  |     await buyerPage.waitForLoadState('networkidle'); // Crucial: attend que le JS s'attache
  26  | 
  27  |     await buyerPage.fill('#email', 'benimakiese1234567@gmail.com');
  28  |     await buyerPage.fill('#password', 'PHOENIX');
  29  |     // Accepter les cookies si présents
  30  |     await buyerPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
  31  |     await buyerPage.click('#submitBtn', { force: true });
  32  |     
  33  |     // On attend d'être redirigé vers le catalogue ou le dashboard, ou de voir une erreur
  34  |     const loginResult = await Promise.race([
  35  |       buyerPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 }).then(() => 'success'),
  36  |       buyerPage.waitForFunction(() => {
  37  |         const err = document.querySelector('#formError');
  38  |         return err && !err.classList.contains('hidden') && err.textContent.length > 0;
  39  |       }, { timeout: 15000 }).then(() => 'error')
  40  |     ]).catch(() => 'timeout');
  41  | 
  42  |     if (loginResult === 'error') {
  43  |         const errorText = await buyerPage.locator('#formError').textContent();
  44  |         throw new Error('Acheteur login failed with error: ' + errorText);
  45  |     }
  46  | 
  47  |     // L'acheteur va sur le catalogue et ajoute le premier produit au panier
  48  |     await buyerPage.goto('/src/pages/catalog.html');
  49  |     await buyerPage.waitForLoadState('networkidle');
  50  |     await buyerPage.waitForSelector('.product-card button.add-to-cart-btn', { state: 'visible' });
  51  |     await buyerPage.click('.product-card button.add-to-cart-btn >> nth=0');
  52  | 
  53  |     // Attendre que le panier s'ouvre
  54  |     // On ouvre le panneau latéral du panier (car l'ajout fait juste une animation)
  55  |     await buyerPage.evaluate(() => {
  56  |         if (window.CartManager) window.CartManager.toggleCartUI(true);
  57  |     });
  58  |     
  59  |     // Attendre le bouton Checkout et forcer le checkout via le code
  60  |     await buyerPage.waitForSelector('#cartCheckoutBtn', { state: 'visible' });
  61  |     
  62  |     // Injecter une position par défaut dans le localStorage pour éviter l'erreur "Definissez d'abord la position"
  63  |     await buyerPage.evaluate(() => {
  64  |         localStorage.setItem('newketHomeLocation', JSON.stringify({lat: -4.4419, lng: 15.2663}));
  65  |         if (window.CartManager) window.CartManager.checkout();
  66  |     });
  67  | 
  68  |     // Attendre que le CheckoutModal s'ouvre et cliquer sur "Payer" (qui envoie la demande au vendeur)
  69  |     await buyerPage.waitForSelector('button:has-text("Payer")', { state: 'visible' });
  70  |     await buyerPage.click('button:has-text("Payer")');
  71  | 
  72  |     // On attend la fin de l'envoi (soit via une URL vers customer-dashboard, soit le message de succès)
  73  |     await Promise.race([
  74  |       buyerPage.waitForURL(url => url.href.includes('customer-dashboard.html'), { timeout: 15000 }),
  75  |       buyerPage.waitForSelector('text="Commande passée avec succès"', { timeout: 15000 })
  76  |     ]).catch(() => console.log('Acheteur : pas de redirection immédiate, on continue.'));
  77  |     
  78  |     // ==========================================
  79  |     // 2. VENDEUR : Connexion et soumission du devis
  80  |     // ==========================================
  81  |     await vendorPage.goto('/src/pages/login.html');
  82  |     await vendorPage.waitForLoadState('networkidle');
  83  | 
  84  |     await vendorPage.fill('#email', 'benimakiese123@gmail.com');
  85  |     await vendorPage.fill('#password', 'PHOENIX');
  86  |     await vendorPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
  87  |     await vendorPage.click('#submitBtn', { force: true });
  88  |     
  89  |     // Attente de la validation du login
  90  |     await vendorPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 });
  91  | 
  92  |     // Le vendeur va sur son dashboard
  93  |     await vendorPage.goto('/src/pages/vendor-dashboard.html');
  94  |     await vendorPage.waitForLoadState('networkidle');
  95  | 
  96  |     // Il clique sur l'onglet "Demandes et devis"
  97  |     await vendorPage.click('a[data-switch-vendor-tab="leads"]');
  98  | 
  99  |     // Il cherche la demande en attente et clique sur "Proposer un devis" sur la carte (qui ouvre la modale de détails)
  100 |     const proposeQuoteBtnCard = vendorPage.locator('button:has-text("Proposer un devis")').first();
  101 |     await expect(proposeQuoteBtnCard).toBeVisible({ timeout: 10000 });
  102 |     await proposeQuoteBtnCard.click();
  103 | 
  104 |     // Puis il clique sur le bouton "Proposer un devis" à l'intérieur de la modale de détails pour ouvrir le formulaire de devis
  105 |     const proposeQuoteBtnModal = vendorPage.locator('#btnMarkDelivered');
  106 |     await expect(proposeQuoteBtnModal).toBeVisible({ timeout: 5000 });
  107 |     // On scroll vers le bas de la modale au cas où
  108 |     await proposeQuoteBtnModal.scrollIntoViewIfNeeded();
  109 |     await proposeQuoteBtnModal.click();
  110 | 
  111 |     // Remplissage du formulaire de devis (modal de devis)
  112 |     await vendorPage.fill('[data-quote-fee]', '50'); // 50 de frais de livraison
  113 |     await vendorPage.fill('[data-quote-delay]', '48'); // 48 heures de délai
  114 |     await vendorPage.fill('[data-quote-note]', 'Test automatisé: Frais de port standards');
  115 |     await vendorPage.click('[data-quote-submit]');
  116 | 
  117 |     // On s'assure que l'envoi a réussi (le bouton repasse peut-être à "Modifier devis")
> 118 |     await expect(vendorPage.locator('button:has-text("Modifier devis")').first()).toBeVisible({ timeout: 10000 });
      |                                                                                   ^ Error: expect(locator).toBeVisible() failed
  119 | 
  120 |     // ==========================================
  121 |     // 3. ACHETEUR : Accepte le devis et paie
  122 |     // ==========================================
  123 |     // L'acheteur consulte ses demandes
  124 |     await buyerPage.goto('/src/pages/customer-dashboard.html');
  125 |     await buyerPage.click('a[data-switch-customer-tab="orders"]'); // ou équivalent pour voir les demandes
  126 | 
  127 |     // Il ouvre le détail de la commande
  128 |     const detailBtn = buyerPage.locator('button:has-text("Devis"), button:has-text("Détails")').first();
  129 |     await expect(detailBtn).toBeVisible({ timeout: 10000 });
  130 |     await detailBtn.click();
  131 | 
  132 |     // L'acheteur accepte le devis
  133 |     const acceptQuoteBtn = buyerPage.locator('button:has-text("Accepter le devis")');
  134 |     await expect(acceptQuoteBtn).toBeVisible({ timeout: 10000 });
  135 |     await acceptQuoteBtn.click();
  136 | 
  137 |     // Vérification que le devis est accepté (le bouton payer devrait apparaître)
  138 |     const payBtn = buyerPage.locator('button:has-text("Payer")').first();
  139 |     await expect(payBtn).toBeVisible({ timeout: 10000 });
  140 |     // await payBtn.click(); // On s'arrête avant le vrai paiement externe pour ne pas bloquer le test
  141 | 
  142 |     // Fin des contextes
  143 |     await buyerContext.close();
  144 |     await vendorContext.close();
  145 |   });
  146 | 
  147 | });
  148 | 
```