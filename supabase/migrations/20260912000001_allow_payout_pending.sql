-- Migration: Allow users to flag themselves for payout change (2026-09-12)

CREATE OR REPLACE FUNCTION public.block_sensitive_user_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Si ce n'est pas un admin et que le vendeur essaie de modifier ces champs sensibles
  IF NOT is_admin() THEN
    -- Bloquer la modification de payout_change_pending SAUF pour passer de false à true
    IF NEW.payout_change_pending IS DISTINCT FROM OLD.payout_change_pending THEN
      IF NEW.payout_change_pending = true AND (OLD.payout_change_pending = false OR OLD.payout_change_pending IS NULL) THEN
        -- Autorisé : l'utilisateur demande un changement de paiement
        NULL;
      ELSE
        RAISE EXCEPTION 'Security violation: payout_change_pending can only be modified by an admin.';
      END IF;
    END IF;
    
    -- Bloquer la remise a zero de identity_document_urls
    IF OLD.identity_document_urls IS NOT NULL 
       AND (NEW.identity_document_urls IS NULL OR NEW.identity_document_urls = '[]'::jsonb) THEN
      RAISE EXCEPTION 'Security violation: identity_document_urls cannot be cleared by a user.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
