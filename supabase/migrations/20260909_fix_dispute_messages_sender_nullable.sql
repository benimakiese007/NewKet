-- ============================================================
-- PATCH: Fix dispute_messages.sender_id -> rendre nullable
-- Date: 2026-09-09
-- Problème: sender_id était NOT NULL, mais les messages système
--           n'ont pas de sender (sender_id = null) -> erreur 500
-- ============================================================

-- Rendre sender_id nullable pour autoriser les messages système
ALTER TABLE public.dispute_messages
    ALTER COLUMN sender_id DROP NOT NULL;
