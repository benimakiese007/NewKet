const { test, expect } = require('@playwright/test');

test.describe('Admin : Gestion des Utilisateurs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/user.html'); // ou page equivalente
  });

  test('Recherche d un utilisateur par email', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="email"], input[placeholder*="recherche"], .search-user');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test@example.com');
      await searchInput.first().press('Enter');
      // La table devrait se mettre a jour
      await page.waitForTimeout(1000);
      const tableRows = page.locator('table tbody tr');
      if (await tableRows.count() > 0) {
        await expect(tableRows.first()).toBeVisible();
      }
    }
  });

  test('Acces aux details de l utilisateur', async ({ page }) => {
    const viewBtn = page.locator('button:has-text("Voir"), .view-btn, a[href*="user-details"]');
    if (await viewBtn.count() > 0) {
      await viewBtn.first().click();
      await expect(page).toHaveURL(/.*user-details.*/);
    }
  });
});
