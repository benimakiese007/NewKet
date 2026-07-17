import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data: orders, error } = await supabase.from('orders').select('*').limit(1);
    console.log('Orders columns:', Object.keys(orders?.[0] || {}));
    if (error) console.error('Error fetching orders:', error);

    const { data: products, error: pError } = await supabase.from('products').select('*').limit(1);
    console.log('Products columns:', Object.keys(products?.[0] || {}));
}

checkSchema();
