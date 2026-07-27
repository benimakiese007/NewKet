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

Locator:  locator('button:has-text("Devis"), button:has-text("Détails")').first()
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button:has-text("Devis"), button:has-text("Détails")').first()
    8 × locator resolved to <button type="button" id="btnAcceptQuote" class="hidden flex-1 py-3 bg-black text-white font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 rounded-xl">…</button>
      - unexpected value "hidden"
    14 × locator resolved to <button type="button" onclick="(typeof openOrderModal === 'function') && openOrderModal('ORD_DA762F94E1_1785165100475')" class="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-black text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest hover:bg-gray-900 transition-colors whitespace-nowrap flex items-center gap-1.5">…</button>
       - unexpected value "hidden"

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
    - heading "Buyo Buyo" [level=2]
    - text: Standard
    - navigation:
      - link "Accueil":
        - /url: "#dashboard"
        - img
        - text: Accueil
      - link "Mes demandes et devis 6":
        - /url: "#orders"
        - img
        - text: Mes demandes et devis 6
      - link "Mes achats":
        - /url: "#purchases"
        - img
        - text: Mes achats
      - link "Mes Favoris":
        - /url: "#favorites"
        - img
        - text: Mes Favoris
      - link "Notifications":
        - /url: "#notifications"
        - img
        - text: Notifications
      - link "Paramètres":
        - /url: "#settings"
        - img
        - text: Paramètres
  - heading "Mes demandes et devis" [level=1]
  - text: "Demande #ORD_DA762F94E1_1785165100475"
  - img
  - text: Mwana Kwata 7/27/2026 À vous de jouer Devis livraison
  - img
  - img "Montre Rolex Submariner Acier"
  - text: "Montre Rolex Submariner Acier 1 article(s) 2 850 000 FC Demande #ORD_E00940A905_1785164404363"
  - img
  - text: Mwana Kwata 7/27/2026 À vous de jouer Devis livraison
  - img
  - img "Montre Rolex Submariner Acier"
  - text: "Montre Rolex Submariner Acier 1 article(s) 2 850 000 FC Demande #ORD_F9416B1A4C_1785164102597"
  - img
  - text: Mwana Kwata 7/27/2026 À vous de jouer Devis livraison
  - img
  - img "Montre Rolex Submariner Acier"
  - text: "Montre Rolex Submariner Acier 1 article(s) 2 850 000 FC Demande #ORD_581830C2B6_1785115641148 Mwana Kwata 7/27/2026 À vous de jouer Devis livraison"
  - img "Montre Rolex Submariner Acier"
  - text: "Montre Rolex Submariner Acier 1 article(s) 2 850 000 FC Demande #ORD_A573686CED_1785115265868 Mwana Kwata 7/27/2026 En attente"
  - img "Montre Rolex Submariner Acier"
  - text: "Montre Rolex Submariner Acier 1 article(s) 2 850 000 FC Demande #ORD_68ACF241F1_1784835157406 Mwana Kwata 7/23/2026 À vous de jouer Prêt pour paiement"
  - img "Robe de soirée bordeaux"
  - text: Robe de soirée bordeaux 1 article(s) 186 050 FC
```

# Test source

```ts
  61  |     await buyerPage.waitForSelector('#cartCheckoutBtn', { state: 'visible' });
  62  |     
  63  |     // Injecter une position par défaut dans le localStorage pour éviter l'erreur "Definissez d'abord la position"
  64  |     await buyerPage.evaluate(() => {
  65  |         localStorage.setItem('newketHomeLocation', JSON.stringify({lat: -4.4419, lng: 15.2663}));
  66  |         if (window.CartManager) window.CartManager.checkout();
  67  |     });
  68  | 
  69  |     // Attendre que le CheckoutModal s'ouvre et cliquer sur "Payer" (qui envoie la demande au vendeur)
  70  |     await buyerPage.waitForSelector('button:has-text("Payer")', { state: 'visible' });
  71  |     await buyerPage.click('button:has-text("Payer")');
  72  | 
  73  |     // On attend la fin de l'envoi (soit via une URL vers customer-dashboard, soit le message de succès)
  74  |     await Promise.race([
  75  |       buyerPage.waitForURL(url => url.href.includes('customer-dashboard.html'), { timeout: 15000 }),
  76  |       buyerPage.waitForSelector('text="Commande passée avec succès"', { timeout: 15000 })
  77  |     ]).catch(() => console.log('Acheteur : pas de redirection immédiate, on continue.'));
  78  |     
  79  |     // ==========================================
  80  |     // 2. VENDEUR : Connexion et soumission du devis
  81  |     // ==========================================
  82  |     await vendorPage.goto('/src/pages/login.html');
  83  |     await vendorPage.waitForLoadState('networkidle');
  84  | 
  85  |     await vendorPage.fill('#email', 'benimakiese123@gmail.com');
  86  |     await vendorPage.fill('#password', 'PHOENIX');
  87  |     await vendorPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
  88  |     await vendorPage.click('#submitBtn', { force: true });
  89  |     
  90  |     // Attente de la validation du login
  91  |     await vendorPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 });
  92  | 
  93  |     // Le vendeur va sur son dashboard
  94  |     await vendorPage.goto('/src/pages/vendor-dashboard.html');
  95  |     await vendorPage.waitForLoadState('networkidle');
  96  | 
  97  |     // Attendre que l'auth soit terminée (la classe "auth-loading" sur <html> bloque les clics sinon)
  98  |     await vendorPage.waitForFunction(
  99  |         () => !document.documentElement.classList.contains('auth-loading'),
  100 |         { timeout: 20000 }
  101 |     ).catch(() => console.log('auth-loading timeout, on continue quand même'));
  102 |     // Petite pause pour laisser le dashboard se rendre
  103 |     await vendorPage.waitForTimeout(1500);
  104 | 
  105 |     // Il clique sur l'onglet "Demandes et devis"
  106 |     await vendorPage.click('a[data-switch-vendor-tab="leads"]', { force: true });
  107 | 
  108 |     // Il cherche la demande en attente et clique sur "Proposer un devis" sur la carte (qui ouvre la modale de détails)
  109 |     const proposeQuoteBtnCard = vendorPage.locator('button:has-text("Proposer un devis")').first();
  110 |     await expect(proposeQuoteBtnCard).toBeVisible({ timeout: 10000 });
  111 |     await proposeQuoteBtnCard.click();
  112 | 
  113 |     // Puis il clique sur le bouton "Proposer un devis" à l'intérieur de la modale de détails pour ouvrir le formulaire de devis
  114 |     const proposeQuoteBtnModal = vendorPage.locator('#btnMarkDelivered');
  115 |     await expect(proposeQuoteBtnModal).toBeVisible({ timeout: 5000 });
  116 |     // On scroll vers le bas de la modale au cas où
  117 |     await proposeQuoteBtnModal.scrollIntoViewIfNeeded();
  118 |     await proposeQuoteBtnModal.click();
  119 | 
  120 |     // Remplissage du formulaire de devis (modal de devis)
  121 |     // On efface d'abord les valeurs par défaut puis on saisit les nouvelles
  122 |     await vendorPage.fill('[data-quote-fee]', '');
  123 |     await vendorPage.fill('[data-quote-fee]', '5000'); // 5000 FC de frais de livraison
  124 |     await vendorPage.fill('[data-quote-delay]', '');
  125 |     await vendorPage.fill('[data-quote-delay]', '48'); // 48 heures de délai
  126 |     await vendorPage.fill('[data-quote-note]', 'Test automatisé: Frais de port standards');
  127 | 
  128 |     // On intercepte la réponse API avant de cliquer, pour s'assurer que l'appel réussit
  129 |     const quoteResponsePromise = vendorPage.waitForResponse(
  130 |         res => res.url().includes('/quote') && [200, 201].includes(res.status()),
  131 |         { timeout: 20000 }
  132 |     ).catch(() => null);
  133 | 
  134 |     await vendorPage.click('[data-quote-submit]');
  135 | 
  136 |     // Attendre la fermeture du formulaire (il se supprime du DOM après soumission)
  137 |     await vendorPage.waitForSelector('[data-quote-submit]', { state: 'detached', timeout: 10000 }).catch(() => {});
  138 | 
  139 |     // Attendre la réponse API
  140 |     await quoteResponsePromise;
  141 | 
  142 |     // Attendre que le dashboard se re-render (l'event ordersUpdated déclenche renderVendorLeads)
  143 |     await vendorPage.waitForTimeout(2500);
  144 | 
  145 |     // Basculer sur l'onglet "Attente client" car la commande n'est plus dans "À traiter"
  146 |     await vendorPage.click('#vFilterAwaiting');
  147 |     await vendorPage.waitForTimeout(1000);
  148 | 
  149 |     // Le statut de la commande est maintenant QUOTE : le bouton doit afficher "Modifier devis"
  150 |     await expect(vendorPage.locator('button:has-text("Modifier devis")').first()).toBeVisible({ timeout: 20000 });
  151 | 
  152 |     // ==========================================
  153 |     // 3. ACHETEUR : Accepte le devis et paie
  154 |     // ==========================================
  155 |     // L'acheteur consulte ses demandes
  156 |     await buyerPage.goto('/src/pages/customer-dashboard.html');
  157 |     await buyerPage.click('a[data-switch-customer-tab="orders"]'); // ou équivalent pour voir les demandes
  158 | 
  159 |     // Il ouvre le détail de la commande
  160 |     const detailBtn = buyerPage.locator('button:has-text("Devis"), button:has-text("Détails")').first();
> 161 |     await expect(detailBtn).toBeVisible({ timeout: 10000 });
      |                             ^ Error: expect(locator).toBeVisible() failed
  162 |     await detailBtn.click();
  163 | 
  164 |     // L'acheteur accepte le devis
  165 |     const acceptQuoteBtn = buyerPage.locator('button:has-text("Accepter le devis")');
  166 |     await expect(acceptQuoteBtn).toBeVisible({ timeout: 10000 });
  167 |     await acceptQuoteBtn.click();
  168 | 
  169 |     // Vérification que le devis est accepté (le bouton payer devrait apparaître)
  170 |     const payBtn = buyerPage.locator('button:has-text("Payer")').first();
  171 |     await expect(payBtn).toBeVisible({ timeout: 10000 });
  172 |     // await payBtn.click(); // On s'arrête avant le vrai paiement externe pour ne pas bloquer le test
  173 | 
  174 |     // Fin des contextes
  175 |     await buyerContext.close();
  176 |     await vendorContext.close();
  177 |   });
  178 | 
  179 | });
  180 | 
```