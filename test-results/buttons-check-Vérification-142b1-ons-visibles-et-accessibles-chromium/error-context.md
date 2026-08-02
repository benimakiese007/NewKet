# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: buttons-check.spec.js >> Vérification boutons - Pages Publiques >> Promotions — boutons visibles et accessibles
- Location: tests\e2e\buttons-check.spec.js:123:9

# Error details

```
Error: Aucun bouton trouvé sur la page "Promotions"

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - navigation [ref=f3e2]:
    - generic [ref=f3e3]:
      - generic [ref=f3e4]:
        - button "Ouvrir le menu" [ref=f3e6] [cursor=pointer]
        - link [ref=f3e11] [cursor=pointer]:
          - /url: /index.html
          - img "NewKet" [ref=f3e12]
      - generic [ref=f3e14]:
        - generic "Choisir une catégorie" [ref=f3e15] [cursor=pointer]: TOUT
        - textbox "Rechercher des produits" [ref=f3e20]:
          - /placeholder: Rechercher sur NewKet...
      - generic [ref=f3e21]:
        - generic "Devise d'affichage" [ref=f3e23] [cursor=pointer]:
          - generic [ref=f3e24]:
            - generic [ref=f3e26]: USD
            - generic [ref=f3e27]: CDF
        - link "Voir les notifications" [ref=f3e28] [cursor=pointer]:
          - /url: /src/pages/notifications.html
        - link "Voir les favoris" [ref=f3e34] [cursor=pointer]:
          - /url: /src/pages/favorites.html
        - button "Voir le panier" [ref=f3e38] [cursor=pointer]
        - link "Mon compte" [ref=f3e44] [cursor=pointer]:
          - /url: //src/pages/login.html
  - main [ref=f3e50]:
    - generic [ref=f3e52]:
      - generic [ref=f3e53]: Offres Limitees
      - heading "Le Luxe Accessible" [level=1] [ref=f3e54]
      - paragraph [ref=f3e55]: Decouvrez notre selection exclusive d'articles d'exception a prix reduits.
    - generic [ref=f3e56]:
      - complementary [ref=f3e57]:
        - generic [ref=f3e58]:
          - generic [ref=f3e59]:
            - heading "Categories" [level=3] [ref=f3e60]
            - generic [ref=f3e61]:
              - generic [ref=f3e62] [cursor=pointer]:
                - checkbox "Femme" [ref=f3e63]
                - generic [ref=f3e64]: Femme
              - generic [ref=f3e65] [cursor=pointer]:
                - checkbox "Homme" [ref=f3e66]
                - generic [ref=f3e67]: Homme
              - generic [ref=f3e68] [cursor=pointer]:
                - checkbox "Tech & Gadgets" [ref=f3e69]
                - generic [ref=f3e70]: Tech & Gadgets
              - generic [ref=f3e71] [cursor=pointer]:
                - checkbox "HIGH-TECH" [ref=f3e72]
                - generic [ref=f3e73]: HIGH-TECH
              - generic [ref=f3e74] [cursor=pointer]:
                - checkbox "Art de vivre" [ref=f3e75]
                - generic [ref=f3e76]: Art de vivre
          - separator [ref=f3e77]
          - generic [ref=f3e78]:
            - heading "Gamme de Prix" [level=3] [ref=f3e79]
            - generic [ref=f3e80]:
              - slider [ref=f3e81]: "0"
              - slider [ref=f3e82]: "250000000"
            - generic [ref=f3e83]:
              - spinbutton "0" [ref=f3e84]
              - spinbutton "Max" [ref=f3e85]
          - button "Réinitialiser tout" [ref=f3e86] [cursor=pointer]
      - generic [ref=f3e88]:
        - paragraph [ref=f3e89]: 0 offres disponibles
        - generic [ref=f3e91]:
          - combobox [ref=f3e92] [cursor=pointer]:
            - option "Plus Pertinents" [selected]
            - option "Prix Croissant"
            - option "Prix Décroissant"
            - option "Dernières pépites"
            - text: Filtres
          - option "Plus Pertinents" [ref=f3e93]
          - option "Prix Croissant" [ref=f3e94]
          - option "Prix Décroissant" [ref=f3e95]
          - option "Dernières pépites" [ref=f3e96]
```

# Test source

```ts
  33  | const BUYER_PAGES = [
  34  |     { name: 'Dashboard Acheteur', url: '/src/pages/customer-dashboard.html' },
  35  |     { name: 'Favoris', url: '/src/pages/favorites.html' },
  36  |     { name: 'Notifications', url: '/src/pages/notifications.html' },
  37  |     { name: 'Parametres', url: '/src/pages/settings.html' },
  38  | ];
  39  | 
  40  | // Pages accessibles apres connexion (vendeur)
  41  | const VENDOR_PAGES = [
  42  |     { name: 'Dashboard Vendeur', url: '/src/pages/vendor-dashboard.html' },
  43  |     { name: 'Publier un produit', url: '/src/pages/publish.html' },
  44  |     { name: 'Seller Onboarding', url: '/src/pages/seller-onboarding.html' },
  45  | ];
  46  | 
  47  | // Erreurs JS à ignorer (erreurs connues non liées aux boutons)
  48  | const IGNORED_ERRORS = [
  49  |     'VAPID keys missing',
  50  |     'Sentry Dsn',
  51  |     'Failed to fetch',
  52  |     'NetworkError',
  53  |     'AbortError',
  54  |     'ResizeObserver loop',
  55  |     'push_notification_jobs',
  56  |     'Failed to load search',
  57  | ];
  58  | 
  59  | function shouldIgnoreError(msg) {
  60  |     return IGNORED_ERRORS.some(ignore => msg.includes(ignore));
  61  | }
  62  | 
  63  | // ─────────────────────────────────────────────────────────
  64  | // HELPER: tester tous les boutons d'une page
  65  | // ─────────────────────────────────────────────────────────
  66  | async function checkButtonsOnPage(page, pageInfo) {
  67  |     const jsErrors = [];
  68  | 
  69  |     page.on('console', msg => {
  70  |         if (msg.type() === 'error' && !shouldIgnoreError(msg.text())) {
  71  |             jsErrors.push(msg.text());
  72  |         }
  73  |     });
  74  | 
  75  |     await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  76  |     await page.waitForTimeout(2000); // Laisse le JS se charger
  77  | 
  78  |     // Récupère tous les boutons et liens cliquables
  79  |     const buttons = page.locator('button:visible, a[href]:visible, [role="button"]:visible, input[type="submit"]:visible, input[type="button"]:visible');
  80  |     const count = await buttons.count();
  81  | 
  82  |     console.log(`\n📄 ${pageInfo.name} → ${count} boutons trouvés`);
  83  | 
  84  |     const results = { page: pageInfo.name, total: count, issues: [] };
  85  | 
  86  |     for (let i = 0; i < count; i++) {
  87  |         const btn = buttons.nth(i);
  88  | 
  89  |         // Récupère le texte/label du bouton
  90  |         const text = (await btn.innerText().catch(() => '')).trim();
  91  |         const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
  92  |         const title = await btn.getAttribute('title').catch(() => '');
  93  |         const label = text || ariaLabel || title || '(sans label)';
  94  |         const tag = await btn.evaluate(el => el.tagName.toLowerCase());
  95  | 
  96  |         // Vérifie si le bouton est désactivé
  97  |         const isDisabled = await btn.isDisabled().catch(() => false);
  98  | 
  99  |         // Vérifie si le bouton a un label accessible
  100 |         const hasLabel = !!(text || ariaLabel || title);
  101 | 
  102 |         if (!hasLabel) {
  103 |             results.issues.push(`⚠️  Bouton #${i + 1} <${tag}> sans label accessible`);
  104 |         }
  105 | 
  106 |         console.log(`   ${isDisabled ? '🔒 [DESACTIVE]' : '✅'} <${tag}> "${label.substring(0, 50)}"`);
  107 |     }
  108 | 
  109 |     // Rapport des erreurs JS
  110 |     if (jsErrors.length > 0) {
  111 |         results.issues.push(`🔴 ${jsErrors.length} erreur(s) JS détectée(s)`);
  112 |         jsErrors.forEach(err => console.warn(`   ❌ JS Error: ${err.substring(0, 100)}`));
  113 |     }
  114 | 
  115 |     return results;
  116 | }
  117 | 
  118 | // ─────────────────────────────────────────────────────────
  119 | // TESTS PUBLICS (sans connexion)
  120 | // ─────────────────────────────────────────────────────────
  121 | test.describe('Vérification boutons - Pages Publiques', () => {
  122 |     for (const pageInfo of PUBLIC_PAGES) {
  123 |         test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
  124 |             const results = await checkButtonsOnPage(page, pageInfo);
  125 | 
  126 |             // Le test échoue seulement si des boutons critiques manquent un label
  127 |             const criticalIssues = results.issues.filter(i => i.includes('sans label'));
  128 |             if (criticalIssues.length > 0) {
  129 |                 console.warn(`\nProblèmes sur "${pageInfo.name}":\n${criticalIssues.join('\n')}`);
  130 |             }
  131 | 
  132 |             // Vérifie qu'il y a au moins 1 bouton sur chaque page
> 133 |             expect(results.total, `Aucun bouton trouvé sur la page "${pageInfo.name}"`).toBeGreaterThan(0);
      |                                                                                         ^ Error: Aucun bouton trouvé sur la page "Promotions"
  134 |         });
  135 |     }
  136 | });
  137 | 
  138 | // ─────────────────────────────────────────────────────────
  139 | // TESTS ACHETEUR (avec connexion)
  140 | // ─────────────────────────────────────────────────────────
  141 | test.describe('Vérification boutons - Dashboard Acheteur', () => {
  142 |     test.beforeEach(async ({ page }) => {
  143 |         await page.goto('/src/pages/login.html', { waitUntil: 'networkidle', timeout: 30000 });
  144 |         await page.fill('#email', 'benimakiese1234567@gmail.com');
  145 |         await page.fill('#password', 'Phoenix_2026!');
  146 |         await page.locator('button:has-text("Accepter tout")').click().catch(() => {});
  147 |         await page.click('#submitBtn', { force: true });
  148 |         await page.waitForTimeout(4000);
  149 |     });
  150 | 
  151 |     for (const pageInfo of BUYER_PAGES) {
  152 |         test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
  153 |             const results = await checkButtonsOnPage(page, pageInfo);
  154 |             expect(results.total, `Aucun bouton trouvé sur "${pageInfo.name}"`).toBeGreaterThan(0);
  155 |         });
  156 |     }
  157 | });
  158 | 
  159 | // ─────────────────────────────────────────────────────────
  160 | // TESTS VENDEUR (avec connexion)
  161 | // ─────────────────────────────────────────────────────────
  162 | test.describe('Vérification boutons - Dashboard Vendeur', () => {
  163 |     test.beforeEach(async ({ page }) => {
  164 |         await page.goto('/src/pages/login.html', { waitUntil: 'networkidle', timeout: 30000 });
  165 |         await page.fill('#email', 'benimakiese123@gmail.com');
  166 |         await page.fill('#password', 'Phoenix_2026!');
  167 |         await page.locator('button:has-text("Accepter tout")').click().catch(() => {});
  168 |         await page.click('#submitBtn', { force: true });
  169 |         await page.waitForTimeout(4000);
  170 |     });
  171 | 
  172 |     for (const pageInfo of VENDOR_PAGES) {
  173 |         test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
  174 |             const results = await checkButtonsOnPage(page, pageInfo);
  175 |             expect(results.total, `Aucun bouton trouvé sur "${pageInfo.name}"`).toBeGreaterThan(0);
  176 |         });
  177 |     }
  178 | });
  179 | 
```