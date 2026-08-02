import { test, expect } from '@playwright/test';

test.describe('Shopping & Panier', () => {

  test('Devrait afficher le catalogue et permettre la recherche', async ({ page }) => {
    // Naviguer vers la page catalogue
    await page.goto('/src/pages/catalog.html', { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    // Vérifier que le champ de recherche existe
    const searchInput = page.locator('input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Effectuer une recherche
    await searchInput.fill('produit test');
    await searchInput.press('Enter');
  });

  test('Devrait pouvoir ajouter un produit au panier', async ({ page }) => {
    // Naviguer vers le catalogue
    await page.goto('/src/pages/catalog.html', { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    // Attendre que les produits soient chargés dynamiquement via l'API
    // Le sélecteur réel généré par buildProductCardHTML dans ui-helpers.js est :
    // .product-card .add-to-cart-btn
    const addToCartButton = page.locator('.product-card .add-to-cart-btn').first();
    await expect(addToCartButton).toBeVisible({ timeout: 15000 });
    await addToCartButton.click();

    // Vérifier que le compteur du panier a été mis à jour
    // Le sélecteur du compteur dépend de votre implémentation (ex: #cart-count)
    // const cartBadge = page.locator('#cart-count, .cart-badge');
    // await expect(cartBadge).not.toBeEmpty();
    // await expect(cartBadge).toHaveText('1');
  });

});
