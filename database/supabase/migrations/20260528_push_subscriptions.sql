-- Device push subscriptions for PWA notifications.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_role TEXT NOT NULL DEFAULT 'customers',
    endpoint TEXT NOT NULL UNIQUE,
    subscription JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_email ON public.push_subscriptions (user_email);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_role ON public.push_subscriptions (user_role);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions (revoked_at) WHERE revoked_at IS NULL;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR user_email = (auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
ON public.push_subscriptions FOR ALL
TO authenticated
USING (
    auth.uid() = user_id
    OR user_email = (auth.jwt() ->> 'email')
)
WITH CHECK (
    auth.uid() = user_id
    OR user_email = (auth.jwt() ->> 'email')
);
