-- ========================================================
-- NEWKET — SYSTÈME DE LITIGES (DISPUTES) — ADAPTÉE (IF NOT EXISTS)
-- ========================================================

-- ENUMS (CREATE IF NOT EXISTS via DO block)
DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM ('OPEN', 'SELLER_PENDING', 'BUYER_PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_reason AS ENUM ('NOT_RECEIVED', 'DAMAGED', 'NOT_AS_DESCRIBED', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_resolution AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_SELLER', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('MESSAGE', 'OFFER', 'EVIDENCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE escrow_event_type AS ENUM ('HELD', 'FROZEN', 'RELEASED', 'REFUNDED', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLE: disputes
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL, -- TEXT pour compatibilité (orders supprimée)
    opened_by UUID NOT NULL,
    reason dispute_reason NOT NULL,
    description TEXT NOT NULL,
    status dispute_status DEFAULT 'OPEN',
    resolution dispute_resolution DEFAULT 'NONE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE: dispute_messages
CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    type message_type DEFAULT 'MESSAGE',
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE: escrow_events
CREATE TABLE IF NOT EXISTS public.escrow_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL, -- TEXT (orders supprimée)
    type escrow_event_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_events ENABLE ROW LEVEL SECURITY;
