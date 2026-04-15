-- =========================================================================
-- MIGRATION: Atomic Stock Management & Payment processing (20260415)
-- =========================================================================

-- 1. Helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' 
    OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    OR EXISTS (SELECT 1 FROM public.users WHERE email = auth.jwt() ->> 'email' AND role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Main function to process order payment and decrement stock atomically
CREATE OR REPLACE FUNCTION public.process_order_payment(p_transaction_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id TEXT;
    v_item RECORD;
    v_product_name TEXT;
    v_current_stock INT;
    v_success BOOLEAN := TRUE;
    v_message TEXT := 'Paiement traité avec succès';
BEGIN
    -- Récupérer et verrouiller la commande pour éviter les race conditions (FOR UPDATE)
    SELECT id INTO v_order_id 
    FROM public.orders 
    WHERE transaction_id = p_transaction_id 
      AND (payment_status = 'PENDING' OR payment_status IS NULL)
    FOR UPDATE;

    IF v_order_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Commande non trouvée, déjà traitée ou transaction ID invalide');
    END IF;

    -- Boucler sur les items de la commande (stockés en JSONB)
    -- Format attendu: [{"product_id": "...", "quantity": 1, ...}]
    FOR v_item IN SELECT * FROM jsonb_to_recordset((SELECT items FROM public.orders WHERE id = v_order_id)) 
        AS x(product_id TEXT, quantity INT)
    LOOP
        -- Vérifier le stock actuel
        SELECT stock, name INTO v_current_stock, v_product_name 
        FROM public.products 
        WHERE id = v_item.product_id;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Produit introuvable: %', v_item.product_id;
        END IF;

        IF v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuffisant pour le produit "%" (Disponible: %, Demandé: %)', v_product_name, v_current_stock, v_item.quantity;
        END IF;

        -- Décrémenter le stock
        UPDATE public.products 
        SET stock = stock - v_item.quantity 
        WHERE id = v_item.product_id;
    END LOOP;

    -- Mettre à jour le statut de la commande
    UPDATE public.orders 
    SET 
        payment_status = 'PAID', 
        status = 'PAYÉ'
    WHERE id = v_order_id;

    -- Enregistrer l'activité (Optionnel, peut aussi être fait via trigger)
    INSERT INTO public.activities (user_email, text, type, time)
    SELECT customer_email, 'Paiement confirmé pour la commande ' || transaction_id, 'payment', NOW()
    FROM public.orders WHERE id = v_order_id;

    RETURN jsonb_build_object('success', true, 'message', v_message);

EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur (ex: stock insuffisant), la transaction PostgreSQL est automatiquement annulée (ROLLBACK)
    -- car cette fonction est appelée dans un bloc transactionnel Supabase par défaut.
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
