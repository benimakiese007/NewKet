-- ============================================================================
-- MIGRATION: Username identity for customers and vendors
-- Date: 2026-08-07
-- ============================================================================

BEGIN;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS username_reserved_value TEXT,
ADD COLUMN IF NOT EXISTS username_reserved_until TIMESTAMPTZ;

COMMENT ON COLUMN public.users.username IS 'Public and login username. Unique across the platform.';
COMMENT ON COLUMN public.users.first_name IS 'Customer first name.';
COMMENT ON COLUMN public.users.last_name IS 'Customer last name.';
COMMENT ON COLUMN public.users.username_changed_at IS 'Last time the username was changed.';
COMMENT ON COLUMN public.users.username_reserved_value IS 'Previous username reserved for 14 days.';
COMMENT ON COLUMN public.users.username_reserved_until IS 'Reservation expiry for the previous username.';

CREATE OR REPLACE FUNCTION public.nk_normalize_login_username(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(lower(trim(coalesce(input, ''))), '\s+', '', 'g'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.nk_validate_username_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_username TEXT;
  normalized_old_username TEXT;
  normalized_reserved_username TEXT;
  conflict_count INTEGER;
BEGIN
  normalized_username := public.nk_normalize_login_username(NEW.username);
  normalized_old_username := NULL;
  normalized_reserved_username := NULL;

  IF normalized_username IS NULL THEN
    RAISE EXCEPTION 'Le nom d''utilisateur est obligatoire.' USING ERRCODE = '23514';
  END IF;

  IF normalized_username !~ '^[a-z0-9_-]{8,}$' THEN
    RAISE EXCEPTION 'Le nom d''utilisateur doit contenir au moins 8 caracteres en minuscules avec lettres, chiffres, tirets ou underscores.' USING ERRCODE = '23514';
  END IF;

  IF normalized_username !~ '[a-z]' THEN
    RAISE EXCEPTION 'Le nom d''utilisateur doit contenir au moins une lettre.' USING ERRCODE = '23514';
  END IF;

  NEW.username := normalized_username;

  IF NEW.role = 'supplier' THEN
    NEW.company_name := NEW.username;
    NEW.shop_slug := NEW.username;
  END IF;

  IF NEW.role = 'customer' THEN
    NEW.name := COALESCE(
      NULLIF(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''),
      NEW.username
    );
  ELSIF NEW.role = 'supplier' THEN
    NEW.name := NEW.username;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.username_changed_at := NOW();
    NEW.username_reserved_value := NULL;
    NEW.username_reserved_until := NULL;
  ELSE
    normalized_old_username := public.nk_normalize_login_username(COALESCE(OLD.username, ''));
    normalized_reserved_username := public.nk_normalize_login_username(COALESCE(OLD.username_reserved_value, NEW.username_reserved_value));

    IF normalized_username <> normalized_old_username THEN
      IF OLD.username_changed_at IS NOT NULL
         AND OLD.username_changed_at > NOW() - INTERVAL '14 days'
         AND (
           normalized_reserved_username IS NULL
           OR normalized_username <> normalized_reserved_username
           OR COALESCE(OLD.username_reserved_until, NOW() - INTERVAL '1 second') <= NOW()
         )
      THEN
        RAISE EXCEPTION 'Le nom d''utilisateur ne peut etre change qu''une fois tous les 14 jours.' USING ERRCODE = '23514';
      END IF;

      NEW.username_changed_at := NOW();
      NEW.username_reserved_value := OLD.username;
      NEW.username_reserved_until := NOW() + INTERVAL '14 days';
    ELSE
      NEW.username_changed_at := COALESCE(OLD.username_changed_at, NOW());
      NEW.username_reserved_value := OLD.username_reserved_value;
      NEW.username_reserved_until := OLD.username_reserved_until;
    END IF;
  END IF;

  SELECT COUNT(*)
    INTO conflict_count
  FROM public.users u
  WHERE u.id <> COALESCE(OLD.id, NEW.id)
    AND (
      lower(u.username) = normalized_username
      OR (
        u.username_reserved_value IS NOT NULL
        AND lower(u.username_reserved_value) = normalized_username
        AND COALESCE(u.username_reserved_until, NOW() - INTERVAL '1 second') > NOW()
      )
    );

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Ce nom d''utilisateur est deja pris.' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_username_identity ON public.users;
CREATE TRIGGER trg_validate_username_identity
BEFORE INSERT OR UPDATE OF username, first_name, last_name, company_name, shop_slug, role
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.nk_validate_username_identity();

WITH base_profiles AS (
  SELECT
    u.id,
    u.role,
    u.name,
    u.company_name,
    u.shop_slug,
    u.email,
    public.nk_slugify(
      CASE
        WHEN u.role = 'supplier' THEN COALESCE(u.company_name, u.shop_slug, u.name, split_part(u.email, '@', 1), 'boutique')
        ELSE COALESCE(u.name, split_part(u.email, '@', 1), 'utilisateur')
      END
    ) AS raw_username
  FROM public.users u
),
prepared AS (
  SELECT
    id,
    role,
    CASE
      WHEN raw_username IS NULL OR raw_username = '' THEN 'user'
      WHEN raw_username !~ '[a-z]' THEN raw_username || '_user'
      ELSE raw_username
    END AS base_username
  FROM base_profiles
),
ranked AS (
  SELECT
    id,
    role,
    CASE
      WHEN length(base_username) < 8 THEN base_username || '_' || substr(replace(id::text, '-', ''), 1, 6)
      ELSE base_username
    END AS normalized_username,
    row_number() OVER (PARTITION BY base_username ORDER BY id) AS rn
  FROM prepared
)
UPDATE public.users u
SET
  username = CASE
    WHEN r.rn = 1 THEN r.normalized_username
    ELSE r.normalized_username || '_' || substr(replace(u.id::text, '-', ''), 1, 6)
  END,
  first_name = COALESCE(
    u.first_name,
    CASE
      WHEN u.role = 'customer' AND position(' ' IN COALESCE(u.name, '')) > 0
        THEN split_part(u.name, ' ', 1)
      ELSE NULL
    END
  ),
  last_name = COALESCE(
    u.last_name,
    CASE
      WHEN u.role = 'customer' AND position(' ' IN COALESCE(u.name, '')) > 0
        THEN substring(u.name from position(' ' IN u.name) + 1)
      ELSE NULL
    END
  ),
  company_name = CASE WHEN u.role = 'supplier' THEN COALESCE(u.company_name, r.normalized_username) ELSE u.company_name END,
  shop_slug = CASE WHEN u.role = 'supplier' THEN COALESCE(u.shop_slug, r.normalized_username) ELSE u.shop_slug END,
  name = CASE
    WHEN u.role = 'supplier' THEN COALESCE(u.company_name, r.normalized_username)
    ELSE COALESCE(NULLIF(trim(concat_ws(' ', split_part(COALESCE(u.name, ''), ' ', 1), substring(COALESCE(u.name, '') from position(' ' IN COALESCE(u.name, '')) + 1))), ''), r.normalized_username)
  END,
  username_changed_at = COALESCE(u.username_changed_at, NOW() - INTERVAL '14 days'),
  username_reserved_value = NULL,
  username_reserved_until = NULL
FROM ranked r
WHERE u.id = r.id
  AND (u.username IS NULL OR u.username = '');

CREATE UNIQUE INDEX IF NOT EXISTS users_unique_username
ON public.users (lower(username))
WHERE username IS NOT NULL AND username <> '';

COMMIT;
