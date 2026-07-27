# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: order-quote-flow.spec.js >> Flux complet : Commande -> Devis vendeur -> Paiement (Multi-Acteurs) >> L'acheteur demande un devis, le vendeur répond, l'acheteur paie
- Location: tests\e2e\order-quote-flow.spec.js:12:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:5173/src/pages/login.html"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - navigation [ref=f2e2]:
    - generic [ref=f2e3]:
      - link [ref=f2e4] [cursor=pointer]:
        - /url: /index.html
        - img "NewKet" [ref=f2e5]
      - generic [ref=f2e6]: Sécurisé
  - generic [ref=f2e13]:
    - generic [ref=f2e14]:
      - img "NewKet Experience" [ref=f2e15]
      - generic [ref=f2e16]:
        - heading "Découvrez l'expérience ultime." [level=1] [ref=f2e17]
        - paragraph [ref=f2e18]: Rejoignez des milliers d'acheteurs et de vendeurs. Une plateforme pensée pour la performance et le raffinement.
        - generic [ref=f2e19]:
          - generic [ref=f2e20]:
            - img "User" [ref=f2e21]
            - img "User" [ref=f2e22]
            - img "User" [ref=f2e23]
            - generic [ref=f2e24]: "+10"
          - generic [ref=f2e25]: Utilisateurs
    - generic [ref=f2e26]:
      - generic: Mise à jour...
      - main [ref=f2e27]:
        - generic [ref=f2e28]:
          - generic [ref=f2e29]:
            - heading "Bienvenue" [level=2] [ref=f2e30]
            - paragraph [ref=f2e31]: Veuillez renseigner vos identifiants.
          - generic [ref=f2e32]:
            - button [ref=f2e33] [cursor=pointer]
            - button [ref=f2e38] [cursor=pointer]
          - generic [ref=f2e44]:
            - generic [ref=f2e45]:
              - textbox "Adresse email" [ref=f2e46]:
                - /placeholder: " "
              - generic: Adresse email
            - generic [ref=f2e52]:
              - textbox "Mot de passe" [ref=f2e53]:
                - /placeholder: " "
              - generic: Mot de passe
              - button [ref=f2e54] [cursor=pointer]
            - generic [ref=f2e60]:
              - generic [ref=f2e61] [cursor=pointer]:
                - checkbox "Se souvenir de moi" [ref=f2e62]
                - generic [ref=f2e63]: Se souvenir de moi
              - button [ref=f2e64] [cursor=pointer]
            - button "Se connecter" [ref=f2e68] [cursor=pointer]
          - generic [ref=f2e73]: Ou continuer avec
          - generic [ref=f2e78]:
            - button "Se connecter avec Google" [ref=f2e79] [cursor=pointer]:
              - generic [ref=f2e87]: Google
            - button "Se connecter avec Passkey" [ref=f2e88] [cursor=pointer]:
              - generic [ref=f2e93]: Passkey
  - dialog "Préférences de cookies" [ref=f2e94]:
    - generic [ref=f2e95]:
      - generic [ref=f2e96]:
        - paragraph [ref=f2e97]: 🍪 Nous respectons votre vie privée
        - paragraph [ref=f2e98]:
          - text: Nous utilisons des cookies pour améliorer votre expérience. Voir notre
          - link "politique de confidentialité" [ref=f2e99] [cursor=pointer]:
            - /url: /pages/privacy
          - text: .
      - generic [ref=f2e100]:
        - button "Personnaliser" [ref=f2e101] [cursor=pointer]
        - button "Refuser tout" [ref=f2e102] [cursor=pointer]
        - button "Accepter tout ✓" [ref=f2e103] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // /!\ ATTENTION: Pour que ce test fonctionne de bout en bout avec la base de données réelle,
  4   | // vous devez définir des variables d'environnement ou modifier ces constantes avec de vrais comptes.
  5   | const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'benimakiese1234567@gmail.com';
  6   | const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'PHOENIX';
  7   | const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL || 'benimakiese123@gmail.com';
  8   | const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'PHOENIX';
  9   | 
  10  | test.describe('Flux complet : Commande -> Devis vendeur -> Paiement (Multi-Acteurs)', () => {
  11  | 
  12  |   test('L\'acheteur demande un devis, le vendeur répond, l\'acheteur paie', async ({ browser }) => {
  13  |     
  14  |     // Création de deux contextes de navigation totalement séparés (comme deux ordinateurs différents)
  15  |     const buyerContext = await browser.newContext();
  16  |     const vendorContext = await browser.newContext();
  17  | 
  18  |     const buyerPage = await buyerContext.newPage();
  19  |     const vendorPage = await vendorContext.newPage();
  20  | 
  21  |     // ==========================================
  22  |     // 1. ACHETEUR : Connexion et ajout au panier
  23  |     // ==========================================
  24  |     await buyerPage.goto('/src/pages/login.html');
  25  |     await buyerPage.waitForLoadState('networkidle'); // Crucial: attend que le JS s'attache
  26  | 
  27  |     await buyerPage.fill('#email', BUYER_EMAIL);
  28  |     await buyerPage.fill('#password', BUYER_PASSWORD);
  29  |     await buyerPage.click('#submitBtn');
  30  |     
  31  |     // On attend d'être redirigé vers le catalogue ou le dashboard, ou de voir une erreur
  32  |     await Promise.race([
> 33  |       buyerPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 }),
      |                 ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  34  |       buyerPage.waitForFunction(() => {
  35  |         const err = document.querySelector('#formError');
  36  |         return err && !err.classList.contains('hidden') && err.textContent.length > 0;
  37  |       }, { timeout: 15000 }).then(async () => {
  38  |         const errorText = await buyerPage.locator('#formError').textContent();
  39  |         throw new Error(`Erreur de connexion Acheteur: ${errorText}`);
  40  |       })
  41  |     ]);
  42  | 
  43  |     // L'acheteur va sur le catalogue et ajoute le premier produit au panier
  44  |     await buyerPage.goto('/src/pages/catalog.html');
  45  |     await buyerPage.waitForLoadState('networkidle');
  46  |     await buyerPage.waitForSelector('.product-card button.add-to-cart-btn', { state: 'visible' });
  47  |     await buyerPage.click('.product-card button.add-to-cart-btn >> nth=0');
  48  | 
  49  |     // Attendre que le panier s'ouvre
  50  |     // On ouvre le panneau latéral du panier (car l'ajout fait juste une animation)
  51  |     await buyerPage.evaluate(() => {
  52  |         if (window.CartManager) window.CartManager.toggleCartUI(true);
  53  |     });
  54  |     
  55  |     // Attendre le bouton Checkout et cliquer (force: true pour éviter que la bannière de cookies ne bloque le clic)
  56  |     await buyerPage.waitForSelector('#cartCheckoutBtn', { state: 'visible' });
  57  |     await buyerPage.click('#cartCheckoutBtn', { force: true });
  58  | 
  59  |     // Attendre que le CheckoutModal s'ouvre et cliquer sur "Payer" (qui envoie la demande au vendeur)
  60  |     await buyerPage.waitForSelector('button:has-text("Payer")', { state: 'visible' });
  61  |     await buyerPage.click('button:has-text("Payer")');
  62  | 
  63  |     // On attend la fin de l'envoi (soit via une URL vers customer-dashboard, soit le message de succès)
  64  |     await Promise.race([
  65  |       buyerPage.waitForURL(url => url.href.includes('customer-dashboard.html'), { timeout: 15000 }),
  66  |       buyerPage.waitForSelector('text="Commande passée avec succès"', { timeout: 15000 })
  67  |     ]).catch(() => console.log('Acheteur : pas de redirection immédiate, on continue.'));
  68  |     
  69  |     // ==========================================
  70  |     // 2. VENDEUR : Connexion et soumission du devis
  71  |     // ==========================================
  72  |     await vendorPage.goto('/src/pages/login.html');
  73  |     await vendorPage.waitForLoadState('networkidle');
  74  | 
  75  |     await vendorPage.fill('#email', VENDOR_EMAIL);
  76  |     await vendorPage.fill('#password', VENDOR_PASSWORD);
  77  |     await vendorPage.click('#submitBtn');
  78  |     
  79  |     // Attente de la validation du login
  80  |     await vendorPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 });
  81  | 
  82  |     // Le vendeur va sur son dashboard
  83  |     await vendorPage.goto('/src/pages/vendor-dashboard.html');
  84  |     await vendorPage.waitForLoadState('networkidle');
  85  | 
  86  |     // Il clique sur l'onglet "Demandes et devis"
  87  |     await vendorPage.click('a[data-switch-vendor-tab="leads"]');
  88  | 
  89  |     // Il cherche la demande en attente et clique sur "Proposer un devis"
  90  |     const proposeQuoteBtn = vendorPage.locator('button:has-text("Proposer un devis")').first();
  91  |     await expect(proposeQuoteBtn).toBeVisible({ timeout: 10000 });
  92  |     await proposeQuoteBtn.click();
  93  | 
  94  |     // Remplissage du formulaire de devis (modal)
  95  |     await vendorPage.fill('[data-quote-fee]', '50'); // 50 de frais de livraison
  96  |     await vendorPage.fill('[data-quote-delay]', '48'); // 48 heures de délai
  97  |     await vendorPage.fill('[data-quote-note]', 'Test automatisé: Frais de port standards');
  98  |     await vendorPage.click('[data-quote-submit]');
  99  | 
  100 |     // On s'assure que l'envoi a réussi (le bouton repasse peut-être à "Modifier devis")
  101 |     await expect(vendorPage.locator('button:has-text("Modifier devis")').first()).toBeVisible({ timeout: 10000 });
  102 | 
  103 |     // ==========================================
  104 |     // 3. ACHETEUR : Accepte le devis et paie
  105 |     // ==========================================
  106 |     // L'acheteur consulte ses demandes
  107 |     await buyerPage.goto('/src/pages/customer-dashboard.html');
  108 |     await buyerPage.click('a[data-switch-customer-tab="orders"]'); // ou équivalent pour voir les demandes
  109 | 
  110 |     // Il ouvre le détail de la commande
  111 |     const detailBtn = buyerPage.locator('button:has-text("Devis"), button:has-text("Détails")').first();
  112 |     await expect(detailBtn).toBeVisible({ timeout: 10000 });
  113 |     await detailBtn.click();
  114 | 
  115 |     // L'acheteur accepte le devis
  116 |     const acceptQuoteBtn = buyerPage.locator('button:has-text("Accepter le devis")');
  117 |     await expect(acceptQuoteBtn).toBeVisible({ timeout: 10000 });
  118 |     await acceptQuoteBtn.click();
  119 | 
  120 |     // Vérification que le devis est accepté (le bouton payer devrait apparaître)
  121 |     const payBtn = buyerPage.locator('button:has-text("Payer")').first();
  122 |     await expect(payBtn).toBeVisible({ timeout: 10000 });
  123 |     // await payBtn.click(); // On s'arrête avant le vrai paiement externe pour ne pas bloquer le test
  124 | 
  125 |     // Fin des contextes
  126 |     await buyerContext.close();
  127 |     await vendorContext.close();
  128 |   });
  129 | 
  130 | });
  131 | 
```