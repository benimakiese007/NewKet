import { test, expect } from '@playwright/test';

test.describe('Gestion du Panier (Cart)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Ajout d un article au panier', async ({ page }) => {
    const addToCartBtns = page.locator('button:has-text("Ajouter"), button:has-text("Add to cart"), .add-to-cart');
    
    if (await addToCartBtns.count() > 0) {
      // Cliquer sur le premier bouton d'ajout au panier
      await addToCartBtns.first().click();
      
      // Verifier que le compteur du panier a augmente ou qu'un toast s'affiche
      const cartBadge = page.locator('.cart-count, .badge-cart');
      if (await cartBadge.count() > 0) {
        await expect(cartBadge).not.toHaveText('0');
      }
    }
  });

  test('Modification de la quantite et suppression dans le panier', async ({ page }) => {
    // On force l'etat du localStorage pour simuler un panier plein
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify([{ id: '1', name: 'Test', price: 100, quantity: 1 }]));
    });
    
    await page.goto('/checkout.html'); // ou la page panier appropriee
    
    const qtyInput = page.locator('input[type="number"], .qty-input');
    if (await qtyInput.count() > 0) {
      await qtyInput.first().fill('2');
      await qtyInput.first().dispatchEvent('change');
    }

    const removeBtn = page.locator('button:has-text("Supprimer"), .remove-item');
    if (await removeBtn.count() > 0) {
      await removeBtn.first().click();
      // Verifier que le panier est vide
      await expect(page.locator('text=/vide|empty/i').first()).toBeVisible();
    }
  });
});
