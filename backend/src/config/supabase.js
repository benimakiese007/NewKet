import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Au cas où le fichier est appelé directement, on s'assure que dotenv est chargé
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });     // Backend .env (fallback)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ ERREUR FATALE: SUPABASE_URL ou SUPABASE_ANON_KEY manquantes dans le .env backend.');
}

// Client standard (limité par RLS)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client admin (contourne RLS)
let adminClient = null;

if (SUPABASE_SERVICE_ROLE_KEY) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase Admin Client initialisé avec succès.');
} else {
    console.warn('⚠️ ATTENTION: SUPABASE_SERVICE_ROLE_KEY manquante. Certaines opérations admin vont échouer.');
    // En développement, on peut fallback sur le client standard pour éviter les plantages (Internal Server Error)
    // même si les opérations d'écriture risquent d'être bloquées par RLS.
    adminClient = supabase; 
}

export const supabaseAdmin = adminClient;
