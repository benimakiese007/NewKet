import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function checkUserProducts() {
  const email = 'benimakiese123@gmail.com';
  
  // 1. Get user id from their email
  // If they are in the auth schema, we can't query it easily from 'users' unless there is a public users table
  // Let's check public users table, or just see how products are linked.
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);

  console.log("Users response:", users, userError);
  
  if (users && users.length > 0) {
    const email = 'benimakiese123@gmail.com';
    const userId = '1d9d7990-8ed4-405d-85ad-29cf901eb2f6';
    
    console.log("Testing fetchVendorProducts query...");
    const { data: byEmail, error: err1 } = await supabase
        .from('products')
        .select('*, users!supplier_email(company_name, name, shipping_time, avatar)')
        .eq('supplier_email', email);
        
    console.log("byEmail result:", byEmail ? byEmail.length : 0, err1);

    const { data: byUser, error: err2 } = await supabase
        .from('products')
        .select('*, users!supplier_email(company_name, name, shipping_time, avatar)')
        .eq('user_id', userId);

    console.log("byUser result:", byUser ? byUser.length : 0, err2);
  } else {
    console.log("User not found in public.users");
  }
}

checkUserProducts();
