-- ========================================================
-- ⚖️ NEWKET — SYSTÈME DE LITIGES (DISPUTES)
-- ========================================================

-- ENUMS
CREATE TYPE dispute_status AS ENUM ('OPEN', 'SELLER_PENDING', 'BUYER_PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE dispute_reason AS ENUM ('NOT_RECEIVED', 'DAMAGED', 'NOT_AS_DESCRIBED', 'OTHER');
CREATE TYPE dispute_resolution AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_TO_SELLER', 'NONE');
CREATE TYPE message_type AS ENUM ('MESSAGE', 'OFFER', 'EVIDENCE');
CREATE TYPE escrow_event_type AS ENUM ('HELD', 'FROZEN', 'RELEASED', 'REFUNDED', 'PARTIAL');

-- TABLE: disputes
CREATE TABLE public.disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL, -- FK vers orders (à lier si vous avez la table orders)
    opened_by UUID NOT NULL, -- FK vers users (buyer)
    reason dispute_reason NOT NULL,
    description TEXT NOT NULL,
    status dispute_status DEFAULT 'OPEN',
    resolution dispute_resolution DEFAULT 'NONE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE: dispute_messages
CREATE TABLE public.dispute_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL, -- FK vers users
    type message_type DEFAULT 'MESSAGE',
    payload JSONB DEFAULT '{}'::jsonb, -- Ex: { amount: 50.00, evidence_urls: ['url1', 'url2'] }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE: escrow_events
CREATE TABLE public.escrow_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    type escrow_event_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security)
-- Activer RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_events ENABLE ROW LEVEL SECURITY;

-- Note: Ajouter les policies RLS spécifiques selon l'authentification (ex: auth.uid())
