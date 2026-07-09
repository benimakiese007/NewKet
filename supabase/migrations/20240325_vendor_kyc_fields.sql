-- Add KYC fields to public.users table (20240325)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS documents_url JSONB;

-- Comment for clarity
COMMENT ON COLUMN public.users.status IS 'Status of the vendor: pending, approved, rejected';
COMMENT ON COLUMN public.users.company_name IS 'Official name of the vendor store';
COMMENT ON COLUMN public.users.documents_url IS 'Links to uploaded business documents';

-- Update existing users to 'approved' by default to avoid breaking existing vendors
UPDATE public.users SET status = 'approved' WHERE role IN ('supplier', 'admin') AND status IS NULL;
UPDATE public.users SET status = 'pending' WHERE role = 'supplier' AND status IS NULL;
