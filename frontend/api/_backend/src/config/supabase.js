import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../frontend/.env') });

function isPlaceholder(value) {
    if (!value) return true;

    const normalized = String(value).trim().toLowerCase();
    return (
        normalized.startsWith('your-') ||
        normalized.includes('your-project-ref.supabase.co') ||
        normalized.includes('your-supabase-anon-key') ||
        normalized.includes('your-anon-key-here') ||
        normalized.includes('your-service-role-key') ||
        normalized.includes('replace-me')
    );
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_URL !== process.env.VITE_SUPABASE_URL) {
    console.warn('Supabase URL mismatch: SUPABASE_URL != VITE_SUPABASE_URL. Tokens from the frontend may be rejected by the API.');
}

export const hasServiceRoleKey = Boolean(SUPABASE_SECRET_KEY) && !isPlaceholder(SUPABASE_SECRET_KEY);
const hasBaseConfig = !isPlaceholder(SUPABASE_URL) && !isPlaceholder(SUPABASE_ANON_KEY);

function createMissingSupabaseClient() {
    const error = new Error('SUPABASE_NOT_CONFIGURED');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    error.details = 'Missing or placeholder SUPABASE_URL and/or SUPABASE_ANON_KEY.';

    return {
        from() {
            throw error;
        },
    };
}

if (!hasBaseConfig) {
    console.error('SUPABASE_URL or SUPABASE_ANON_KEY missing or placeholder: API running in degraded mode.');
}

export const supabase = hasBaseConfig
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : createMissingSupabaseClient();

let adminClient = null;

if (hasBaseConfig && hasServiceRoleKey) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    console.log('Supabase Admin Client initialized successfully.');
} else if (hasBaseConfig) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
        // En production, un supabaseAdmin tournant en mode anon est une faille silencieuse :
        // les opérations admin byppassent les RLS mais n'ont aucune élévation de droits.
        // On fail-fast pour forcer la correction plutôt que de dégrader silencieusement.
        throw new Error(
            '[FATAL] SUPABASE_SECRET_KEY (service_role) is missing in production. ' +
            'Admin operations require this key. Set it in your environment variables.'
        );
    }
    console.warn('SUPABASE_SECRET_KEY missing or placeholder. Running in degraded mode (anon client for admin). Set this key for production.');
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
