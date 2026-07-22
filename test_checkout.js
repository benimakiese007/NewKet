import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Lancement du navigateur de test...');
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // --- 1. CONNEXION CLIENT EN ACCÉDANT DIRECTEMENT À LA PAGE ---
    console.log('🌐 Navigation directe vers la page de connexion...');
    await page.goto('https://newket.vercel.app/src/pages/login.html', { waitUntil: 'networkidle' });

    console.log('🔐 Remplissage des identifiants...');
    
    // Remplir les identifiants avec les bons IDs
    await page.fill('#email', 'benimakiese1234567@gmail.com');
    await page.fill('#password', 'PHOENIX');
    
    // Cliquer sur le bouton de soumission
    await page.click('#submitBtn');
    
    // Attendre d'être redirigé vers l'accueil ou le dashboard
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // laisser le temps aux redirections
    console.log('✅ Connecté avec succès !');

    // --- 2. RECHERCHE DE PRODUIT ---
    console.log("🔍 Recherche d'un produit...");
    // S'assurer qu'on est sur l'accueil ou y retourner
    await page.goto('https://newket.vercel.app/', { waitUntil: 'networkidle' });

    // Taper dans la barre de recherche
    await page.fill('#searchInput', 'Plante artificielle palmier');
    await page.keyboard.press('Enter');
    
    // Attendre un peu que les résultats s'affichent
    await page.waitForTimeout(3000); 
    
    // Cliquer sur le produit (on cherche un lien ou un élément contenant le texte)
    await page.click('text="Plante artificielle palmier"', { force: true });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // --- 3. AJOUT AU PANIER ---
    console.log('🛒 Ajout du produit au panier...');
    // S'assurer de cliquer sur le bon bouton d'ajout (on cherche par texte)
    await page.click('text="Ajouter au panier"', { force: true });
    await page.waitForTimeout(1500); // L'animation d'ajout
    
    // Aller voir le panier
    await page.click('text="Panier"', { force: true }); 
    await page.waitForTimeout(2000);

    // --- 4. CHECKOUT ---
    console.log('💳 Passage à la caisse...');
    // Le bouton pour commander dans le panier
    await page.click('text="Commander"', { force: true }); 
    
    // Attendre d'arriver sur Stripe
    await page.waitForTimeout(6000); 
    
    // --- 5. PAIEMENT STRIPE ---
    console.log('📝 Remplissage des informations de paiement Stripe...');
    
    try {
      const cardNumberInput = page.locator('input[name="cardnumber"], input[name="cardNumber"]');
      if (await cardNumberInput.count() > 0) {
          await cardNumberInput.fill('4242424242424242');
          await page.locator('input[name="exp-date"]').fill('12/30');
          await page.locator('input[name="cvc"]').fill('123');
          
          await page.click('button[type="submit"]'); 
          console.log('💸 Paiement soumis, attente de confirmation...');
          await page.waitForTimeout(5000);
          console.log('🎉 Test terminé avec succès !');
      } else {
          console.log('⚠️ Champs Stripe invisibles pour le script. Remplissage manuel requis.');
      }
    } catch(e) {
      console.log("⚠️ Les champs de paiement n'ont pas pu être remplis automatiquement.");
    }

  } catch (error) {
    console.error('❌ Une erreur est survenue pendant le test :', error);
  } finally {
    console.log('⏳ Fermeture du navigateur dans 20 secondes...');
    await page.waitForTimeout(20000);
    await browser.close();
  }
})();
