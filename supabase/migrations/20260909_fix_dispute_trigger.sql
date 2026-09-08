-- ============================================================
-- PATCH: Fix trigger enforce_dispute_open_after_delivery
-- Date: 2026-09-09
-- Problème: Le trigger exigeait status='DELIVERED' ET proof_status='OTP_VALIDATED'
--           Or les commandes auto-libérées ont status='COMPLETED' et proof_status='PENDING'
--           → toute tentative d'ouvrir un litige retournait une erreur 500
-- Fix: Accepter DELIVERED ou COMPLETED (peu importe proof_status)
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_dispute_open_after_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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

    -- Accepter: DELIVERED (avec ou sans OTP) ou COMPLETED (auto-release ou confirmation client)
    -- On refuse uniquement les commandes non encore livrées
    IF v_order_status NOT IN ('DELIVERED', 'COMPLETED') THEN
        RAISE EXCEPTION 'Litige non autorisé: commande % doit être DELIVERED ou COMPLETED (status=%)',
            NEW.order_id, v_order_status;
    END IF;

    RETURN NEW;
END;
$function$;
