import { supabaseAdmin } from './src/config/supabase.js';

async function checkSchema() {
    const tables = ['orders', 'products'];
    for (const table of tables) {
        const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
        if (error) {
            console.error(`❌ Error ${table}:`, error.message);
        } else {
            console.log(`✅ Columns in ${table}:`, Object.keys(data[0] || {}));
        }
    }
}

checkSchema();
