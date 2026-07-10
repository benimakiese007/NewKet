-- Migration: Site branding + theme fields (20260520_site_branding_settings.sql)

-- 1) Extend settings table with site-wide branding fields
ALTER TABLE IF EXISTS public.settings
    ADD COLUMN IF NOT EXISTS primary_color TEXT,
    ADD COLUMN IF NOT EXISTS secondary_color TEXT,
    ADD COLUMN IF NOT EXISTS header_bg TEXT,
    ADD COLUMN IF NOT EXISTS header_fg TEXT,
    ADD COLUMN IF NOT EXISTS footer_bg TEXT,
    ADD COLUMN IF NOT EXISTS footer_fg TEXT,
    ADD COLUMN IF NOT EXISTS theme_color TEXT,
    ADD COLUMN IF NOT EXISTS font_heading TEXT,
    ADD COLUMN IF NOT EXISTS font_body TEXT,
    ADD COLUMN IF NOT EXISTS favicon_url TEXT,
    ADD COLUMN IF NOT EXISTS apple_touch_icon_url TEXT,
    ADD COLUMN IF NOT EXISTS pwa_icon_192_url TEXT,
    ADD COLUMN IF NOT EXISTS pwa_icon_512_url TEXT,
    ADD COLUMN IF NOT EXISTS pwa_icon_192_maskable_url TEXT,
    ADD COLUMN IF NOT EXISTS pwa_icon_512_maskable_url TEXT,
    ADD COLUMN IF NOT EXISTS header_logo_url TEXT,
    ADD COLUMN IF NOT EXISTS footer_logo_url TEXT;

-- 2) Reasonable defaults for the global row (keep existing look if not set)
UPDATE public.settings
SET
  header_bg = COALESCE(header_bg, '#013220'),
  header_fg = COALESCE(header_fg, '#ffffff'),
  footer_bg = COALESCE(footer_bg, '#013220'),
  footer_fg = COALESCE(footer_fg, '#ffffff'),
  theme_color = COALESCE(theme_color, '#064734'),
  font_heading = COALESCE(font_heading, '''Poppins'', sans-serif'),
  font_body = COALESCE(font_body, '''Inter'', system-ui, -apple-system, ''Segoe UI'', Roboto, Arial, sans-serif')
WHERE id = 'global-settings';

