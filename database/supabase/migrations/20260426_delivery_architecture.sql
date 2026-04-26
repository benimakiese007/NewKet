-- ============================================================================
-- MIGRATION: NewKet delivery architecture and strict order state machine
-- Date: 2026-04-26
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    ALTER TABLE public.orders
        ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS merchandise_amount NUMERIC(12,2),
        ADD COLUMN IF NOT EXISTS delivery_fee_amount NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS accepted_delivery_quote_id UUID,
        ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS escrow_release_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS in_delivery_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS proof_status TEXT DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS failure_reason TEXT,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

UPDATE public.orders
SET
    customer_id = COALESCE(customer_id, user_id),
    merchandise_amount = COALESCE(merchandise_amount, total_amount, total, 0),
    delivery_fee_amount = COALESCE(delivery_fee_amount, 0),
    total_amount = COALESCE(total_amount, total, 0),
    total = COALESCE(total, total_amount, 0),
    vendor_id = COALESCE(
        vendor_id,
        NULLIF((items->0->>'vendor_id'), '')::uuid
    ),
    escrow_status = COALESCE(escrow_status, CASE
        WHEN status IN ('PAID_HELD', 'DELIVERED') THEN 'HELD'
        WHEN status = 'FROZEN' THEN 'FROZEN'
        WHEN status IN ('RELEASED', 'COMPLETED') THEN 'RELEASED'
        WHEN status = 'REFUNDED' THEN 'REFUNDED'
        ELSE 'NONE'
    END),
    proof_status = COALESCE(proof_status, CASE
        WHEN delivered_at IS NOT NULL THEN 'OTP_VALIDATED'
        ELSE 'PENDING'
    END),
    updated_at = COALESCE(updated_at, created_at, NOW())
WHERE TRUE;

UPDATE public.orders
SET status = 'IN_DELIVERY'
WHERE status = 'SHIPPED';

UPDATE public.orders
SET status = 'COMPLETED'
WHERE status = 'RELEASED';

UPDATE public.orders
SET status = 'DISPUTE_OPEN'
WHERE status = 'DISPUTED';

UPDATE public.orders
SET status = 'PAID_HELD'
WHERE status = 'PAYÉ';

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'PENDING',
        'QUOTE',
        'READY_FOR_PAYMENT',
        'PAID_HELD',
        'IN_DELIVERY',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED',
        'DISPUTE_OPEN',
        'FROZEN',
        'REFUNDED'
    ));

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_escrow_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_escrow_status_check
    CHECK (escrow_status IN ('NONE', 'HELD', 'RELEASED', 'AUTO_RELEASED', 'FROZEN', 'REFUNDED'));

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_proof_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_proof_status_check
    CHECK (proof_status IN ('PENDING', 'OTP_VALIDATED', 'FAILED'));

CREATE TABLE IF NOT EXISTS public.delivery_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    delivery_fee_amount NUMERIC(12,2) NOT NULL CHECK (delivery_fee_amount >= 0),
    estimated_delay_hours INTEGER NOT NULL CHECK (estimated_delay_hours > 0),
    note TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_delivery_quotes_order_id ON public.delivery_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_quotes_status ON public.delivery_quotes(status);

CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    mode TEXT NOT NULL DEFAULT 'SELLER_MANAGED' CHECK (mode IN ('SELLER_MANAGED')),
    external_courier_name TEXT,
    external_courier_phone TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED', 'RESCHEDULED')),
    otp_attempts INTEGER NOT NULL DEFAULT 0,
    max_otp_attempts INTEGER NOT NULL DEFAULT 5,
    proof_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (proof_status IN ('PENDING', 'OTP_VALIDATED', 'FAILED')),
    started_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    otp_validated_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);

CREATE TABLE IF NOT EXISTS public.escrow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('HELD', 'TIMER_STARTED', 'RELEASED', 'AUTO_RELEASED', 'FROZEN', 'REFUNDED', 'MANUAL_OVERRIDE')),
    amount NUMERIC(12,2),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escrow_events_order_id ON public.escrow_events(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_events_event_type ON public.escrow_events(event_type);

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    notes TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.disputes
    ADD COLUMN IF NOT EXISTS escrow_frozen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS order_status_snapshot TEXT;

ALTER TABLE public.disputes
    DROP CONSTRAINT IF EXISTS disputes_status_check;

ALTER TABLE public.disputes
    ADD CONSTRAINT disputes_status_check CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'));

UPDATE public.disputes
SET
    order_status_snapshot = COALESCE(order_status_snapshot, o.status),
    escrow_frozen_at = COALESCE(escrow_frozen_at, CASE WHEN o.status = 'FROZEN' THEN NOW() ELSE NULL END)
FROM public.orders o
WHERE o.id = disputes.order_id;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_accepted_delivery_quote_fk
    FOREIGN KEY (accepted_delivery_quote_id)
    REFERENCES public.delivery_quotes(id)
    ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.process_order_payment(p_transaction_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_item RECORD;
    v_product_name TEXT;
    v_current_stock INT;
    v_otp TEXT;
BEGIN
    SELECT *
    INTO v_order
    FROM public.orders
    WHERE transaction_id = p_transaction_id
      AND status = 'READY_FOR_PAYMENT'
      AND (payment_status = 'PENDING' OR payment_status = 'INITIATED' OR payment_status IS NULL)
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Commande non trouvée ou statut invalide pour le paiement');
    END IF;

    FOR v_item IN
        SELECT * FROM jsonb_to_recordset(v_order.items) AS x(product_id TEXT, quantity INT)
    LOOP
        SELECT stock, name
        INTO v_current_stock, v_product_name
        FROM public.products
        WHERE id = v_item.product_id;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Produit introuvable: %', v_item.product_id;
        END IF;

        IF v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuffisant pour le produit "%" (Disponible: %, Demandé: %)', v_product_name, v_current_stock, v_item.quantity;
        END IF;

        UPDATE public.products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id;
    END LOOP;

    v_otp := LPAD((FLOOR(RANDOM() * 1000000))::INT::TEXT, 6, '0');

    UPDATE public.orders
    SET
        payment_status = 'PAID',
        status = 'PAID_HELD',
        otp_code = COALESCE(otp_code, v_otp),
        otp_attempts = 0,
        escrow_status = 'HELD',
        updated_at = NOW()
    WHERE id = v_order.id;

    INSERT INTO public.escrow_events(order_id, event_type, amount, metadata, processed_at)
    VALUES (
        v_order.id,
        'HELD',
        v_order.total_amount,
        jsonb_build_object('transaction_id', p_transaction_id),
        NOW()
    );

    INSERT INTO public.activities (user_email, text, type, time)
    SELECT customer_email, 'Paiement confirmé pour la commande ' || transaction_id, 'payment', NOW()
    FROM public.orders
    WHERE id = v_order.id;

    RETURN jsonb_build_object('success', true, 'message', 'Paiement traité avec succès');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
