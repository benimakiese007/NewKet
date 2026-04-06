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
    console.error('❌ ERREUR: SUPABASE_URL ou SUPABASE_ANON_KEY manquantes dans le .env backend.');
}

// Client standard (limité par RLS) - utile quand on utilise le jeton de l'utilisateur
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client admin (contourne RLS) - À N'UTILISER QUE POUR DES OPERATIONS SERVEUR AUTORISEES
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY 
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 
    : null;
