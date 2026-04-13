-- Script pour mettre à jour la table orders pour CinetPay

-- Ajout des champs nécessaires à l'intégration CinetPay
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_city VARCHAR(100);

-- Si vous avez besoin d'une table séparée "payments" (Optionnel, au cas où):
/*
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    amount NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF',
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
*/
