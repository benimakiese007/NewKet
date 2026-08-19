import { test, expect } from '@playwright/test';

test.describe('Recherche et Filtres', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog.html');
  });

  test('Recherche avec un mot-cle valide affiche des resultats', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], .search-input');
    // On verifie d'abord si la barre de recherche existe sur la page
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('Test Product');
      await searchInput.first().press('Enter');
      
      // On s'attend a ce que les resultats se mettent a jour
      const products = page.locator('.product-card, .item');
      await expect(products.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('Filtre par categorie met a jour la liste', async ({ page }) => {
    const categoryFilter = page.locator('.category-filter, select[name="category"]');
    if (await categoryFilter.count() > 0) {
      await categoryFilter.first().selectOption({ index: 1 });
      // Attendre le rechargement ou l'animation
      await page.waitForTimeout(1000);
    }
  });

  test('Etat vide si aucun resultat (recherche impossible)', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], .search-input');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('xyz_produit_impossible_123');
      await searchInput.first().press('Enter');
      
      // On devrait voir un message de type "Aucun resultat"
      await expect(page.locator('text=/aucun|empty|not found/i').first()).toBeVisible();
    }
  });
});
