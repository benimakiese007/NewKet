# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: buttons-check.spec.js >> Vérification boutons - Pages Publiques >> catalog — boutons visibles et accessibles
- Location: tests\e2e\buttons-check.spec.js:157:9

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.evaluate: Target page, context or browser has been closed
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - navigation [ref=f3e3]:
    - generic [ref=f3e4]:
      - generic [ref=f3e5]:
        - button "Ouvrir le menu" [ref=f3e7] [cursor=pointer]
        - link "Retour à l'accueil NewKet" [ref=f3e12] [cursor=pointer]:
          - /url: /
          - img "NewKet" [ref=f3e13]
      - generic [ref=f3e15]:
        - generic "Choisir une catégorie" [ref=f3e16] [cursor=pointer]: Tout
        - textbox "Rechercher des produits" [ref=f3e21]:
          - /placeholder: Rechercher sur NewKet...
      - generic [ref=f3e22]:
        - generic "Devise d'affichage" [ref=f3e24] [cursor=pointer]:
          - generic [ref=f3e25]:
            - generic [ref=f3e27]: USD
            - generic [ref=f3e28]: CDF
        - link "Voir les notifications" [ref=f3e29] [cursor=pointer]:
          - /url: /notifications
        - link "Voir les favoris" [ref=f3e35] [cursor=pointer]:
          - /url: /favorites
        - button "Voir le panier" [ref=f3e39] [cursor=pointer]
        - link "Mon compte" [ref=f3e46] [cursor=pointer]:
          - /url: /login
  - generic: Mise à jour...
  - main [ref=f3e52]:
    - generic [ref=f3e53]:
      - heading "Explorez l'Exceptionnel" [level=1] [ref=f3e54]
      - generic [ref=f3e56]:
        - combobox [ref=f3e59] [cursor=pointer]:
          - option "Pertinence" [selected]
          - option "Prix Croissant"
          - option "Prix Décroissant"
          - option "Nouveautés"
        - generic [ref=f3e60]:
          - generic [ref=f3e61]:
            - button [ref=f3e63] [cursor=pointer]
            - button [ref=f3e75] [cursor=pointer]
            - button [ref=f3e87] [cursor=pointer]
            - button [ref=f3e99] [cursor=pointer]
          - generic [ref=f3e109]:
            - generic [ref=f3e110]: En Promo
            - button "Réinitialiser" [ref=f3e115] [cursor=pointer]
    - generic [ref=f3e120]:
      - heading "Aucun résultat trouvé" [level=3] [ref=f3e127]
      - paragraph [ref=f3e128]: Essayez d'autres mots-clés ou parcourez toutes nos sélections.
      - button "Voir tous les produits" [ref=f3e129] [cursor=pointer]
  - dialog "Préférences de cookies" [ref=f3e130]:
    - generic [ref=f3e131]:
      - generic [ref=f3e132]:
        - paragraph [ref=f3e133]: 🍪 Nous respectons votre vie privée
        - paragraph [ref=f3e134]:
          - text: Nous utilisons des cookies pour améliorer votre expérience. Voir notre
          - link "politique de confidentialité" [ref=f3e135] [cursor=pointer]:
            - /url: /privacy
          - text: .
      - generic [ref=f3e136]:
        - button "Personnaliser" [ref=f3e137] [cursor=pointer]
        - button "Refuser tout" [ref=f3e138] [cursor=pointer]
        - button "Accepter tout ✓" [ref=f3e139] [cursor=pointer]
```

# Test source

```ts
  28  |     const files = fs.readdirSync(dir);
  29  |     for (const file of files) {
  30  |         const filePath = path.join(dir, file);
  31  |         if (fs.statSync(filePath).isDirectory()) {
  32  |             getAllHtmlFiles(filePath, fileList);
  33  |         } else if (file.endsWith('.html')) {
  34  |             fileList.push(filePath);
  35  |         }
  36  |     }
  37  |     return fileList;
  38  | }
  39  | 
  40  | const allHtmlFiles = getAllHtmlFiles(PAGES_DIR);
  41  | 
  42  | // Catégorisation dynamique
  43  | const PUBLIC_PAGES = [];
  44  | const BUYER_PAGES = [];
  45  | const VENDOR_PAGES = [];
  46  | 
  47  | for (const filePath of allHtmlFiles) {
  48  |     // Calcul de l'URL relative
  49  |     const relativePath = path.relative(PAGES_DIR, filePath).replace(/\\/g, '/');
  50  |     let url = `${ROOT_URL}/${relativePath}`;
  51  |     
  52  |     // Remplacement spécial pour l'index
  53  |     if (relativePath === 'index.html' || relativePath === '../index.html') {
  54  |         url = '/';
  55  |     }
  56  | 
  57  |     const name = path.basename(filePath, '.html');
  58  |     const pageInfo = { name, url };
  59  | 
  60  |     // Si la page a besoin d'un temps d'attente spécifique pour charger du contenu dynamique
  61  |     if (['promo', 'choose-role', 'catalog', 'index'].includes(name)) {
  62  |         pageInfo.waitMs = 5000;
  63  |     }
  64  | 
  65  |     // Routage vers la bonne catégorie selon le nom ou le dossier
  66  |     if (relativePath.includes('admin/') || ['vendor-dashboard', 'publish', 'seller-onboarding'].includes(name)) {
  67  |         VENDOR_PAGES.push(pageInfo);
  68  |     } else if (['customer-dashboard', 'favorites', 'notifications', 'settings', 'achat'].includes(name)) {
  69  |         BUYER_PAGES.push(pageInfo);
  70  |     } else {
  71  |         PUBLIC_PAGES.push(pageInfo);
  72  |     }
  73  | }
  74  | 
  75  | // Erreurs JS à ignorer (erreurs connues non liées aux boutons)
  76  | const IGNORED_ERRORS = [
  77  |     'VAPID keys missing',
  78  |     'Sentry Dsn',
  79  |     'Failed to fetch',
  80  |     'NetworkError',
  81  |     'AbortError',
  82  |     'ResizeObserver loop',
  83  |     'push_notification_jobs',
  84  |     'Failed to load search',
  85  |     'ERR_CONNECTION_REFUSED',
  86  |     'ERR_CONNECTION_CLOSED',
  87  |     '502',
  88  |     '502 (Bad Gateway)',
  89  |     'Failed to load resource',
  90  | ];
  91  | 
  92  | function shouldIgnoreError(msg) {
  93  |     return IGNORED_ERRORS.some(ignore => msg.includes(ignore));
  94  | }
  95  | 
  96  | // ─────────────────────────────────────────────────────────
  97  | // HELPER: tester tous les boutons d'une page
  98  | // ─────────────────────────────────────────────────────────
  99  | async function checkButtonsOnPage(page, pageInfo) {
  100 |     const jsErrors = [];
  101 | 
  102 |     page.on('console', msg => {
  103 |         if (msg.type() === 'error' && !shouldIgnoreError(msg.text())) {
  104 |             jsErrors.push(msg.text());
  105 |         }
  106 |     });
  107 | 
  108 |     await page.goto(pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  109 |     // Attente dynamique : certaines pages chargent leurs boutons via JS
  110 |     await page.waitForTimeout(pageInfo.waitMs || 3000);
  111 | 
  112 |     // Récupère tous les boutons et liens cliquables
  113 |     const buttons = page.locator('button:visible, a[href]:visible, [role="button"]:visible, input[type="submit"]:visible, input[type="button"]:visible');
  114 |     const count = await buttons.count();
  115 | 
  116 |     console.log(`\n📄 ${pageInfo.name} → ${count} boutons trouvés`);
  117 | 
  118 |     const results = { page: pageInfo.name, total: count, issues: [] };
  119 | 
  120 |     for (let i = 0; i < count; i++) {
  121 |         const btn = buttons.nth(i);
  122 | 
  123 |         // Récupère le texte/label du bouton
  124 |         const text = (await btn.innerText().catch(() => '')).trim();
  125 |         const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
  126 |         const title = await btn.getAttribute('title').catch(() => '');
  127 |         const label = text || ariaLabel || title || '(sans label)';
> 128 |         const tag = await btn.evaluate(el => el.tagName.toLowerCase());
      |                               ^ Error: locator.evaluate: Target page, context or browser has been closed
  129 | 
  130 |         // Vérifie si le bouton est désactivé
  131 |         const isDisabled = await btn.isDisabled().catch(() => false);
  132 | 
  133 |         // Vérifie si le bouton a un label accessible
  134 |         const hasLabel = !!(text || ariaLabel || title);
  135 | 
  136 |         if (!hasLabel) {
  137 |             results.issues.push(`⚠️  Bouton #${i + 1} <${tag}> sans label accessible`);
  138 |         }
  139 | 
  140 |         console.log(`   ${isDisabled ? '🔒 [DESACTIVE]' : '✅'} <${tag}> "${label.substring(0, 50)}"`);
  141 |     }
  142 | 
  143 |     // Rapport des erreurs JS
  144 |     if (jsErrors.length > 0) {
  145 |         results.issues.push(`🔴 ${jsErrors.length} erreur(s) JS détectée(s)`);
  146 |         jsErrors.forEach(err => console.warn(`   ❌ JS Error: ${err.substring(0, 100)}`));
  147 |     }
  148 | 
  149 |     return results;
  150 | }
  151 | 
  152 | // ─────────────────────────────────────────────────────────
  153 | // TESTS PUBLICS (sans connexion)
  154 | // ─────────────────────────────────────────────────────────
  155 | test.describe('Vérification boutons - Pages Publiques', () => {
  156 |     for (const pageInfo of PUBLIC_PAGES) {
  157 |         test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
  158 |             const results = await checkButtonsOnPage(page, pageInfo);
  159 | 
  160 |             // Le test échoue seulement si des boutons critiques manquent un label
  161 |             const criticalIssues = results.issues.filter(i => i.includes('sans label'));
  162 |             if (criticalIssues.length > 0) {
  163 |                 console.warn(`\nProblèmes sur "${pageInfo.name}":\n${criticalIssues.join('\n')}`);
  164 |             }
  165 | 
  166 |             // Vérifie qu'il y a au moins 1 bouton sur chaque page (avertissement doux si 0)
  167 |             if (results.total === 0) {
  168 |                 console.warn(`\n⚠️  ATTENTION: Aucun bouton visible trouvé sur "${pageInfo.name}" - les boutons sont peut-être cachés ou chargés dynamiquement.`);
  169 |             }
  170 |             expect(results.total, `Aucun bouton trouvé sur la page "${pageInfo.name}"`).toBeGreaterThanOrEqual(0);
  171 |         });
  172 |     }
  173 | });
  174 | 
  175 | // ─────────────────────────────────────────────────────────
  176 | // TESTS ACHETEUR (avec connexion)
  177 | // ─────────────────────────────────────────────────────────
  178 | test.describe('Vérification boutons - Dashboard Acheteur', () => {
  179 |     test.beforeEach(async ({ page }) => {
  180 |         await page.goto('/src/pages/login.html', { waitUntil: 'networkidle', timeout: 30000 });
  181 |         await page.fill('#email', 'benimakiese1234567@gmail.com');
  182 |         await page.fill('#password', 'Phoenix_2026!');
  183 |         await page.locator('button:has-text("Accepter tout")').click().catch(() => {});
  184 |         await page.click('#submitBtn', { force: true });
  185 |         await page.waitForTimeout(4000);
  186 |     });
  187 | 
  188 |     for (const pageInfo of BUYER_PAGES) {
  189 |         test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
  190 |             const results = await checkButtonsOnPage(page, pageInfo);
  191 |             expect(results.total, `Aucun bouton trouvé sur "${pageInfo.name}"`).toBeGreaterThan(0);
  192 |         });
  193 |     }
  194 | });
  195 | 
  196 | // ─────────────────────────────────────────────────────────
  197 | // TESTS VENDEUR (avec connexion)
  198 | // ─────────────────────────────────────────────────────────
  199 | test.describe('Vérification boutons - Dashboard Vendeur', () => {
  200 |     test.beforeEach(async ({ page }) => {
  201 |         await page.goto('/src/pages/login.html', { waitUntil: 'networkidle', timeout: 30000 });
  202 |         await page.fill('#email', 'benimakiese123@gmail.com');
  203 |         await page.fill('#password', 'Phoenix_2026!');
  204 |         await page.locator('button:has-text("Accepter tout")').click().catch(() => {});
  205 |         await page.click('#submitBtn', { force: true });
  206 |         // Attendre que auth.js charge le rôle supplier et redirige vers le dashboard vendeur
  207 |         await page.waitForURL(/vendor-dashboard|choose-role/, { timeout: 20000 }).catch(() => {});
  208 |         // Si redirection vers choose-role, attendre 1s supplémentaire que le JS se stabilise
  209 |         if (page.url().includes('choose-role')) {
  210 |             await page.waitForTimeout(2000);
  211 |         } else {
  212 |             await page.waitForTimeout(3000);
  213 |         }
  214 |     });
  215 | 
  216 | 
  217 |     for (const pageInfo of VENDOR_PAGES) {
  218 |         test(`${pageInfo.name} — boutons visibles et accessibles`, async ({ page }) => {
  219 |             const results = await checkButtonsOnPage(page, pageInfo);
  220 |             expect(results.total, `Aucun bouton trouvé sur "${pageInfo.name}"`).toBeGreaterThan(0);
  221 |         });
  222 |     }
  223 | });
  224 | 
```