import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kuygjocnnlvjtoaquicq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM0MzY2NiwiZXhwIjoyMDg2OTE5NjY2fQ.QvH96s9FrZhzrvWjBjVNrBx00-tWTbhiPv9qnb2Bccg'
);

async function runSQL(description, sql) {
    console.log(`\n▶ ${description}...`);
    const { data, error } = await supabase.rpc('pgmigrate', { sql });
    if (error) {
        // Try alternative: direct query via from
        console.log(`  ⚠ RPC pgmigrate not available. Error: ${error.message}`);
        return false;
    }
    console.log(`  ✅ Done`);
    return true;
}

async function checkSchema() {
    console.log('\n=== Checking current schema ===');
    
    // Check notifications columns
    const { data: notifCols, error: err1 } = await supabase
        .from('notifications')
        .select('*')
        .limit(1);
    
    if (err1) {
        console.log('notifications table error:', err1.message);
    } else {
        const cols = notifCols?.[0] ? Object.keys(notifCols[0]) : [];
        console.log('notifications columns:', cols.join(', '));
        console.log('Has user_id?', cols.includes('user_id') ? '✅ YES' : '❌ NO - NEEDS MIGRATION');
    }

    // Check user_favorites table
    const { data: favData, error: err2 } = await supabase
        .from('user_favorites')
        .select('*')
        .limit(1);
    
    if (err2) {
        console.log('user_favorites table:', '❌ MISSING -', err2.message, '- NEEDS MIGRATION');
    } else {
        console.log('user_favorites table:', '✅ EXISTS');
    }
}

await checkSchema();

console.log('\n=== Schema check complete ===');
console.log('\nTo apply the migration, run the SQL in database/supabase/migrations/20260409_fix_missing_tables_and_columns.sql');
console.log('via the Supabase Dashboard > SQL Editor');
