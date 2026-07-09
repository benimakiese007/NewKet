-- ============================================================================
-- MIGRATION: Align "Arborescence" docs with strict DB guarantees (2026-04-28)
-- - Delivery: explicit proof_type = 'otp'
-- - Disputes: open only after DELIVERED + OTP validated
-- ============================================================================

-- 1) Deliveries: keep the simplified "proof_type (otp)" contract explicit.
DO $$
BEGIN
    ALTER TABLE public.deliveries
        ADD COLUMN IF NOT EXISTS proof_type TEXT NOT NULL DEFAULT 'otp';
EXCEPTION
    WHEN undefined_table THEN
        -- If deliveries table doesn't exist yet in a given environment, skip.
        NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.deliveries
        DROP CONSTRAINT IF EXISTS deliveries_proof_type_check;
    ALTER TABLE public.deliveries
        ADD CONSTRAINT deliveries_proof_type_check CHECK (proof_type = 'otp');
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 2) Disputes: enforce "ouvrable uniquement après DELIVERED (OTP validé)".
-- This cannot be expressed as a CHECK constraint (it depends on orders),
-- so we enforce it with triggers.
CREATE OR REPLACE FUNCTION public.enforce_dispute_open_after_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_status TEXT;
    v_order_proof_status TEXT;
BEGIN
    IF NEW.order_id IS NULL THEN
        RAISE EXCEPTION 'order_id requis pour un litige';
    END IF;

    SELECT o.status, o.proof_status
    INTO v_order_status, v_order_proof_status
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    IF v_order_status IS NULL THEN
        RAISE EXCEPTION 'Commande introuvable pour order_id=%', NEW.order_id;
    END IF;

    IF v_order_status <> 'DELIVERED' OR v_order_proof_status <> 'OTP_VALIDATED' THEN
        RAISE EXCEPTION 'Litige non autorisé: commande % doit être DELIVERED avec OTP_VALIDATED (status=%, proof_status=%)',
            NEW.order_id, v_order_status, v_order_proof_status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_dispute_open_after_delivery_insert ON public.disputes;
CREATE TRIGGER trg_enforce_dispute_open_after_delivery_insert
BEFORE INSERT ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dispute_open_after_delivery();

DROP TRIGGER IF EXISTS trg_enforce_dispute_open_after_delivery_update ON public.disputes;
CREATE TRIGGER trg_enforce_dispute_open_after_delivery_update
BEFORE UPDATE OF order_id ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_dispute_open_after_delivery();

