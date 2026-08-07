# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: buttons-check.spec.js >> Vérification boutons - Dashboard Vendeur >> user-details — boutons visibles et accessibles
- Location: tests\e2e\buttons-check.spec.js:218:9

# Error details

```
Error: Aucun bouton trouvé sur "user-details"

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [ref=f15e1]:
  - navigation [ref=f15e2]:
    - generic [ref=f15e3]:
      - button [ref=f15e5] [cursor=pointer]
      - link "Accueil NewKet" [ref=f15e10] [cursor=pointer]:
        - /url: /
        - img "NewKet Logo" [ref=f15e11]
      - button [ref=f15e13] [cursor=pointer]
  - generic: Mise à jour...
  - main [ref=f15e18]:
    - complementary [ref=f15e19]:
      - button "Réduire le menu" [ref=f15e20] [cursor=pointer]
      - generic [ref=f15e24]:
        - generic [ref=f15e31]:
          - paragraph [ref=f15e33]: Ma Boutique
          - heading "Chargement..." [level=2] [ref=f15e35]
        - navigation [ref=f15e38]:
          - link "Tableau de bord" [ref=f15e39] [cursor=pointer]:
            - /url: "#dashboard"
          - link "Analyses & Stats" [ref=f15e44] [cursor=pointer]:
            - /url: "#analytics"
          - link "Publier un article" [ref=f15e49] [cursor=pointer]:
            - /url: /src/pages/publish.html
          - link "Mes Produits" [ref=f15e54] [cursor=pointer]:
            - /url: "#products"
          - link "Demandes et devis clients" [ref=f15e59] [cursor=pointer]:
            - /url: "#leads"
            - generic [ref=f15e65]:
              - text: Demandes et
              - generic [ref=f15e66]: devis
          - link "Mes Achats" [ref=f15e67] [cursor=pointer]:
            - /url: "#purchases"
          - link "Codes promo" [ref=f15e72] [cursor=pointer]:
            - /url: "#promos"
          - link "Paiements" [ref=f15e77] [cursor=pointer]:
            - /url: "#payouts"
          - link "Paramètres" [ref=f15e85] [cursor=pointer]:
            - /url: "#settings"
    - generic [active] [ref=f15e91]:
      - generic [ref=f15e92]:
        - generic [ref=f15e93]:
          - heading "Bonjour, Vendeur" [level=1] [ref=f15e94]
          - paragraph [ref=f15e95]: Voici un aperçu de l'activité de votre boutique aujourd'hui.
        - link "Ajouter un produit" [ref=f15e97] [cursor=pointer]:
          - /url: /src/pages/publish.html
      - generic [ref=f15e98]:
        - generic [ref=f15e99]:
          - paragraph [ref=f15e100]: Paiements Initiés
          - generic [ref=f15e101]: 0 FC
          - paragraph [ref=f15e102]: +0 FC ce mois
        - generic [ref=f15e103]:
          - paragraph [ref=f15e104]: Visiteurs Uniques
          - generic [ref=f15e105]: "0"
          - paragraph [ref=f15e106]: Activité récente
        - generic [ref=f15e107]:
          - paragraph [ref=f15e108]: Produits en ligne
          - generic [ref=f15e109]: "8"
        - generic [ref=f15e110]:
          - paragraph [ref=f15e111]: Vues Produits
          - generic [ref=f15e112]: "9"
          - paragraph [ref=f15e113]: Intérêt total
        - generic [ref=f15e114]:
          - paragraph [ref=f15e115]: Taux de conversion produit
          - generic [ref=f15e116]: 0%
          - paragraph [ref=f15e118]: Vues produits → commandes
        - generic [ref=f15e119]:
          - paragraph [ref=f15e120]: Note Vendeur
          - paragraph [ref=f15e123]: Moyenne avis
      - generic [ref=f15e124]:
        - heading "Intérêt pour vos produits" [level=3] [ref=f15e127]
        - generic [ref=f15e130]:
          - generic [ref=f15e131]:
            - heading "Dernières Commandes" [level=3] [ref=f15e132]
            - button [ref=f15e134] [cursor=pointer]
          - table [ref=f15e139]:
            - rowgroup [ref=f15e149]:
              - row [ref=f15e150]:
                - columnheader [ref=f15e151]:
                  - checkbox [ref=f15e152] [cursor=pointer]
                - columnheader [ref=f15e153] [cursor=pointer]
                - columnheader "Client & Produit" [ref=f15e157]
                - columnheader "Contact" [ref=f15e158]
                - columnheader [ref=f15e159] [cursor=pointer]
                - columnheader "Paiement" [ref=f15e163]
                - columnheader [ref=f15e164] [cursor=pointer]
                - columnheader [ref=f15e168]
            - rowgroup [ref=f15e169]:
              - row [ref=f15e170]:
                - cell [ref=f15e171]:
                  - generic [ref=f15e172]:
                    - heading "Aucune commande" [level=4] [ref=f15e174]
                    - paragraph [ref=f15e175]: Vous n'avez pas encore reçu de commandes. Continuez à promouvoir vos produits !
        - generic [ref=f15e176]:
          - heading "Activités Récentes de la Boutique" [level=3] [ref=f15e178]
          - generic [ref=f15e182]:
            - generic [ref=f15e185]:
              - paragraph [ref=f15e186]: "Produit publie : Produit de Test #41098"
              - paragraph [ref=f15e187]: 8/2/2026
            - generic [ref=f15e190]:
              - paragraph [ref=f15e191]: "Produit publie : Produit de Test #88664"
              - paragraph [ref=f15e192]: 8/2/2026
            - generic [ref=f15e195]:
              - paragraph [ref=f15e196]: "Produit publie : Produit de Test #826"
              - paragraph [ref=f15e197]: 8/2/2026
            - generic [ref=f15e200]:
              - paragraph [ref=f15e201]: "Produit publie : Montre Rolex Submariner Acier"
              - paragraph [ref=f15e202]: 7/22/2026
```

# Test source

```ts
  120 |     for (let i = 0; i < count; i++) {
  121 |         const btn = buttons.nth(i);
  122 | 
  123 |         // Récupère le texte/label du bouton
  124 |         const text = (await btn.innerText().catch(() => '')).trim();
  125 |         const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
  126 |         const title = await btn.getAttribute('title').catch(() => '');
  127 |         const label = text || ariaLabel || title || '(sans label)';
  128 |         const tag = await btn.evaluate(el => el.tagName.toLowerCase());
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
> 220 |             expect(results.total, `Aucun bouton trouvé sur "${pageInfo.name}"`).toBeGreaterThan(0);
      |                                                                                 ^ Error: Aucun bouton trouvé sur "user-details"
  221 |         });
  222 |     }
  223 | });
  224 | 
```