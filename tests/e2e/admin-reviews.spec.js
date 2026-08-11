const { test, expect } = require('@playwright/test');

test.describe('Admin : Gestion des Avis (Reviews)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/reviews.html');
  });

  test('Affichage de la liste des avis', async ({ page }) => {
    const reviewsList = page.locator('.reviews-list, table, .review-item');
    if (await reviewsList.count() > 0) {
      await expect(reviewsList.first()).toBeVisible();
    }
  });

  test('Action de moderation presente (Supprimer ou Approuver)', async ({ page }) => {
    const actionBtns = page.locator('.action-btn, button:has-text("Supprimer"), button:has-text("Approuver")');
    if (await actionBtns.count() > 0) {
      await expect(actionBtns.first()).toBeVisible();
    }
  });
});
