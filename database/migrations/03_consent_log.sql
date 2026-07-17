-- Migration 03 : Table de journalisation des consentements RGPD
-- Art. 7(1) RGPD — le responsable du traitement doit être en mesure de démontrer que le consentement a été donné.
-- À appliquer via : Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS consent_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL si visiteur non connecté
    session_id      TEXT,                                                 -- ID de session navigateur (optionnel)
    consent_given   BOOLEAN NOT NULL,
    consent_type    TEXT NOT NULL CHECK (consent_type IN ('analytics', 'marketing', 'functional', 'all', 'none')),
    ip_hash         TEXT,                                                 -- Hash SHA-256 tronqué de l'IP (jamais l'IP brute)
    user_agent      TEXT,
    consent_version TEXT NOT NULL,                                        -- Version de la politique (ex: "v1.0")
    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index pour retrouver les consentements d'un utilisateur rapidement
CREATE INDEX IF NOT EXISTS idx_consent_log_user_id   ON consent_log (user_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_created_at ON consent_log (created_at DESC);

-- Row Level Security : un utilisateur ne peut voir que ses propres consentements
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_log_select_own" ON consent_log
    FOR SELECT USING (auth.uid() = user_id);

-- L'insertion est ouverte (sans auth) pour permettre la bannière cookie avant connexion
-- côté backend, l'accès est contrôlé par le service role key
CREATE POLICY "consent_log_insert_service_role" ON consent_log
    FOR INSERT WITH CHECK (true);

-- Champ deletion_requested_at pour la gestion du droit à l'effacement (Art. 17)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deletion_requested_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_scheduled_at  TIMESTAMPTZ;

-- Index pour le job de purge automatique
CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled ON users (deletion_scheduled_at)
    WHERE deletion_scheduled_at IS NOT NULL;

COMMENT ON TABLE consent_log IS 'Journalisation RGPD des consentements utilisateurs (Art. 7 RGPD). Conserver 5 ans après expiration du consentement.';
