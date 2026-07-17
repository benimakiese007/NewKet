import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kuygjocnnlvjtoaquicq.supabase.co',
  'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM'
);

async function run() {
  const { data: users, error } = await supabase.from('users').select('*').limit(5);
  if (error) {
    console.error(error);
    return;
  }
  
  if (users && users.length > 0) {
    console.log('Columns:', Object.keys(users[0]));
    console.log('Sample Data:');
    users.forEach(u => {
      console.log(`ID: ${u.id} | email: ${u.email} | name: ${u.name} | full_name: ${u.full_name} | username: ${u.username}`);
    });
  }
}

run();
