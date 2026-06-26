-- 1. Ajout de la colonne sur la table products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS escrow_timer_hours INT DEFAULT 24;

ALTER TABLE public.products
ADD CONSTRAINT check_product_escrow_timer_hours 
CHECK (escrow_timer_hours >= 24 AND escrow_timer_hours <= 72);

-- 2. Mise à jour de la fonction finalize_delivery_confirmation pour lire depuis les produits de la commande (on prend le max)
CREATE OR REPLACE FUNCTION finalize_delivery_confirmation(
    p_order_id UUID,
    p_user_id UUID,
    p_is_admin BOOLEAN DEFAULT FALSE,
    p_force_otp_bypass BOOLEAN DEFAULT FALSE
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order public.orders;
    v_now TIMESTAMP WITH TIME ZONE := now();
    v_escrow_hours INT := 24;
    v_item RECORD;
    v_current_stock INT;
    v_product_name TEXT;
    v_stock_deducted BOOLEAN;
BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Commande introuvable';
    END IF;

    IF NOT p_is_admin AND v_order.customer_id != p_user_id THEN
        RAISE EXCEPTION 'Non autorisé à confirmer cette commande';
    END IF;

    IF v_order.status != 'SHIPPED' THEN
        RAISE EXCEPTION 'La commande doit être en statut SHIPPED pour être confirmée (statut actuel: %)', v_order.status;
    END IF;

    IF NOT p_force_otp_bypass AND v_order.proof_status != 'OTP_VALIDATED' THEN
        RAISE EXCEPTION 'Le code de livraison (OTP) doit être validé avant confirmation';
    END IF;

    v_stock_deducted := COALESCE(v_order.stock_deducted_at IS NOT NULL, FALSE);

    IF NOT v_stock_deducted AND v_order.items IS NOT NULL THEN
        FOR v_item IN
            SELECT * FROM jsonb_to_recordset(v_order.items) AS x(product_id TEXT, quantity INT)
        LOOP
            SELECT stock, name
            INTO v_current_stock, v_product_name
            FROM public.products
            WHERE id = v_item.product_id::uuid
            FOR UPDATE;

            IF v_current_stock IS NULL THEN
                RAISE EXCEPTION 'Produit introuvable: %', v_item.product_id;
            END IF;

            IF v_current_stock < COALESCE(v_item.quantity, 1) THEN
                RAISE EXCEPTION 'Stock insuffisant pour le produit "%" (Disponible: %, Demandé: %)', v_product_name, v_current_stock, COALESCE(v_item.quantity, 1);
            END IF;

            UPDATE public.products
            SET stock = stock - COALESCE(v_item.quantity, 1)
            WHERE id = v_item.product_id::uuid;
        END LOOP;

        v_stock_deducted := TRUE;
    END IF;

    -- Récupération du délai d'escrow max basé sur les produits de la commande
    IF v_order.items IS NOT NULL THEN
        SELECT COALESCE(MAX(p.escrow_timer_hours), 24)
        INTO v_escrow_hours
        FROM jsonb_to_recordset(v_order.items) AS x(product_id TEXT)
        JOIN public.products p ON p.id = x.product_id::uuid;
    END IF;

    IF v_escrow_hours IS NULL THEN
        v_escrow_hours := 24;
    END IF;

    UPDATE public.orders
    SET
        status = 'DELIVERED',
        delivered_at = COALESCE(delivered_at, v_now),
        proof_status = 'OTP_VALIDATED',
        escrow_status = 'HELD',
        escrow_release_at = COALESCE(escrow_release_at, v_now + (v_escrow_hours || ' hours')::interval),
        stock_deducted_at = COALESCE(stock_deducted_at, v_now),
        updated_at = v_now
    WHERE id = v_order.id
    RETURNING * INTO v_order;

    RETURN v_order;
END;
$$;
