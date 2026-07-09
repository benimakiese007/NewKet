import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Aborting script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function readMaintenanceMode() {
  const query = async (columns) => {
    const { data, error } = await supabase
      .from('settings')
      .select(columns)
      .eq('id', 'global-settings')
      .maybeSingle();
    return { data, error };
  };

  const camel = await query('maintenanceMode');
  if (!camel.error) return { enabled: !!camel.data?.maintenanceMode, error: null };

  if (camel.error?.code === '42703') {
    const snake = await query('maintenance_mode');
    if (!snake.error) return { enabled: !!snake.data?.maintenance_mode, error: null };
    return { enabled: null, error: snake.error };
  }

  return { enabled: null, error: camel.error };
}

async function tryWriteProbe() {
  // Probe un endpoint POST (sans auth) qui devrait être bloqué en maintenance (503)
  // mais sinon renvoyer 401 (auth requise) ou autre.
  const response = await fetch(`${API_URL}/api/payments/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function main() {
  console.log('API_URL:', API_URL);
  const { enabled, error } = await readMaintenanceMode();
  if (error) {
    console.error('❌ Failed to read maintenance flag from DB:', error);
    process.exit(2);
  }

  console.log('DB maintenance enabled:', enabled);

  const probe = await tryWriteProbe();
  console.log('POST probe status:', probe.status);

  // Expectations:
  // - enabled=true => 503
  // - enabled=false => usually 401 (requireAuth) or 400 depending on endpoint validation
  if (enabled === true && probe.status !== 503) {
    console.error("❌ Incohérence: DB=ON mais l'API n'a pas répondu 503.");
    console.log('Body:', probe.body);
    process.exit(3);
  }

  if (enabled === false && probe.status === 503) {
    console.error("❌ Incohérence: DB=OFF mais l'API a répondu 503.");
    console.log('Body:', probe.body);
    process.exit(4);
  }

  console.log('✅ OK: comportement API cohérent avec le flag DB.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err?.message || String(err));
  process.exit(10);
});
