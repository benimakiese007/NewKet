# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: buttons-check.spec.js >> Vérification boutons - Dashboard Vendeur >> referrals — boutons visibles et accessibles
- Location: tests\e2e\buttons-check.spec.js:218:9

# Error details

```
Error: Aucun bouton trouvé sur "referrals"

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=f11e1]:
  - navigation [ref=f11e2]:
    - generic [ref=f11e3]:
      - link [ref=f11e4] [cursor=pointer]:
        - /url: /index.html
        - img "NewKet" [ref=f11e5]
      - generic [ref=f11e6]: Sécurisé
  - generic [ref=f11e13]:
    - generic [ref=f11e14]:
      - img "NewKet Experience" [ref=f11e15]
      - generic [ref=f11e16]:
        - heading "Découvrez l'expérience ultime." [level=1] [ref=f11e17]
        - paragraph [ref=f11e18]: Rejoignez des milliers d'acheteurs et de vendeurs. Une plateforme pensée pour la performance et le raffinement.
        - generic [ref=f11e19]:
          - generic [ref=f11e20]: ...
          - generic [ref=f11e22]: Utilisateurs
    - generic [ref=f11e23]:
      - generic: Mise à jour...
      - main [ref=f11e24]:
        - generic [ref=f11e25]:
          - generic [ref=f11e26]:
            - heading "Bienvenue" [level=2] [ref=f11e27]
            - paragraph [ref=f11e28]: Veuillez renseigner vos identifiants.
          - generic [ref=f11e29]:
            - button [ref=f11e30] [cursor=pointer]
            - button [ref=f11e35] [cursor=pointer]
          - generic [ref=f11e41]:
            - generic [ref=f11e42]:
              - textbox "Nom d'utilisateur" [ref=f11e43]:
                - /placeholder: Email ou nom d'utilisateur
              - generic: Nom d'utilisateur
            - generic [ref=f11e49]:
              - textbox "Mot de passe" [ref=f11e50]:
                - /placeholder: " "
              - generic: Mot de passe
              - button "Afficher le mot de passe" [ref=f11e51] [cursor=pointer]
            - generic [ref=f11e57]:
              - generic [ref=f11e58] [cursor=pointer]:
                - checkbox "Se souvenir de moi" [ref=f11e59]
                - generic [ref=f11e60]: Se souvenir de moi
              - button [ref=f11e61] [cursor=pointer]
            - button "Se connecter" [ref=f11e65] [cursor=pointer]
          - generic [ref=f11e70]: Ou continuer avec
          - generic [ref=f11e75]:
            - button "Se connecter avec Google" [ref=f11e76] [cursor=pointer]:
              - generic [ref=f11e84]: Google
            - button "Se connecter avec Passkey" [ref=f11e85] [cursor=pointer]:
              - generic [ref=f11e90]: Passkey
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
      |                                                                                 ^ Error: Aucun bouton trouvé sur "referrals"
  221 |         });
  222 |     }
  223 | });
  224 | 
```