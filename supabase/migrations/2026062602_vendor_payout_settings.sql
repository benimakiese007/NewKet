-- ============================================================
-- Migration : Paramètres de Payout Vendeur & OTP
-- Date       : 2026-06-26
-- Description: - Table vendor_payout_methods
--              - Table otp_verifications
--              - escrow_timer_hours sur public.users
--              - Maj de finalize_delivery_confirmation
-- ============================================================

-- 1. Ajout du paramètre escrow_timer_hours sur public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS escrow_timer_hours INT DEFAULT 24;

-- Ajout d'une contrainte pour s'assurer que le délai est entre 24h et 72h
ALTER TABLE public.users 
ADD CONSTRAINT check_escrow_timer_hours 
CHECK (escrow_timer_hours >= 24 AND escrow_timer_hours <= 72);

-- 2. Création de la table des méthodes de paiement (Payouts)
CREATE TABLE IF NOT EXISTS public.vendor_payout_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('flexpaie', 'stripe')),
    account_id TEXT NOT NULL, -- Numéro de téléphone ou Stripe Account ID
    account_name TEXT, -- Nom associé au compte
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_vendor_payout_methods_vendor_id ON public.vendor_payout_methods(vendor_id);

-- RLS
ALTER TABLE public.vendor_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les vendeurs voient leurs propres méthodes" 
ON public.vendor_payout_methods FOR SELECT 
USING (auth.uid() = vendor_id);

CREATE POLICY "Les vendeurs gèrent leurs propres méthodes" 
ON public.vendor_payout_methods FOR ALL 
USING (auth.uid() = vendor_id);

-- 3. Création de la table de vérification OTP
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_user_id ON public.otp_verifications(user_id);

-- RLS
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
-- Uniquement le backend (Service Role) devrait insérer et vérifier ces OTPs en général,
-- mais on peut permettre à l'utilisateur de lire ses propres OTPs actifs si besoin (Optionnel).
CREATE POLICY "Users can read their own active OTPs"
ON public.otp_verifications FOR SELECT
USING (auth.uid() = user_id);

-- 4. Mise à jour de la fonction finalize_delivery_confirmation
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
    v_escrow_hours INT;
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

    -- Récupération du délai d'escrow personnalisé du vendeur (ou 24h par défaut)
    SELECT COALESCE(escrow_timer_hours, 24)
    INTO v_escrow_hours
    FROM public.users
    WHERE id = v_order.vendor_id;
    
    -- Sécurité en cas de vendor_id null ou absent
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
