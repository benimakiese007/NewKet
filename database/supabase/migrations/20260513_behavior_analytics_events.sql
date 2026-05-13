BEGIN;

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_role TEXT,
    session_id TEXT,
    path TEXT NOT NULL,
    page_title TEXT,
    target TEXT,
    active_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
    ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type_created_at
    ON public.analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id_created_at
    ON public.analytics_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id_created_at
    ON public.analytics_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_path_created_at
    ON public.analytics_events (path, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_select_own_or_admin" ON public.analytics_events;
CREATE POLICY "analytics_events_select_own_or_admin"
    ON public.analytics_events
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "analytics_events_insert_own_or_anon" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_own_or_anon"
    ON public.analytics_events
    FOR INSERT
    WITH CHECK (
        user_id IS NULL
        OR user_id = auth.uid()
        OR public.is_admin()
    );

COMMIT;
