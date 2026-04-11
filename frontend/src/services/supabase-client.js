import { createClient } from '@supabase/supabase-js';

// Supabase Configuration — loaded from .env (never commit real keys!)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
        '[NewKet] ERREUR CRITIQUE : Les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ' +
        'sont manquantes. Créez un fichier frontend/.env en copiant frontend/.env.example.'
    );
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
window.supabaseClient = supabaseClient;
