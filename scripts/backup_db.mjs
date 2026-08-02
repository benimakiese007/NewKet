import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://kuygjocnnlvjtoaquicq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_7PIbS1VoWnNzufQmZ7U7zg_h7TkPNeM';

// Tables critiques a sauvegarder
const TABLES = [
    'products',
    'orders',
    'users',
    'notifications',
    'activities',
    'promos',
    'product_reviews',
    'user_carts',
    'user_favorites',
    'payments',
    'payment_webhook_events',
    'deliveries',
    'delivery_quotes',
    'disputes',
    'escrow_events',
    'order_status_history',
    'withdrawals',
    'referral_events',
    'newsletter_subscribers',
    'vendor_payout_methods',
    'kpay_operator_fees',
    'consent_log',
    'settings'
];


async function backupTable(tableName) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=*`, {
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact'
        }
    });

    if (!res.ok) {
        const err = await res.text();
        console.warn(`  ⚠️  Table "${tableName}" ignoree: ${err.substring(0, 80)}`);
        return null;
    }

    const data = await res.json();
    console.log(`  ✅ ${tableName}: ${data.length} lignes`);
    return data;
}

async function runBackup() {
    const now = new Date();
    const dateStr = now.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
    const backupDir = path.resolve(__dirname, `../backups/${dateStr}`);

    fs.mkdirSync(backupDir, { recursive: true });

    console.log(`\n📦 Sauvegarde NewKet - ${now.toLocaleString('fr-FR')}`);
    console.log(`📁 Dossier : ${backupDir}\n`);

    const backup = {};

    for (const table of TABLES) {
        const data = await backupTable(table);
        if (data !== null) {
            backup[table] = data;
            // Un fichier JSON par table
            fs.writeFileSync(
                path.join(backupDir, `${table}.json`),
                JSON.stringify(data, null, 2),
                'utf8'
            );
        }
    }

    // Un fichier global complet
    const globalFile = path.join(backupDir, '_backup_complet.json');
    fs.writeFileSync(globalFile, JSON.stringify(backup, null, 2), 'utf8');

    const totalRows = Object.values(backup).reduce((acc, arr) => acc + arr.length, 0);
    console.log(`\n✅ Sauvegarde terminee !`);
    console.log(`   Tables : ${Object.keys(backup).length}`);
    console.log(`   Lignes totales : ${totalRows}`);
    console.log(`   Fichier global : ${globalFile}\n`);
}

runBackup().catch(console.error);
