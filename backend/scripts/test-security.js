import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Aborting test script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setMaintenanceMode(enabled) {
  // Prefer camelCase schema, but support legacy snake_case.
  const tryUpdate = async (payload) => {
    const { error } = await supabase.from('settings').update(payload).eq('id', 'global-settings');
    return { error };
  };

  let result = await tryUpdate({ maintenanceMode: enabled });
  if (!result.error) return;

  if (result.error?.code === '42703') {
    result = await tryUpdate({ maintenance_mode: enabled });
    if (!result.error) return;
  }

  throw result.error;
}

async function testPriceManipulation() {
  console.log('\n--- 🧪 TEST 1: Tentative de manipulation de prix ---');

  // On utilise un produit existant : AirPods Pack (98000 XOF)
  const productId = 'prod-1775519991448';
  const fakeAmount = 1; // On essaie de payer 1 XOF au lieu de 98000

  try {
    console.log(
      `Envoi d'une requête de paiement pour le produit ${productId} avec un montant frauduleux de ${fakeAmount} XOF...`,
    );

    // Note: Cette requête DOIT échouer si non authentifiée (requireAuth)
    const response = await fetch(`${API_URL}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        vendor_id: 'vendor_test',
        amount: fakeAmount, // Sera ignoré par le backend
        customer_phone: '00000000',
        customer_name: 'Test Security',
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      console.log('✅ SUCCÈS : Requête bloquée car non authentifiée (Code 401).');
    } else {
      console.log("❌ ÉCHEC : La requête aurait dû être bloquée par requireAuth.");
      console.log('Status:', response.status, 'Data:', data);
    }
  } catch (err) {
    console.error('Erreur lors du test:', err?.message || String(err));
  }
}

async function testMaintenanceMode() {
  console.log('\n--- 🧪 TEST 2: Mode Maintenance ---');

  try {
    console.log('Activation du mode maintenance en base de données...');
    await setMaintenanceMode(true);

    console.log("Attente de 2 secondes pour l'expiration potentielle du cache (si déjà en mémoire)...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Tentative d'appel POST (bloqué en maintenance)...");
    const response = await fetch(`${API_URL}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 503) {
      console.log('✅ SUCCÈS : Le backend a renvoyé 503 Service Unavailable.');
      console.log('Message:', data.message);
    } else {
      console.log("❌ ÉCHEC : Le backend n'a pas bloqué la requête en mode maintenance.");
      console.log('Status:', response.status, 'Data:', data);
    }
  } finally {
    console.log('Désactivation du mode maintenance...');
    await setMaintenanceMode(false);
  }
}

async function runTests() {
  console.log('🚀 Démarrage des tests de sécurité...');
  console.log('API_URL:', API_URL);
  await testPriceManipulation();
  await testMaintenanceMode();
  console.log('\n🏁 Tests terminés.');
}

runTests();
