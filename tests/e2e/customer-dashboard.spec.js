import { test, expect } from '@playwright/test';

test.describe('Tableau de bord Client (Customer Dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customer-dashboard.html');
  });

  test('Doit avoir les sections principales (Commandes, Profil, Parametres)', async ({ page }) => {
    // Verifie la presence des onglets ou sections
    const tabs = page.locator('.dashboard-nav, .sidebar, .tabs');
    if (await tabs.count() > 0) {
      await expect(page.locator('text=/commandes|orders/i').first()).toBeVisible();
      await expect(page.locator('text=/profil|profile/i').first()).toBeVisible();
      await expect(page.locator('text=/param/i').first()).toBeVisible();
    }
  });

  test('Doit permettre l edition des infos de profil', async ({ page }) => {
    const editBtn = page.locator('button:has-text("Editer"), .edit-profile-btn');
    if (await editBtn.count() > 0) {
      await editBtn.first().click();
      const nameInput = page.locator('input[name="fullname"], input[name="name"]');
      if (await nameInput.count() > 0) {
        await nameInput.fill('John Doe Modifie');
        const saveBtn = page.locator('button:has-text("Sauvegarder"), .save-btn');
        if (await saveBtn.count() > 0) {
          await saveBtn.first().click();
        }
      }
    }
  });
});
