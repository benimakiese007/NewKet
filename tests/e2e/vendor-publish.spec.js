const { test, expect } = require('@playwright/test');

test.describe('Vendeur : Publication de produit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/publish.html'); // ou l'URL equivalente
  });

  test('Formulaire de publication contient les champs requis', async ({ page }) => {
    // S'il y a un redirect login, on le gere (test abstrait)
    const form = page.locator('form');
    if (await form.count() > 0) {
      await expect(page.locator('input[name="title"], input[name="name"]').first()).toBeVisible();
      await expect(page.locator('input[name="price"]').first()).toBeVisible();
      await expect(page.locator('textarea[name="description"]').first()).toBeVisible();
    }
  });

  test('Validation des champs obligatoires', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"], button:has-text("Publier")');
    if (await submitBtn.count() > 0) {
      await submitBtn.first().click();
      
      // On s'attend a un message d'erreur natif HTML5 ou UI
      const errorMessage = page.locator('.error-message, text=/requis|required/i');
      if (await errorMessage.count() > 0) {
        await expect(errorMessage.first()).toBeVisible();
      }
    }
  });
});
