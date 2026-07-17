import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM'
);

// Test 1: users table
const { data: users, error: e1 } = await supabase
  .from('users')
  .select('id, name, email, role, status')
  .limit(50);

if (e1) console.error('Erreur users:', e1.message);
else {
  console.log(`\n=== USERS TABLE (${users?.length}) ===`);
  users?.forEach(u => {
    console.log(`  role=${u.role} | status=${u.status} | ${u.name} | ${u.email}`);
  });
}

// Test 2: Colonnes disponibles ?
const { data: sample } = await supabase.from('users').select('*').limit(1);
if (sample?.[0]) {
  console.log('\n=== COLONNES USERS ===');
  console.log(Object.keys(sample[0]).join(', '));
  console.log('\n=== EXEMPLE ===');
  console.log(JSON.stringify(sample[0], null, 2));
}
