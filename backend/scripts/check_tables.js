import { supabaseAdmin } from '../src/config/supabase.js';

async function checkTables() {
    // There is no easy direct way to list tables via JS client without RPC or querying information_schema
    // Let's try to query possible tables
    const tables = ['users', 'products', 'orders', 'sellers', 'vendors', 'clients', 'customers'];
    for (const table of tables) {
        const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
        if (!error) {
            console.log(`Table '${table}' exists and has ${count} records.`);
        } else if (error.code !== '42P01') {
             // 42P01 is "undefined_table"
             console.log(`Table '${table}' error: ${error.message} (${error.code})`);
        }
    }
    
    // Also let's check all roles in 'users'
    const { data: roles, error: roleError } = await supabaseAdmin.from('users').select('role');
    if (!roleError) {
        const uniqueRoles = [...new Set(roles.map(u => u.role))];
        console.log("Unique roles in users table:", uniqueRoles);
        
        // Count each role
        const counts = {};
        roles.forEach(u => {
            counts[u.role] = (counts[u.role] || 0) + 1;
        });
        console.log("Counts per role:", counts);
    }
}

checkTables();
