
import dotenv from 'dotenv';
import supabasePkg from '@supabase/supabase-js';
const { createClient } = supabasePkg;

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = `http://localhost:${process.env.PORT || 3001}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testPriceManipulation() {
    console.log('\n--- 🧪 TEST 1: Tentative de manipulation de prix ---');
    
    // On utilise un produit existant : AirPods Pack (98000 XOF)
    const productId = 'prod-1775519991448';
    const fakeAmount = 1; // On essaie de payer 1 XOF au lieu de 98000
    
    try {
        console.log(`Envoi d'une requête de paiement pour le produit ${productId} avec un montant frauduleux de ${fakeAmount} XOF...`);
        
        // Note: Cette requête DOIT échouer si non authentifiée (requireAuth)
        const response = await fetch(`${API_URL}/api/payments/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                product_id: productId,
                vendor_id: 'vendor_test',
                amount: fakeAmount, // Sera ignoré par le backend
                customer_phone: '00000000',
                customer_name: 'Test Security'
            })
        });
        
        const data = await response.json();
        
        if (response.status === 401) {
            console.log('✅ SUCCÈS : Requête bloquée car non authentifiée (Code 401).');
        } else {
            console.log('❌ ÉCHEC : La requête aurait dû être bloquée par requireAuth.');
            console.log('Status:', response.status, 'Data:', data);
        }
    } catch (err) {
        console.error('Erreur lors du test:', err.message);
    }
}

async function testMaintenanceMode() {
    console.log('\n--- 🧪 TEST 2: Mode Maintenance ---');
    
    try {
        console.log('Activation du mode maintenance en base de données...');
        await supabase
            .from('settings')
            .update({ maintenanceMode: true })
            .eq('id', 'global-settings');
            
        console.log('Attente de 2 secondes pour l\'expiration potentielle du cache (si déjà en mémoire)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Tentative d\'appel POST (bloqué en maintenance)...');
        const response = await fetch(`${API_URL}/api/payments/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if (response.status === 503) {
            console.log('✅ SUCCÈS : Le backend a renvoyé 503 Service Unavailable.');
            console.log('Message:', data.message);
        } else {
            console.log('❌ ÉCHEC : Le backend n\'a pas bloqué la requête en mode maintenance.');
            console.log('Status:', response.status, 'Data:', data);
        }
        
    } finally {
        console.log('Désactivation du mode maintenance...');
        await supabase
            .from('settings')
            .update({ maintenanceMode: false })
            .eq('id', 'global-settings');
    }
}

async function runTests() {
    console.log('🚀 Démarrage des tests de sécurité...');
    await testPriceManipulation();
    await testMaintenanceMode();
    console.log('\n🏁 Tests terminés.');
}

runTests();
