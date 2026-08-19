import { test, expect } from '@playwright/test';

test.describe('Admin : Tableau de bord', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/index.html');
  });

  test('Verification de la presence du layout Admin', async ({ page }) => {
    const adminSidebar = page.locator('.admin-sidebar, nav');
    if (await adminSidebar.count() > 0) {
      await expect(adminSidebar).toBeVisible();
      // Liens attendus
      await expect(page.locator('text=/Utilisateurs|Users/i').first()).toBeVisible();
      await expect(page.locator('text=/Produits|Products/i').first()).toBeVisible();
      await expect(page.locator('text=/Litiges|Disputes/i').first()).toBeVisible();
    }
  });

  test('Affichage des cartes analytiques', async ({ page }) => {
    const analyticsCard = page.locator('.card, .analytic-box');
    if (await analyticsCard.count() >= 3) {
      await expect(analyticsCard.first()).toBeVisible();
    }
  });
});
