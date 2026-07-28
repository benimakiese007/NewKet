import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://kuygjocnnlvjtoaquicq.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWebhooks() {
  const { data, error } = await supabase
    .from('payment_webhook_events')
    .select('*')
    .limit(10);
    
  if (error) {
    console.error('Error fetching webhooks:', error);
  } else {
    console.log('Recent Webhooks:', JSON.stringify(data, null, 2));
  }
}

checkWebhooks();
