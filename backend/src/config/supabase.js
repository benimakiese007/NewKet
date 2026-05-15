import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Au cas où ce fichier est appelé directement, on s'assure que dotenv est chargé
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });    // Backend .env (fallback)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasServiceRoleKey = Boolean(SUPABASE_SERVICE_ROLE_KEY);
const hasBaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function createMissingSupabaseClient() {
    const error = new Error('SUPABASE_NOT_CONFIGURED');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    error.details = 'Missing SUPABASE_URL and/or SUPABASE_ANON_KEY.';

    // Express v5 catches async throws; this avoids Vercel FUNCTION_INVOCATION_FAILED on import.
    return {
        from() {
            throw error;
        },
    };
}

if (!hasBaseConfig) {
    console.error('❌ SUPABASE_URL ou SUPABASE_ANON_KEY manquantes: API en mode dégradé.');
}

// Client standard (limité par RLS)
export const supabase = hasBaseConfig
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : createMissingSupabaseClient();

// Client admin (contourne RLS)
let adminClient = null;

if (hasBaseConfig && SUPABASE_SERVICE_ROLE_KEY) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase Admin Client initialisé avec succès.');
} else if (hasBaseConfig) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY manquante. Certaines opérations admin peuvent échouer.');
    adminClient = supabase;
} else {
    adminClient = supabase;
}

export const supabaseAdmin = adminClient;

export function createUserSupabaseClient(accessToken) {
    if (!accessToken) return supabase;
    if (!hasBaseConfig) return supabase;

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: { Authorization: `Bearer ${accessToken}` }
        }
    });
}

