import { test, expect } from '@playwright/test';

test.describe('Shopping & Panier', () => {

  test('Devrait afficher le catalogue et permettre la recherche', async ({ page }) => {
    // Naviguer vers la page catalogue
    await page.goto('/src/pages/catalog.html');

    // Vérifier que le champ de recherche existe
    const searchInput = page.locator('input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i]');
    await expect(searchInput).toBeVisible();

    // Effectuer une recherche
    await searchInput.fill('produit test');
    await searchInput.press('Enter');

    // Attendre que les résultats se chargent (ajuster le sélecteur selon votre DOM)
    // const productCard = page.locator('.product-card').first();
    // await expect(productCard).toBeVisible();
  });

  test('Devrait pouvoir ajouter un produit au panier', async ({ page }) => {
    // Naviguer vers une page produit ou le catalogue
    await page.goto('/src/pages/catalog.html');

    // Trouver le premier bouton d'ajout au panier et cliquer
    const addToCartButton = page.locator('button:has-text("Ajouter"), button:has-text("Add to cart"), .add-to-cart').first();
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    // Vérifier que le compteur du panier a été mis à jour
    // Le sélecteur du compteur dépend de votre implémentation (ex: #cart-count)
    // const cartBadge = page.locator('#cart-count, .cart-badge');
    // await expect(cartBadge).not.toBeEmpty();
    // await expect(cartBadge).toHaveText('1');
  });

});
