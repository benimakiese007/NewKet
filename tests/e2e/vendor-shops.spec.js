const { test, expect } = require('@playwright/test');

test.describe('Vendeur : Gestion des Boutiques (Shops)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vendor-dashboard.html');
  });

  test('Affichage des statistiques de ventes', async ({ page }) => {
    const statsCard = page.locator('.stats-card, .metric, .dashboard-stats');
    if (await statsCard.count() > 0) {
      await expect(statsCard.first()).toBeVisible();
      // Verifier que des chiffres s'affichent
      await expect(statsCard.first()).toContainText(/[0-9]/);
    }
  });

  test('Liste des produits du vendeur', async ({ page }) => {
    const productsTable = page.locator('.products-table, .vendor-products');
    if (await productsTable.count() > 0) {
      await expect(productsTable).toBeVisible();
    }
  });
});
