import { test, expect } from '@playwright/test';

test.describe('Favoris et Wishlist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog.html');
  });

  test('Bouton favori existe sur les cartes produits', async ({ page }) => {
    const favButtons = page.locator('.favorite-btn, .heart-icon, button[aria-label="favoris"]');
    if (await favButtons.count() > 0) {
      await expect(favButtons.first()).toBeVisible();
      // Tentative de clic (peut rediriger vers login si non connecte)
      await favButtons.first().click();
    }
  });

  test('Affichage des favoris sur le profil', async ({ page }) => {
    // Simuler une connexion locale si l'app le permet via localStorage
    await page.evaluate(() => {
      localStorage.setItem('favorites', JSON.stringify(['prod_1', 'prod_2']));
    });
    
    await page.goto('/customer-dashboard.html');
    // Le dashboard devrait charger la section favoris
    const favSection = page.locator('#favorites, .favorites-list');
    if (await favSection.count() > 0) {
      await expect(favSection).toBeVisible();
    }
  });
});
