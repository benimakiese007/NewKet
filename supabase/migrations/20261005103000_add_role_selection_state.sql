-- Persist the state "authenticated, but no marketplace role selected yet".
-- A NULL role never grants access; it only records a real account that must
-- return to /choose-role after signing in again.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role_selection_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- A user can exist in Supabase Auth before becoming a buyer or seller.
-- Make that state representable instead of assigning a default role.
ALTER TABLE public.users
  ALTER COLUMN role DROP NOT NULL;

-- Existing accounts already have a role and must remain fully active.
UPDATE public.users
SET role_selection_completed = TRUE
WHERE role IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_selection_completed
  ON public.users (role_selection_completed)
  WHERE role_selection_completed = FALSE;
