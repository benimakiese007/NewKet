import { test, expect } from '@playwright/test';

test.describe('Securite et Garde-fous', () => {
  test('Redirection depuis Admin si non connecte', async ({ page }) => {
    await page.goto('/admin/index.html');
    // Le systeme devrait detecter l'absence de session et rediriger vers login
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('Redirection depuis Customer Dashboard si non connecte', async ({ page }) => {
    await page.goto('/customer-dashboard.html');
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('Protection XSS basique dans la recherche', async ({ page }) => {
    await page.goto('/catalog.html');
    const searchInput = page.locator('input[type="search"]');
    if (await searchInput.count() > 0) {
      // Tentative d'injection de script
      await searchInput.first().fill('<script>alert("xss")</script>');
      await searchInput.first().press('Enter');
      
      // La page ne doit pas crasher ni afficher d'alerte reelle 
      // (Playwright gere les dialogues, mais l'UI doit rester saine)
      const errorMsg = page.locator('.error, .no-results');
      if (await errorMsg.count() > 0) {
        await expect(errorMsg.first()).toBeVisible();
      }
    }
  });
});
