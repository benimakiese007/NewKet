-- ============================================================================
-- MIGRATION: Compact existing usernames with spaces
-- Date: 2026-08-08
-- Purpose: Normalize legacy usernames so public/login usernames are always compact.
-- ============================================================================

BEGIN;

ALTER TABLE public.users DISABLE TRIGGER trg_validate_username_identity;

DO $$
DECLARE
  r RECORD;
  base_username TEXT;
  candidate_username TEXT;
  reserved_username TEXT;
  reserved_until TIMESTAMPTZ;
  suffix_number INTEGER;
  suffix_width INTEGER;
  group_size INTEGER;
  conflict_exists BOOLEAN;
BEGIN
  FOR r IN
    SELECT
      id,
      role,
      username,
      company_name,
      shop_slug,
      name,
      email,
      first_name,
      last_name,
      username_reserved_value,
      username_reserved_until,
      row_number() OVER (
        PARTITION BY public.nk_normalize_login_username(
          COALESCE(username, company_name, shop_slug, name, split_part(email, '@', 1), 'user')
        )
        ORDER BY role, id
      ) AS rn,
      count(*) OVER (
        PARTITION BY public.nk_normalize_login_username(
          COALESCE(username, company_name, shop_slug, name, split_part(email, '@', 1), 'user')
        )
      ) AS group_size
    FROM public.users
    WHERE
      username IS NULL
      OR username <> public.nk_normalize_login_username(username)
      OR (
        role = 'supplier'
        AND (
          company_name IS DISTINCT FROM public.nk_normalize_login_username(username)
          OR shop_slug IS DISTINCT FROM public.nk_normalize_login_username(username)
          OR name IS DISTINCT FROM public.nk_normalize_login_username(username)
        )
      )
    ORDER BY role, id
  LOOP
    group_size := COALESCE(r.group_size, 1);
    suffix_number := COALESCE(r.rn, 1);

    base_username := public.nk_normalize_login_username(
      COALESCE(
        r.username,
        r.company_name,
        r.shop_slug,
        r.name,
        split_part(r.email, '@', 1),
        'user'
      )
    );

    IF base_username IS NULL THEN
      base_username := 'user';
    END IF;

    suffix_width := GREATEST(1, 8 - length(base_username));

    IF group_size = 1 AND length(base_username) >= 8 THEN
      candidate_username := base_username;
    ELSE
      candidate_username := base_username || lpad(suffix_number::text, suffix_width, '0');
    END IF;

    IF candidate_username !~ '[a-z]' THEN
      candidate_username := candidate_username || '_user';
    END IF;

    IF length(candidate_username) < 8 THEN
      candidate_username := candidate_username || lpad(suffix_number::text, GREATEST(1, 8 - length(candidate_username)), '0');
    END IF;

    LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id <> r.id
          AND (
            lower(u.username) = candidate_username
            OR (
              u.username_reserved_value IS NOT NULL
              AND lower(u.username_reserved_value) = candidate_username
              AND COALESCE(u.username_reserved_until, NOW() - INTERVAL '1 second') > NOW()
            )
          )
      ) INTO conflict_exists;

      EXIT WHEN NOT conflict_exists;

      suffix_number := suffix_number + 1;
      IF group_size = 1 AND length(base_username) >= 8 THEN
        candidate_username := base_username;
      ELSE
        candidate_username := base_username || lpad(suffix_number::text, suffix_width, '0');
      END IF;

      IF candidate_username IS NULL THEN
        candidate_username := 'user' || lpad(suffix_number::text, 2, '0');
      END IF;
      IF candidate_username !~ '[a-z]' THEN
        candidate_username := candidate_username || '_user';
      END IF;
      IF length(candidate_username) < 8 THEN
        candidate_username := candidate_username || lpad(suffix_number::text, GREATEST(1, 8 - length(candidate_username)), '0');
      END IF;
    END LOOP;

    reserved_username := public.nk_normalize_login_username(r.username_reserved_value);
    reserved_until := r.username_reserved_until;

    IF reserved_username = candidate_username THEN
      reserved_username := NULL;
      reserved_until := NULL;
    END IF;

    UPDATE public.users
    SET
      username = candidate_username,
      company_name = CASE WHEN role = 'supplier' THEN candidate_username ELSE company_name END,
      shop_slug = CASE WHEN role = 'supplier' THEN candidate_username ELSE shop_slug END,
      name = CASE
        WHEN role = 'supplier' THEN candidate_username
        ELSE COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), name, candidate_username)
      END,
      username_reserved_value = reserved_username,
      username_reserved_until = reserved_until
    WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.users ENABLE TRIGGER trg_validate_username_identity;

COMMIT;
