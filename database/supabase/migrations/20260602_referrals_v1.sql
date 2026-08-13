BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS referred_by_code TEXT,
    ADD COLUMN IF NOT EXISTS referral_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS referral_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS nk_token_balance NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nk_token_total_earned NUMERIC NOT NULL DEFAULT 0;

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

CREATE OR REPLACE FUNCTION public.grant_referral_nktoken_reward(
    p_invitee_id UUID,
    p_order_id TEXT,
    p_reward_amount NUMERIC DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitee public.users%ROWTYPE;
    v_inviter public.users%ROWTYPE;
    v_event public.referral_events%ROWTYPE;
    v_completed_count INTEGER := 0;
    v_now TIMESTAMPTZ := now();
    v_reward_amount NUMERIC := GREATEST(COALESCE(p_reward_amount, 1), 0);
BEGIN
    SELECT *
    INTO v_invitee
    FROM public.users
    WHERE id = p_invitee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('awarded', false, 'reason', 'invitee_not_found');
    END IF;

    IF lower(COALESCE(v_invitee.role, '')) <> 'customer' THEN
        RETURN jsonb_build_object('awarded', false, 'reason', 'invitee_not_customer');
    END IF;

    IF v_invitee.referred_by_user_id IS NULL OR COALESCE(v_invitee.referred_by_code, '') = '' THEN
        RETURN jsonb_build_object('awarded', false, 'reason', 'no_referrer');
    END IF;

    SELECT *
    INTO v_inviter
    FROM public.users
    WHERE id = v_invitee.referred_by_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('awarded', false, 'reason', 'inviter_not_found');
    END IF;

    SELECT *
    INTO v_event
    FROM public.referral_events
    WHERE invitee_id = p_invitee_id
    FOR UPDATE;

    IF FOUND AND v_event.status = 'rewarded' THEN
        RETURN jsonb_build_object(
            'awarded', false,
            'reason', 'already_rewarded',
            'reward_amount', COALESCE(v_event.reward_amount, 0)
        );
    END IF;

    IF (v_now > (COALESCE(v_event.invited_at, v_invitee.referral_claimed_at, v_invitee.date_joined) + INTERVAL '30 days')) THEN
        IF FOUND THEN
            UPDATE public.referral_events
            SET status = 'invalid', notes = 'Expired: order completed after 30 days'
            WHERE invitee_id = p_invitee_id;
        ELSE
            INSERT INTO public.referral_events (
                inviter_id, invitee_id, referral_code, status, source, reward_amount, invited_at, notes
            ) VALUES (
                v_invitee.referred_by_user_id, p_invitee_id, v_invitee.referred_by_code, 'invalid', 'order_completion', 0, COALESCE(v_invitee.referral_claimed_at, v_invitee.date_joined), 'Expired: order completed after 30 days'
            );
        END IF;

        RETURN jsonb_build_object('awarded', false, 'reason', 'expired_30_days');
    END IF;

    SELECT COUNT(*)
    INTO v_completed_count
    FROM public.orders
    WHERE (customer_id = p_invitee_id OR user_id = p_invitee_id)
      AND status = 'COMPLETED';

    IF v_completed_count <> 1 THEN
        RETURN jsonb_build_object(
            'awarded', false,
            'reason', 'not_first_completed_order',
            'completed_count', v_completed_count
        );
    END IF;

    INSERT INTO public.referral_events (
        inviter_id,
        invitee_id,
        referral_code,
        status,
        source,
        reward_amount,
        invited_at,
        qualified_at,
        rewarded_at,
        notes
    )
    VALUES (
        v_invitee.referred_by_user_id,
        p_invitee_id,
        v_invitee.referred_by_code,
        'rewarded',
        'order_completion',
        v_reward_amount,
        COALESCE(v_event.invited_at, v_invitee.referral_claimed_at, v_now),
        COALESCE(v_event.qualified_at, v_now),
        v_now,
        'NKToken granted on first completed order'
    )
    ON CONFLICT (invitee_id)
    DO UPDATE SET
        inviter_id = EXCLUDED.inviter_id,
        referral_code = EXCLUDED.referral_code,
        status = 'rewarded',
        source = EXCLUDED.source,
        reward_amount = EXCLUDED.reward_amount,
        invited_at = COALESCE(public.referral_events.invited_at, EXCLUDED.invited_at),
        qualified_at = COALESCE(public.referral_events.qualified_at, EXCLUDED.qualified_at),
        rewarded_at = EXCLUDED.rewarded_at,
        notes = EXCLUDED.notes;

    UPDATE public.users
    SET
        nk_token_balance = COALESCE(nk_token_balance, 0) + v_reward_amount,
        nk_token_total_earned = COALESCE(nk_token_total_earned, 0) + v_reward_amount,
        referral_updated_at = v_now
    WHERE id = v_inviter.id;

    RETURN jsonb_build_object(
        'awarded', true,
        'reward_amount', v_reward_amount,
        'invitee_id', p_invitee_id,
        'order_id', p_order_id,
        'inviter_id', v_invitee.referred_by_user_id,
        'rewarded_at', v_now
    );
END;
$$;

COMMIT;
