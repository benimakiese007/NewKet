BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
    ADD COLUMN IF NOT EXISTS referral_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS referral_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique
ON public.users (lower(referral_code))
WHERE referral_code IS NOT NULL AND referral_code <> '';

CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id
ON public.users (referred_by_user_id);

CREATE TABLE IF NOT EXISTS public.referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invitee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded', 'invalid')),
    source TEXT NOT NULL DEFAULT 'signup',
    reward_amount NUMERIC NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    qualified_at TIMESTAMPTZ,
    rewarded_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_referral_events_inviter_id
ON public.referral_events (inviter_id);

CREATE INDEX IF NOT EXISTS idx_referral_events_invitee_id
ON public.referral_events (invitee_id);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referral events visible to involved users and admins" ON public.referral_events;
CREATE POLICY "Referral events visible to involved users and admins"
ON public.referral_events
FOR SELECT
USING (
    inviter_id::text = auth.uid()::text
    OR invitee_id::text = auth.uid()::text
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can view their own referral metadata" ON public.users;
CREATE POLICY "Users can view their own referral metadata"
ON public.users
FOR SELECT
USING (
    id = auth.uid()
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Users can update their own referral metadata" ON public.users;
CREATE POLICY "Users can update their own referral metadata"
ON public.users
FOR UPDATE
USING (
    id = auth.uid()
    OR public.is_admin()
);

WITH ranked_users AS (
    SELECT
        id,
        COALESCE(
            NULLIF(
                upper(regexp_replace(coalesce(name, split_part(email, '@', 1), 'newket'), '[^a-zA-Z0-9]+', '', 'g')),
                ''
            ),
            'NEWKET'
        ) AS base_code
    FROM public.users
),
generated_codes AS (
    SELECT
        id,
        CASE
            WHEN length(base_code) >= 4 THEN base_code
            ELSE 'NEWKET'
        END || '-' || upper(substr(replace(id::text, '-', ''), 1, 6)) AS referral_code
    FROM ranked_users
)
UPDATE public.users u
SET
    referral_code = gc.referral_code,
    referral_updated_at = now()
FROM generated_codes gc
WHERE u.id = gc.id
  AND (u.referral_code IS NULL OR u.referral_code = '');

COMMIT;
