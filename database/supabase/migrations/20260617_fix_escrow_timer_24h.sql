-- ============================================================
-- Migration : Fix escrow timer → 24h (was 72h hardcoded in SQL)
-- Date       : 2026-06-17
-- Raison     : La décision produit est 24h. La constante JS
--              ESCROW_HOLD_HOURS était à 48h (corrigée à 24h),
--              mais la fonction SQL ignorait cette valeur et
--              appliquait 72h directement dans le UPDATE.
-- ============================================================

CREATE OR REPLACE FUNCTION public.finalize_delivery_confirmation(p_order_id TEXT, p_otp TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_item RECORD;
    v_current_stock INT;
    v_product_name TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_stock_deducted BOOLEAN := FALSE;
BEGIN
    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Commande introuvable');
    END IF;

    IF v_order.status <> 'IN_DELIVERY' THEN
        RETURN jsonb_build_object('success', false, 'message', 'La commande n''est pas en cours de livraison');
    END IF;

    IF v_order.otp_code IS NULL OR v_order.otp_code <> p_otp THEN
        RETURN jsonb_build_object('success', false, 'message', 'Code OTP invalide');
    END IF;

    IF v_order.stock_deducted_at IS NULL THEN
        FOR v_item IN
            SELECT * FROM jsonb_to_recordset(v_order.items) AS x(product_id TEXT, quantity INT)
        LOOP
            SELECT stock, name
            INTO v_current_stock, v_product_name
            FROM public.products
            WHERE id = v_item.product_id
            FOR UPDATE;

            IF v_current_stock IS NULL THEN
                RAISE EXCEPTION 'Produit introuvable: %', v_item.product_id;
            END IF;

            IF v_current_stock < COALESCE(v_item.quantity, 1) THEN
                RAISE EXCEPTION 'Stock insuffisant pour le produit "%" (Disponible: %, Demandé: %)', v_product_name, v_current_stock, COALESCE(v_item.quantity, 1);
            END IF;

            UPDATE public.products
            SET stock = stock - COALESCE(v_item.quantity, 1)
            WHERE id = v_item.product_id;
        END LOOP;

        v_stock_deducted := TRUE;
    END IF;

    -- ⚠️  CORRECTION : 72 hours → 24 hours (aligné sur ESCROW_HOLD_HOURS)
    UPDATE public.orders
    SET
        status = 'DELIVERED',
        delivered_at = COALESCE(delivered_at, v_now),
        proof_status = 'OTP_VALIDATED',
        escrow_status = 'HELD',
        escrow_release_at = COALESCE(escrow_release_at, v_now + INTERVAL '24 hours'),
        stock_deducted_at = COALESCE(stock_deducted_at, v_now),
        updated_at = v_now
    WHERE id = v_order.id
    RETURNING * INTO v_order;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Livraison validée avec succès',
        'stock_deducted', v_stock_deducted,
        'order', to_jsonb(v_order)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
