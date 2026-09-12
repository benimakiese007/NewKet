-- Migration: fix trigger nk_validate_username_identity
-- Problème: le trigger se déclenchait sur TOUT UPDATE de users,
-- même quand username n'était pas modifié (ex: update de home_location).
-- Résultat: impossible de sauvegarder home_location via le client Supabase.
-- Fix: early exit si username n'a pas changé sur un UPDATE.

CREATE OR REPLACE FUNCTION public.nk_validate_username_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_username TEXT;
  normalized_old_username TEXT;
  normalized_reserved_username TEXT;
  conflict_count INTEGER;
BEGIN
  -- OPTIMISATION : si c'est un UPDATE et que username n'a pas changé,
  -- on saute toute la validation username (ex: update de home_location seul)
  IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;

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
