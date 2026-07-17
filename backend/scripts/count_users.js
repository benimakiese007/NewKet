import { supabaseAdmin } from '../src/config/supabase.js';

async function countUsers() {
    const { data: users, error } = await supabaseAdmin.from('users').select('role, type');
    
    if (error) {
        console.error("Error fetching users:", error);
        
        // try fetching without type just in case type doesn't exist
        const { data: usersFallback, error2 } = await supabaseAdmin.from('users').select('role');
        if (error2) {
             console.log("Error 2:", error2);
             process.exit(1);
        }
        
        console.log("Total users:", usersFallback.length);
        const counts = {};
        for (const u of usersFallback) {
            const role = u.role || 'no_role';
            counts[role] = (counts[role] || 0) + 1;
        }
        console.log("User counts by role/type:", counts);
        process.exit(0);
    }
    
    console.log("Total users:", users.length);
    
    const counts = {};
    for (const u of users) {
        const r = u.role || u.type || 'no_role';
        counts[r] = (counts[r] || 0) + 1;
    }
    console.log("User counts by role:", counts);
    process.exit(0);
}

countUsers();
