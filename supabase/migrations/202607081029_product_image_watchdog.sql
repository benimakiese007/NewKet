BEGIN;

CREATE TABLE IF NOT EXISTS public.product_image_watchdog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_signature TEXT NOT NULL,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'ok', 'broken')),
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    last_error TEXT,
    last_checked_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_image_watchdog_product_unique UNIQUE (product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_image_watchdog_next_check_at
    ON public.product_image_watchdog(next_check_at);

CREATE INDEX IF NOT EXISTS idx_product_image_watchdog_status
    ON public.product_image_watchdog(status);

COMMIT;
