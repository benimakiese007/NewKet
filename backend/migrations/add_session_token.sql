-- Migration: Ajout de la colonne session_token pour le système "1 user = 1 appareil"
-- À appliquer via : Supabase Dashboard > SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);

-- Commentaire : session_token est généré côté serveur (UUID v4) à chaque connexion.
-- Il est invalidé automatiquement lorsque l'utilisateur se connecte depuis un nouvel appareil.
