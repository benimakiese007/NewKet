-- Migration: Homepage HERO content (slides + text) (20260521_homepage_hero_content.sql)

-- Stores the homepage HERO configuration (slides, copy, CTAs, promo card) as JSON.
CREATE TABLE IF NOT EXISTS public.hero_content (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    slides JSONB NOT NULL DEFAULT '[]'::jsonb,
    content JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.hero_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read (homepage is public)
CREATE POLICY "Anyone can view hero content" ON public.hero_content
  FOR SELECT
  USING (true);

-- Admin-only write
CREATE POLICY "Admins can manage hero content" ON public.hero_content
  FOR ALL
  USING (
    (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN (SELECT email FROM public.users WHERE role = 'admin')
  );

-- Default row (matches current hardcoded homepage HERO)
INSERT INTO public.hero_content (id, slides, content)
VALUES (
  'homepage-hero',
  '[
    { "imageUrl": "/src/assets/Images/marketplace-hero.jpg", "overlay": 0.4 },
    { "imageUrl": "/src/assets/Images/hero-black-friday.png", "overlay": 0.4 },
    { "imageUrl": "/src/assets/Images/hero-bf-definition.webp", "overlay": 0.4 }
  ]'::jsonb,
  '{
    "titleLine1": "SUBTILE",
    "titleLine2": "ÉLÉGANCE.",
    "description": "L''excellence du luxe à portée de main. Découvrez une sélection curatée des plus belles pièces du moment.",
    "primaryCta": { "label": "Découvrir", "href": "/src/pages/catalog.html" },
    "secondaryCta": { "label": "Vendre", "href": "/src/pages/publish.html" },
    "slideIntervalSeconds": 5,
    "promo": { "headline": "-50%", "caption": "Sélection Premium", "code": "NEWKET50" }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
