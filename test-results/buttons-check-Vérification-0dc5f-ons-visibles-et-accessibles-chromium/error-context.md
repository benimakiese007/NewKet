# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: buttons-check.spec.js >> Vérification boutons - Dashboard Vendeur >> payouts — boutons visibles et accessibles
- Location: tests\e2e\buttons-check.spec.js:218:9

# Error details

```
Error: Aucun bouton trouvé sur "payouts"

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=f10e1]:
  - navigation [ref=f10e2]:
    - generic [ref=f10e3]:
      - link [ref=f10e4] [cursor=pointer]:
        - /url: /index.html
        - img "NewKet" [ref=f10e5]
      - generic [ref=f10e6]: Sécurisé
  - generic [ref=f10e13]:
    - generic [ref=f10e14]:
      - img "NewKet Experience" [ref=f10e15]
      - generic [ref=f10e16]:
        - heading "Découvrez l'expérience ultime." [level=1] [ref=f10e17]
        - paragraph [ref=f10e18]: Rejoignez des milliers d'acheteurs et de vendeurs. Une plateforme pensée pour la performance et le raffinement.
        - generic [ref=f10e19]:
          - generic [ref=f10e20]:
            - img "User" [ref=f10e21]
            - img "User" [ref=f10e22]
            - img "User" [ref=f10e23]
            - generic [ref=f10e24]: "+10"
          - generic [ref=f10e25]: Utilisateurs
    - generic [ref=f10e26]:
      - generic: Mise à jour...
      - main [ref=f10e27]:
        - generic [ref=f10e28]:
          - generic [ref=f10e29]:
            - heading "Bienvenue" [level=2] [ref=f10e30]
            - paragraph [ref=f10e31]: Veuillez renseigner vos identifiants.
          - generic [ref=f10e32]:
            - button [ref=f10e33] [cursor=pointer]
            - button [ref=f10e38] [cursor=pointer]
          - generic [ref=f10e44]:
            - generic [ref=f10e45]:
              - textbox "Nom d'utilisateur" [ref=f10e46]:
                - /placeholder: Email ou nom d'utilisateur
              - generic: Nom d'utilisateur
            - generic [ref=f10e52]:
              - textbox "Mot de passe" [ref=f10e53]:
                - /placeholder: " "
              - generic: Mot de passe
              - button "Afficher le mot de passe" [ref=f10e54] [cursor=pointer]
            - generic [ref=f10e60]:
              - generic [ref=f10e61] [cursor=pointer]:
                - checkbox "Se souvenir de moi" [ref=f10e62]
                - generic [ref=f10e63]: Se souvenir de moi
              - button [ref=f10e64] [cursor=pointer]
            - button "Se connecter" [ref=f10e68] [cursor=pointer]
          - generic [ref=f10e73]: Ou continuer avec
          - generic [ref=f10e78]:
            - button "Se connecter avec Google" [ref=f10e79] [cursor=pointer]:
              - generic [ref=f10e87]: Google
            - button "Se connecter avec Passkey" [ref=f10e88] [cursor=pointer]:
              - generic [ref=f10e93]: Passkey
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
      |                                                                                 ^ Error: Aucun bouton trouvé sur "payouts"
  221 |         });
  222 |     }
  223 | });
  224 | 
```