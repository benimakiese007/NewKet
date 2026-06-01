-- Durable queue for device push notifications.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.push_notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    last_error TEXT,
    sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_jobs_status_available_at
    ON public.push_notification_jobs (status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_push_notification_jobs_status_updated_at
    ON public.push_notification_jobs (status, updated_at);

ALTER TABLE public.push_notification_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_push_notification_jobs(batch_size INTEGER DEFAULT 10)
RETURNS SETOF public.push_notification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT id
        FROM public.push_notification_jobs
        WHERE status = 'queued'
          AND available_at <= NOW()
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT batch_size
    )
    UPDATE public.push_notification_jobs jobs
    SET status = 'processing',
        attempts = jobs.attempts + 1,
        started_at = COALESCE(jobs.started_at, NOW()),
        updated_at = NOW()
    FROM claimed
    WHERE jobs.id = claimed.id
    RETURNING jobs.*;
END;
$$;
