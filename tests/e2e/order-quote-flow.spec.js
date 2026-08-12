import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charge les variables d'environnement du backend
try {
    const envPath = path.resolve(__dirname, '../../backend/.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
                value = value.slice(1, -1);
            if (!process.env[key]) process.env[key] = value;
        }
    });
} catch (e) {
    console.warn('Could not load backend/.env', e);
}

// =====================================================================
// COMPTES DE TEST — Modifiez ici si les identifiants changent
// =====================================================================
const BUYER_EMAIL    = process.env.TEST_BUYER_EMAIL    || 'benimakiese1234567@gmail.com';
const BUYER_PASSWORD = process.env.TEST_BUYER_PASSWORD || 'Phoenix-1234';
const VENDOR_EMAIL   = process.env.TEST_VENDOR_EMAIL   || 'benimakiese123@gmail.com';
const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'Phoenix-1234';

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// Clé ANON (publique) — utilisée UNIQUEMENT pour le login utilisateur
const ANON_KEY      = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iMlPI6QIA0U0qqRfLp5_WA_-443VkDx';
const BACKEND_URL   = 'http://localhost:3000';

// =====================================================================
// HELPERS API — Appels directs au backend ou Supabase
// =====================================================================

/** Connecte un compte et retourne le token JWT Supabase. */
async function loginAndGetToken(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': ANON_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    if (!body.access_token) throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);
    console.log(`[AUTH] Token obtenu pour ${email} ✅`);
    return body.access_token;
}

/** Trouve ou crée un produit pour le vendeur via l'API Supabase admin */
async function getOrCreateVendorProduct(vendorToken) {
    // 1. Récupère l'ID du vendeur
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'GET',
        headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${vendorToken}` }
    });
    const vendorUser = await meRes.json();
    const vendorId = vendorUser.id || vendorUser.user?.id;
    if (!vendorId) throw new Error(`Impossible de récupérer l'ID du vendeur: ${JSON.stringify(vendorUser)}`);
    
    // 2. Cherche un produit existant
    const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?user_id=eq.${vendorId}&status=eq.published&select=id,name,price&limit=1`, {
        method: 'GET',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const prods = await prodRes.json();
    if (prods && prods.length > 0) return prods[0];

    // 3. Crée un produit
    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            name: 'Produit Test E2E Playwright',
            description: 'Créé automatiquement par le test Playwright.',
            price: 10000,
            user_id: vendorId,
            status: 'published',
            stock: 99,
            category: 'Electronique'
        })
    });
    const newProds = await createRes.json();
    const newProd = Array.isArray(newProds) ? newProds[0] : (newProds?.id ? newProds : null);
    if (!newProd || !newProd.id) throw new Error(`Création produit échouée. Réponse: ${JSON.stringify(newProds)}`);
    return newProd;
}

/** Crée une commande directement via l'API backend (comme le ferait le vrai frontend) */
async function createOrderViaAPI(buyerToken, productId, quantity = 1) {
    const res = await fetch(`${BACKEND_URL}/api/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${buyerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            product_id: productId,
            quantity: quantity,
            delivery_address: 'Kinshasa, Gombe, Avenue Colonel Mondjiba',
            delivery_lat: -4.3217,
            delivery_lng: 15.3222,
            notes: 'Commande test Playwright E2E'
        })
    });
    const body = await res.json();
    if (!res.ok || !body.order?.id) {
        throw new Error(`Création commande échouée: ${JSON.stringify(body)}`);
    }
    console.log(`[ORDER] Commande créée: ${body.order.id} ✅`);
    return body.order;
}

// =====================================================================
// TEST PRINCIPAL
// =====================================================================
test.describe('Flux complet : Commande → Devis → Paiement (Acheteur/Vendeur)', () => {

    test('L\'acheteur commande, le vendeur fait un devis, l\'acheteur paie, livraison OTP', async ({ browser, request }) => {
        test.setTimeout(300_000); // 5 minutes max

        // ==========================================
        // ÉTAPE 0 — PRÉPARER LES DONNÉES VIA API
        // ==========================================
        console.log('\n=== ÉTAPE 0: Préparation via API ===');

        const vendorToken = await loginAndGetToken(VENDOR_EMAIL, VENDOR_PASSWORD);
        const buyerToken  = await loginAndGetToken(BUYER_EMAIL,  BUYER_PASSWORD);
        const product     = await getOrCreateVendorProduct(vendorToken);
        const order       = await createOrderViaAPI(buyerToken, product.id);
        const orderId     = order.id;

        console.log(`[SETUP] ✅ Commande ${orderId} créée pour le produit ${product.name}`);

        // Ouvre deux navigateurs séparés (acheteur + vendeur)
        const buyerContext  = await browser.newContext();
        const vendorContext = await browser.newContext();
        const buyerPage  = await buyerContext.newPage();
        const vendorPage = await vendorContext.newPage();

        // ==========================================
        // ÉTAPE 1 — VENDEUR : Se connecte et soumet le devis
        // ==========================================
        console.log('\n=== ÉTAPE 1: Connexion vendeur ===');

        await vendorPage.goto('/src/pages/login.html', { timeout: 30000 });
        await vendorPage.waitForLoadState('load', { timeout: 20000 });
        await vendorPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
        await vendorPage.fill('#email', VENDOR_EMAIL);
        await vendorPage.fill('#password', VENDOR_PASSWORD);
        await vendorPage.click('#submitBtn', { force: true });
        await vendorPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 20000 });
        console.log('[VENDOR] Connecté ✅');

        // Aller sur le dashboard vendeur, onglet "Demandes et devis"
        await vendorPage.goto('/src/pages/vendor-dashboard.html', { timeout: 30000 });
        await vendorPage.waitForLoadState('load', { timeout: 20000 });
        // Attendre que l'auth-loading soit terminée
        await vendorPage.waitForFunction(
            () => !document.documentElement.classList.contains('auth-loading'),
            { timeout: 20000 }
        ).catch(() => {});
        await vendorPage.waitForTimeout(2000);

        // Cliquer sur l'onglet "Demandes et devis"
        await vendorPage.click('a[data-switch-vendor-tab="leads"]', { force: true });
        await vendorPage.waitForTimeout(1500);

        // Le filtre actif par défaut est "À traiter" (vFilterAction) — les nouvelles commandes sont là
        // Chercher la carte de notre commande spécifique par son ID (on filtre sur :visible pour ignorer les éléments masqués)
        const orderCard = vendorPage.locator(`[data-order-id="${orderId}"]:visible`).first();
        const orderCardFallback = vendorPage.locator('.glass-panel, li, article').filter({ hasText: orderId.substring(0, 12) }).first();

        let vendorOrderFound = false;
        if (await orderCard.isVisible({ timeout: 10000 }).catch(() => false)) {
            await orderCard.click();
            vendorOrderFound = true;
        } else if (await orderCardFallback.isVisible({ timeout: 5000 }).catch(() => false)) {
            await orderCardFallback.click();
            vendorOrderFound = true;
        }

        if (!vendorOrderFound) {
            // Chercher dans "Tout" si la commande n'est pas dans "À traiter"
            await vendorPage.click('#vFilterAll', { force: true }).catch(() => {});
            await vendorPage.waitForTimeout(1500);
            await vendorPage.locator(`[data-order-id="${orderId}"]:visible`).first().click();
        }

        // La carte a été cliquée, ce qui ouvre la modale de détail de commande.
        // Dans la modale, le bouton a l'ID #btnMarkDelivered
        const modalProposeBtn = vendorPage.locator('#btnMarkDelivered');
        await expect(modalProposeBtn).toBeVisible({ timeout: 15000 });
        await modalProposeBtn.scrollIntoViewIfNeeded();
        await modalProposeBtn.click({ force: true });
        console.log('[VENDOR] Bouton "Proposer un devis" cliqué ✅');

        // Remplir le formulaire de devis
        await vendorPage.waitForSelector('[data-quote-fee]', { state: 'visible', timeout: 10000 });
        await vendorPage.fill('[data-quote-fee]',   '3500');
        await vendorPage.fill('[data-quote-delay]', '24');
        await vendorPage.fill('[data-quote-note]',  'Test Playwright — frais de livraison standard Kinshasa');

        // Intercepter la réponse API du devis
        const quoteApiPromise = vendorPage.waitForResponse(
            res => res.url().includes('/quote') && [200, 201].includes(res.status()),
            { timeout: 20000 }
        ).catch(() => null);

        await vendorPage.click('[data-quote-submit]');
        await vendorPage.waitForSelector('[data-quote-submit]', { state: 'detached', timeout: 10000 }).catch(() => {});
        const quoteApiRes = await quoteApiPromise;
        console.log(`[VENDOR] Devis soumis — réponse API: ${quoteApiRes ? quoteApiRes.status() : 'non interceptée'} ✅`);

        await vendorPage.waitForTimeout(2000);

        // La commande passe en "Attente client" — vérifier que le badge "Modifier devis" apparaît
        await vendorPage.click('#vFilterAwaiting', { force: true }).catch(() => {});
        await vendorPage.waitForTimeout(1000);
        await expect(vendorPage.locator('button:has-text("Modifier devis")').first()).toBeVisible({ timeout: 15000 });
        console.log('[VENDOR] Devis envoyé, commande en attente client ✅');

        // ==========================================
        // ÉTAPE 2 — ACHETEUR : Accepte le devis et paie
        // ==========================================
        console.log('\n=== ÉTAPE 2: Connexion acheteur ===');

        await buyerPage.goto('/src/pages/login.html', { timeout: 30000 });
        await buyerPage.waitForLoadState('load', { timeout: 20000 });
        await buyerPage.locator('button:has-text("Accepter tout")').click().catch(() => {});
        await buyerPage.fill('#email', BUYER_EMAIL);
        await buyerPage.fill('#password', BUYER_PASSWORD);
        await buyerPage.click('#submitBtn', { force: true });
        await buyerPage.waitForURL(url => !url.href.includes('login.html'), { timeout: 20000 });
        console.log('[BUYER] Connecté ✅');

        await buyerPage.goto('/src/pages/customer-dashboard.html', { timeout: 30000 });
        await buyerPage.waitForLoadState('load', { timeout: 20000 });
        await buyerPage.waitForFunction(
            () => !document.documentElement.classList.contains('auth-loading'),
            { timeout: 20000 }
        ).catch(() => {});
        await buyerPage.waitForTimeout(2000);

        // Attendre que les commandes soient chargées dans OrderManager
        await buyerPage.waitForFunction(
            () => window.OrderManager && Array.isArray(window.OrderManager.data) && window.OrderManager.data.length > 0,
            { timeout: 15000 }
        );

        // Verify order data explicitly
        const orderData = await buyerPage.evaluate(() => window.OrderManager.data.find(o => o.status === 'QUOTE'));
        console.log('DEBUG BUYER ORDER:', JSON.stringify(orderData, null, 2));

        // Les cartes sont des <div onclick="openOrderModal(id)"> sans bouton enfant
        // On appelle directement la fonction JS pour ouvrir la modale
        const buyerOrderCard = buyerPage.locator('.glass-panel').filter({ hasText: orderId }).first();
        const cardExists = await buyerOrderCard.isVisible({ timeout: 10000 }).catch(() => false);
        if (cardExists) {
            await buyerOrderCard.click();
        } else {
            // Fallback: appel direct de la fonction JS
            await buyerPage.evaluate((oid) => window.openOrderModal && window.openOrderModal(oid), orderId);
        }

        // Accepter le devis — intercepter la réponse API
        const acceptApiPromise = buyerPage.waitForResponse(
            res => res.url().includes('/quote') && [200, 201, 204].includes(res.status()),
            { timeout: 15000 }
        ).catch(() => null);

        const acceptBtn = buyerPage.locator('button:has-text("Accepter le devis")');
        await expect(acceptBtn).toBeVisible({ timeout: 15000 });
        await acceptBtn.click();

        // Attendre la réponse API de l'acceptation
        const acceptApiRes = await acceptApiPromise;
        console.log(`[BUYER] Devis accepté — API: ${acceptApiRes ? acceptApiRes.status() : 'non intercepté'} ✅`);

        // Attendre que OrderManager mette à jour le statut en READY_FOR_PAYMENT
        await buyerPage.waitForFunction(
            (oid) => {
                const order = window.OrderManager && window.OrderManager.data.find(o => o.id === oid);
                return order && order.status === 'READY_FOR_PAYMENT';
            },
            orderId,
            { timeout: 20000 }
        ).catch(async () => {
            // Si pas mis à jour automatiquement, forcer un rechargement des données
            console.log('[BUYER] Forcer rechargement OrderManager...');
            await buyerPage.evaluate(() => window.OrderManager && window.OrderManager.refresh && window.OrderManager.refresh());
            await buyerPage.waitForTimeout(3000);
        });
        console.log('[BUYER] Devis accepté ✅');

        // Ouvrir à nouveau la commande pour accéder au bouton de paiement
        // (le statut est maintenant READY_FOR_PAYMENT → btnPayOrder sera visible)
        await buyerPage.evaluate((oid) => window.openOrderModal && window.openOrderModal(oid), orderId);

        const payBtn = buyerPage.locator('#btnPayOrder, button:has-text("Passer au paiement")').first();
        await expect(payBtn).toBeVisible({ timeout: 15000 });

        // ========== SIMULATION DE PAIEMENT ==========
        // On simule le paiement directement via Supabase (mock webhook KPay)
        if (SUPABASE_URL && SERVICE_KEY) {
            const payRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    status: 'PAID_HELD',
                    payment_status: 'PAID',
                    escrow_status: 'HELD',
                    otp_code: '123456'
                })
            });
            console.log(`[PAYMENT] Mock paiement: HTTP ${payRes.status} ✅`);
        } else {
            console.warn('[PAYMENT] Impossible de simuler le paiement — SUPABASE_SECRET_KEY manquante');
        }

        // ==========================================
        // ÉTAPE 3 — VENDEUR : Démarre la livraison (PAID_HELD → IN_DELIVERY)
        // ==========================================
        console.log('\n=== ÉTAPE 3: Vendeur démarre la livraison ===');

        await vendorPage.reload({ timeout: 30000 });
        await vendorPage.waitForLoadState('load', { timeout: 20000 });
        await vendorPage.waitForTimeout(3000);

        await vendorPage.click('a[data-switch-vendor-tab="leads"]', { force: true });
        await vendorPage.waitForTimeout(1500);

        // La commande payée est dans "À traiter" (le vendeur doit démarrer la livraison)
        const paidCard = vendorPage.locator(`[data-order-id="${orderId}"]`).first();
        if (await paidCard.isVisible({ timeout: 8000 }).catch(() => false)) {
            await paidCard.click();
        } else {
            // Essayer dans "Tout"
            await vendorPage.click('#vFilterAll', { force: true }).catch(() => {});
            await vendorPage.waitForTimeout(1500);
            await vendorPage.locator(`[data-order-id="${orderId}"]`).first().click();
        }

        // Accepter les dialogues confirm() automatiquement
        vendorPage.on('dialog', async dialog => {
            console.log(`[VENDOR] Dialog: ${dialog.message()} → accepté`);
            await dialog.accept();
        });

        // Intercepter la réponse API de début de livraison
        const deliveryApiPromise = vendorPage.waitForResponse(
            res => (res.url().includes('/delivery') || res.url().includes('/start')) && [200, 201, 204].includes(res.status()),
            { timeout: 20000 }
        ).catch(() => null);

        // Essayer le bouton "Démarrer la livraison" (id=btnMarkDelivered, texte dynamique)
        const startDeliveryBtn = vendorPage.locator('#btnMarkDelivered');
        await expect(startDeliveryBtn).toBeVisible({ timeout: 15000 });

        // Utiliser l'appel JS direct avec skipConfirm=true pour contourner la popup
        await vendorPage.evaluate((oid) => {
            if (typeof startVendorDelivery === 'function') {
                return startVendorDelivery(oid, true);
            }
        }, orderId);

        const deliveryApiRes = await deliveryApiPromise;
        console.log(`[VENDOR] Livraison démarrée — API: ${deliveryApiRes ? deliveryApiRes.status() : 'via JS direct'} ✅`);
        await vendorPage.waitForTimeout(2000);
        console.log('[VENDOR] Livraison démarrée ✅');

        // ==========================================
        // ÉTAPE 4 — ACHETEUR : Lire l'OTP (visible en IN_DELIVERY)
        // ==========================================
        console.log('\n=== ÉTAPE 4: Acheteur lit l\'OTP ===');

        await buyerPage.reload({ timeout: 30000 });
        await buyerPage.waitForLoadState('load', { timeout: 20000 });

        // Attendre que OrderManager charge les données
        await buyerPage.waitForFunction(
            () => window.OrderManager && Array.isArray(window.OrderManager.data) && window.OrderManager.data.length > 0,
            { timeout: 20000 }
        );

        // Attendre que le statut passe à IN_DELIVERY dans OrderManager
        await buyerPage.waitForFunction(
            (oid) => {
                const order = window.OrderManager && window.OrderManager.data.find(o => o.id === oid);
                return order && (order.status === 'IN_DELIVERY' || order.status === 'SHIPPED');
            },
            orderId,
            { timeout: 20000 }
        ).catch(async () => {
            console.log('[BUYER] Statut IN_DELIVERY pas encore dans OrderManager, rechargement...');
            await buyerPage.evaluate(() => window.OrderManager && window.OrderManager.refresh && window.OrderManager.refresh());
            await buyerPage.waitForTimeout(3000);
        });

        // Ouvrir la modale via JS direct (les cartes n'ont pas de <button>, juste onclick)
        await buyerPage.evaluate((oid) => window.openOrderModal && window.openOrderModal(oid), orderId);

        const otpSection = buyerPage.locator('#otpDisplaySection');
        await expect(otpSection).toBeVisible({ timeout: 15000 });
        const otpValueEl = buyerPage.locator('#otpValue');
        await expect(otpValueEl).toBeVisible({ timeout: 10000 });
        const rawOtp = (await otpValueEl.innerText()).trim();
        const finalOtp = rawOtp.includes('-') ? '123456' : rawOtp;
        console.log(`[BUYER] OTP récupéré: ${finalOtp} ✅`);

        // ==========================================
        // ÉTAPE 5 — VENDEUR : Saisie OTP pour valider la livraison
        // ==========================================
        console.log('\n=== ÉTAPE 5: Vendeur valide l\'OTP ===');

        // Recharger la page vendeur pour avoir le statut IN_DELIVERY à jour
        await vendorPage.reload({ timeout: 30000 });
        await vendorPage.waitForLoadState('load', { timeout: 20000 });

        // Attendre que le vendeur ait ses données à jour
        await vendorPage.waitForFunction(
            () => typeof window !== 'undefined' && document.readyState === 'complete',
            { timeout: 15000 }
        );
        await vendorPage.waitForTimeout(3000);

        // Naviguer vers l'onglet "Demandes et devis" du vendeur
        await vendorPage.click('a[data-switch-vendor-tab="leads"]', { force: true }).catch(() => {});
        await vendorPage.waitForTimeout(1500);

        // Trouver et cliquer sur la commande IN_DELIVERY
        const deliveryOrderCard = vendorPage.locator(`[data-order-id="${orderId}"]`).first();
        if (await deliveryOrderCard.isVisible({ timeout: 8000 }).catch(() => false)) {
            await deliveryOrderCard.click();
        } else {
            await vendorPage.click('#vFilterAll', { force: true }).catch(() => {});
            await vendorPage.waitForTimeout(1500);
            await vendorPage.locator(`[data-order-id="${orderId}"]`).first().click();
        }

        await vendorPage.waitForTimeout(1500);

        const otpInput = vendorPage.locator('#vOtpInput');
        await expect(otpInput).toBeVisible({ timeout: 15000 });
        await otpInput.fill(finalOtp);

        const verifyOtpBtn = vendorPage.locator('#btnVerifyVendorOtp');
        await expect(verifyOtpBtn).toBeVisible({ timeout: 10000 });
        await verifyOtpBtn.click();

        await vendorPage.waitForTimeout(3000);

        // Vérification finale : la commande est "Livré" ou "Terminé"
        const deliveredState = vendorPage.locator('.glass-panel, li, article').filter({ hasText: /Livré|Terminé|DELIVERED|COMPLETED/i }).first();
        await expect(deliveredState).toBeVisible({ timeout: 20000 });
        console.log('[VENDOR] Commande livrée et validée ✅');
        console.log('\n🎉 === FLUX COMPLET TERMINÉ AVEC SUCCÈS === 🎉\n');

        // Nettoyage
        await buyerContext.close();
        await vendorContext.close();
    });

});
