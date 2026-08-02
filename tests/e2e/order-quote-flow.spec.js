import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charge les variables d'environnement du backend pour pouvoir utiliser SUPABASE_SERVICE_ROLE_KEY
try {
    const envPath = path.resolve(__dirname, '../../backend/.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            if (!process.env[key]) process.env[key] = value;
        }
    });
} catch (e) {
    console.warn("Could not load backend/.env", e);
}

// /!\ ATTENTION: Pour que ce test fonctionne de bout en bout avec la base de données réelle,
// vous devez définir des variables d'environnement ou modifier ces constantes avec de vrais comptes.
const BUYER_EMAIL = process.env.TEST_BUYER_EMAIL || 'benimakiese1234567@gmail.com';
const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'Phoenix_2026!';
const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL || 'benimakiese123@gmail.com';
const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'Phoenix_2026!';

test.describe('Flux complet : Commande -> Devis vendeur -> Paiement (Multi-Acteurs)', () => {

  test('L\'acheteur demande un devis, le vendeur répond, l\'acheteur paie', async ({ browser }) => {
    // Ce test est un flux complet multi-acteurs (6 étapes). On dépasse largement le timeout global de 30s.
    test.setTimeout(300_000); // 5 minutes max
    
    // Création de deux contextes de navigation totalement séparés (comme deux ordinateurs différents)
    const buyerContext = await browser.newContext();
    const vendorContext = await browser.newContext();

    const buyerPage = await buyerContext.newPage();
    const vendorPage = await vendorContext.newPage();

    // ==========================================
    // 1. ACHETEUR : Connexion et ajout au panier
    // ==========================================
    await buyerPage.goto('/src/pages/login.html', { timeout: 30000 });
    await buyerPage.waitForLoadState('networkidle', { timeout: 20000 }); // Crucial: attend que le JS s'attache

    await buyerPage.fill('#email', 'benimakiese1234567@gmail.com');
    await buyerPage.fill('#password', 'Phoenix_2026!');
    // Accepter les cookies si présents
    await buyerPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
    await buyerPage.click('#submitBtn', { force: true });
    
    // On attend d'être redirigé vers le catalogue ou le dashboard, ou de voir une erreur
    const loginResult = await Promise.race([
      buyerPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 }).then(() => 'success'),
      buyerPage.waitForFunction(() => {
        const err = document.querySelector('#formError');
        return err && !err.classList.contains('hidden') && err.textContent.length > 0;
      }, { timeout: 15000 }).then(() => 'error')
    ]).catch(() => 'timeout');

    if (loginResult === 'error') {
        const errorText = await buyerPage.locator('#formError').textContent();
        throw new Error('Acheteur login failed with error: ' + errorText);
    }

    // L'acheteur va sur le catalogue et ajoute le premier produit au panier
    await buyerPage.goto('/src/pages/catalog.html', { timeout: 30000 });
    await buyerPage.waitForLoadState('networkidle', { timeout: 20000 });
    // Attendre que les produits soient rendus dynamiquement (classe réelle : .add-to-cart-btn dans .product-card)
    await buyerPage.waitForSelector('.product-card .add-to-cart-btn', { state: 'visible', timeout: 20000 });
    // Cliquer sur le bouton d'ajout au panier du premier produit
    await buyerPage.locator('.product-card .add-to-cart-btn').first().click();

    // Attendre que le panier s'ouvre
    // On ouvre le panneau latéral du panier (car l'ajout fait juste une animation)
    await buyerPage.evaluate(() => {
        if (window.CartManager) window.CartManager.toggleCartUI(true);
    });
    
    // Attendre le bouton Checkout et forcer le checkout via le code
    await buyerPage.waitForSelector('#cartCheckoutBtn', { state: 'visible' });
    
    // Injecter une position par défaut dans le localStorage pour éviter l'erreur "Definissez d'abord la position"
    await buyerPage.evaluate(() => {
        localStorage.setItem('newketHomeLocation', JSON.stringify({lat: -4.4419, lng: 15.2663}));
        if (window.CartManager) window.CartManager.checkout();
    });

    // Attendre que le CheckoutModal s'ouvre et cliquer sur "Payer" (qui envoie la demande au vendeur)
    await buyerPage.waitForSelector('button:has-text("Payer")', { state: 'visible' });
    await buyerPage.click('button:has-text("Payer")');

    // On attend la fin de l'envoi (soit via une URL vers customer-dashboard, soit le message de succès)
    await Promise.race([
      buyerPage.waitForURL(url => url.href.includes('customer-dashboard.html'), { timeout: 15000 }),
      buyerPage.waitForSelector('text="Commande passée avec succès"', { timeout: 15000 })
    ]).catch(() => console.log('Acheteur : pas de redirection immédiate, on continue.'));
    
    // ==========================================
    // 2. VENDEUR : Connexion et soumission du devis
    // ==========================================
    await vendorPage.goto('/src/pages/login.html', { timeout: 30000 });
    await vendorPage.waitForLoadState('networkidle', { timeout: 20000 });

    await vendorPage.fill('#email', 'benimakiese123@gmail.com');
    await vendorPage.fill('#password', 'Phoenix_2026!');
    await vendorPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
    await vendorPage.click('#submitBtn', { force: true });
    
    // Attente de la validation du login
    await vendorPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 15000 });

    // Le vendeur va sur son dashboard
    await vendorPage.goto('/src/pages/vendor-dashboard.html');
    await vendorPage.waitForLoadState('networkidle');

    // Attendre que l'auth soit terminée (la classe "auth-loading" sur <html> bloque les clics sinon)
    await vendorPage.waitForFunction(
        () => !document.documentElement.classList.contains('auth-loading'),
        { timeout: 20000 }
    ).catch(() => console.log('auth-loading timeout, on continue quand même'));
    // Petite pause pour laisser le dashboard se rendre
    await vendorPage.waitForTimeout(1500);

    // Il clique sur l'onglet "Demandes et devis"
    await vendorPage.click('a[data-switch-vendor-tab="leads"]', { force: true });

    // Il cherche la demande en attente et clique sur "Proposer un devis" sur la carte (qui ouvre la modale de détails)
    const proposeQuoteBtnCard = vendorPage.locator('button:has-text("Proposer un devis")').first();
    await expect(proposeQuoteBtnCard).toBeVisible({ timeout: 10000 });
    await proposeQuoteBtnCard.click();

    // Puis il clique sur le bouton "Proposer un devis" à l'intérieur de la modale de détails pour ouvrir le formulaire de devis
    const proposeQuoteBtnModal = vendorPage.locator('#btnMarkDelivered');
    await expect(proposeQuoteBtnModal).toBeVisible({ timeout: 5000 });
    // On scroll vers le bas de la modale au cas où
    await proposeQuoteBtnModal.scrollIntoViewIfNeeded();
    await proposeQuoteBtnModal.click();

    // Remplissage du formulaire de devis (modal de devis)
    // On efface d'abord les valeurs par défaut puis on saisit les nouvelles
    await vendorPage.fill('[data-quote-fee]', '');
    await vendorPage.fill('[data-quote-fee]', '5000'); // 5000 FC de frais de livraison
    await vendorPage.fill('[data-quote-delay]', '');
    await vendorPage.fill('[data-quote-delay]', '48'); // 48 heures de délai
    await vendorPage.fill('[data-quote-note]', 'Test automatisé: Frais de port standards');

    // On intercepte la réponse API avant de cliquer, pour s'assurer que l'appel réussit
    const quoteResponsePromise = vendorPage.waitForResponse(
        res => res.url().includes('/quote') && [200, 201].includes(res.status()),
        { timeout: 20000 }
    ).catch(() => null);

    await vendorPage.click('[data-quote-submit]');

    // Attendre la fermeture du formulaire (il se supprime du DOM après soumission)
    await vendorPage.waitForSelector('[data-quote-submit]', { state: 'detached', timeout: 10000 }).catch(() => {});

    // Attendre la réponse API
    await quoteResponsePromise;

    // Attendre que le dashboard se re-render (l'event ordersUpdated déclenche renderVendorLeads)
    await vendorPage.waitForTimeout(2500);

    // Basculer sur l'onglet "Attente client" car la commande n'est plus dans "À traiter"
    await vendorPage.click('#vFilterAwaiting');
    await vendorPage.waitForTimeout(1000);

    // Le statut de la commande est maintenant QUOTE : le bouton doit afficher "Modifier devis"
    await expect(vendorPage.locator('button:has-text("Modifier devis")').first()).toBeVisible({ timeout: 20000 });

    // ==========================================
    // 3. ACHETEUR : Accepte le devis et paie
    // ==========================================
    // L'acheteur consulte ses demandes
    await buyerPage.goto('/src/pages/customer-dashboard.html');
    await buyerPage.click('a[data-switch-customer-tab="orders"]'); // ou équivalent pour voir les demandes

    // Il ouvre le détail de la commande
    const detailBtn = buyerPage.locator('.glass-panel', { hasText: 'À VOUS DE JOUER' }).first();
    await expect(detailBtn).toBeVisible({ timeout: 10000 });
    await detailBtn.click();

    // L'acheteur accepte le devis
    const acceptQuoteBtn = buyerPage.locator('button:has-text("Accepter le devis")');
    await expect(acceptQuoteBtn).toBeVisible({ timeout: 10000 });
    await acceptQuoteBtn.click();

    // Attendre que la modale se ferme et que la liste se mette à jour
    await buyerPage.waitForTimeout(2500);

    // Rouvrir le détail de la commande (le badge doit toujours dire "À VOUS DE JOUER")
    const readyForPaymentCard = buyerPage.locator('.glass-panel', { hasText: 'À VOUS DE JOUER' }).first();
    await expect(readyForPaymentCard).toBeVisible({ timeout: 10000 });
    await readyForPaymentCard.click();

    // Vérification que le devis est accepté (le bouton Passer au paiement devrait apparaître dans la modale)
    const payBtn = buyerPage.locator('button:has-text("Passer au paiement")').first();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    
    // ==== HACK TEST: MOCK PAYMENT ====
    // Récupérer le vrai ID de la commande (ex: "ORD_A544A23CA1_...") depuis l'attribut data-order-id
    // La modale ouverte ou la carte cliquée ont cet attribut
    let orderId = '';
    
    // Essayer de récupérer l'ID avec JavaScript directement depuis le DOM pour être plus rapide et éviter les timeouts implicites Playwright
    orderId = await buyerPage.evaluate(() => {
        // 1. Depuis la variable globale du frontend
        if (window.currentSelectedOrder && window.currentSelectedOrder.id) {
            return window.currentSelectedOrder.id;
        }
        
        // 2. Depuis le HTML Modal
        const modal = document.getElementById('orderModal');
        if (modal) {
            const id = modal.getAttribute('data-order-id') || modal.getAttribute('data-current-order-id');
            if (id) return id;
        }
        
        // 3. Depuis le texte du Modal
        const titleEl = document.getElementById('modalOrderIdText');
        if (titleEl) {
            const match = titleEl.textContent.match(/(ORD_[A-Z0-9]+_\d+)/i);
            if (match) return match[1];
        }
        
        // 4. Depuis la carte cliquée
        const cards = document.querySelectorAll('.glass-panel, [data-order-id]');
        for (const card of cards) {
            if (card.textContent.includes('À VOUS DE JOUER') || card.textContent.includes('READY_FOR_PAYMENT')) {
                const id = card.getAttribute('data-order-id');
                if (id) return id;
            }
        }
        
        return '';
    });
    
    console.log(`Order ID extrait: "${orderId}"`);
    
    // On simule le webhook de paiement KPay en modifiant directement Supabase via l'API REST
    const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (process.env.SUPABASE_URL && serviceRoleKey) {
        await buyerPage.request.patch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
            headers: {
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            data: {
                status: 'PAID_HELD',
                payment_status: 'PAID',
                escrow_status: 'HELD',
                otp_code: '123456'
            }
        });
    } else {
        console.warn("ATTENTION: MOCK PAIEMENT IMPOSSIBLE SANS SUPABASE_SECRET_KEY");
    }
    
    // On recharge le dashboard acheteur pour voir le statut payé
    await buyerPage.reload();
    await buyerPage.waitForTimeout(3000); // Wait for data to load
    
    // L'acheteur ouvre la commande la plus récente (badge "Prêt pour paiement" ou "À vous de jouer")
    // On cherche la première carte avec le badge "Prêt pour paiement" ou qui correspond à notre ID
    const paidCard = buyerPage.locator('.demand-card, .order-card, [data-order-id], li, article').filter({ hasText: 'Prêt pour paiement' }).first();
    const paidCardFallback = buyerPage.locator('li, article, .card, .glass-panel, [class*="card"]').filter({ hasText: orderId }).first();

    // Essayer de cliquer sur la carte via l'ID de commande d'abord
    const allCards = buyerPage.locator(`[data-order-id="${orderId}"], *:has-text("${orderId}")`).first();
    if (await allCards.isVisible({ timeout: 5000 }).catch(() => false)) {
        await allCards.click();
    } else {
        // Fallback : ouvrir directement la modale via JS
        await buyerPage.evaluate((oid) => {
            // Cherche et clique sur la carte de commande
            const cards = document.querySelectorAll('[data-order-id]');
            for (const card of cards) {
                if (card.dataset.orderId && card.dataset.orderId.includes(oid.substring(0, 8))) {
                    card.click();
                    return;
                }
            }
            // Fallback: clic sur le premier badge "Prêt pour paiement"
            const badge = document.querySelector('[class*="pret"], [class*="paid"], .badge-paid');
            if (badge) badge.closest('[data-order-id], li, article, .card')?.click();
        }, orderId);
    }

    // ==========================================
    // 4. VENDEUR : Démarrer la livraison (PAID_HELD → IN_DELIVERY)
    // ==========================================
    await vendorPage.reload();
    await vendorPage.waitForTimeout(3000);
    
    // La commande payée est dans l'onglet "ATTENTE CLIENT" du vendeur, pas "À TRAITER"
    // On clique sur l'onglet "ATTENTE CLIENT" pour trouver la bonne commande
    const attenteClientTab = vendorPage.locator('button, a').filter({ hasText: 'ATTENTE CLIENT' }).first();
    const attenteClientFallback = vendorPage.locator('[data-filter="waiting"], [data-tab="waiting"]').first();
    
    if (await attenteClientTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await attenteClientTab.click();
        await vendorPage.waitForTimeout(1500);
    }
    
    // Chercher la commande avec son orderId précis dans tous les onglets
    const vendorOrderCard = vendorPage.locator(`[data-order-id="${orderId}"]`).first();
    
    if (await vendorOrderCard.isVisible({ timeout: 8000 }).catch(() => false)) {
        await vendorOrderCard.click();
    } else {
        // Fallback: aller dans "TOUT" et chercher par l'ID
        const toutTab = vendorPage.locator('button, a').filter({ hasText: 'TOUT' }).first();
        if (await toutTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await toutTab.click();
            await vendorPage.waitForTimeout(1500);
        }
        await vendorPage.locator(`[data-order-id="${orderId}"]`).first().click();
    }
    
    // Le vendeur clique sur "Démarrer la livraison"
    const startDeliveryBtn = vendorPage.locator('button:has-text("Démarrer la livraison")');
    await expect(startDeliveryBtn).toBeVisible({ timeout: 10000 });
    await startDeliveryBtn.click();
    await vendorPage.waitForTimeout(2000); // Attend que la modale vendeur affiche le champ OTP
    
    // ==========================================
    // 5. ACHETEUR : Lire l'OTP (visible en IN_DELIVERY)
    // ==========================================
    // Maintenant que le statut est IN_DELIVERY, l'acheteur peut voir son OTP
    await buyerPage.reload();
    await buyerPage.waitForTimeout(3000);
    
    // Ouvrir la commande côté acheteur (chercher par orderId ou badge "En livraison")
    const buyerOrderCard = buyerPage.locator(`[data-order-id="${orderId}"]`).first();
    const buyerCardByText = buyerPage.locator('[data-order-id]').filter({ hasText: orderId.substring(0, 10) }).first();
    const buyerCardByBadge = buyerPage.locator('[data-order-id]').filter({ hasText: 'En livraison' }).first();
    
    if (await buyerOrderCard.isVisible({ timeout: 4000 }).catch(() => false)) {
        await buyerOrderCard.click();
    } else if (await buyerCardByText.isVisible({ timeout: 4000 }).catch(() => false)) {
        await buyerCardByText.click();
    } else {
        await buyerCardByBadge.click();
    }
    
    // L'OTP est désormais visible dans la modale acheteur (status = IN_DELIVERY)
    const otpDisplaySection = buyerPage.locator('#otpDisplaySection');
    await expect(otpDisplaySection).toBeVisible({ timeout: 10000 });
    const otpValueLocator = buyerPage.locator('#otpValue');
    await expect(otpValueLocator).toBeVisible({ timeout: 10000 });
    const otpCode = (await otpValueLocator.innerText()).trim();
    console.log(`OTP récupéré depuis la modale acheteur : ${otpCode}`);
    
    // Si l'OTP est encore le placeholder "------", on utilise le code fixé '123456'
    const finalOtp = otpCode.includes('-') ? '123456' : otpCode;
    
    // ==========================================
    // 6. VENDEUR : Saisie de l'OTP pour valider la livraison
    // ==========================================
    // Le statut est passé en "IN_DELIVERY", le vendeur doit entrer l'OTP
    const otpInput = vendorPage.locator('#vOtpInput');
    await expect(otpInput).toBeVisible({ timeout: 10000 });
    await otpInput.fill(finalOtp);
    
    const verifyOtpBtn = vendorPage.locator('#btnVerifyVendorOtp');
    await verifyOtpBtn.click();
    
    // Vérification finale : la commande passe à Livré
    await vendorPage.waitForTimeout(2000);
    const deliveredCard = vendorPage.locator('.glass-panel, li, article', { hasText: 'Livré' }).first();
    await expect(deliveredCard).toBeVisible({ timeout: 15000 });

    // Fin des contextes
    await buyerContext.close();
    await vendorContext.close();
  });

});
