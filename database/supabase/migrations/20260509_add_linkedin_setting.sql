-- Add LinkedIn support for installations that use split social-link columns.
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS linkedin_link TEXT;
