-- Add live_activity_token columns to orders table for Apple APNs Push
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS live_activity_token TEXT,
ADD COLUMN IF NOT EXISTS vendor_live_activity_token TEXT;

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_orders_live_activity_token ON orders(live_activity_token) WHERE live_activity_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_vendor_live_activity_token ON orders(vendor_live_activity_token) WHERE vendor_live_activity_token IS NOT NULL;
