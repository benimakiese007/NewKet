BEGIN;

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

UPDATE public.activities AS a
SET user_id = au.id
FROM auth.users AS au
WHERE a.user_id IS NULL
  AND a.user_email IS NOT NULL
  AND lower(a.user_email) = lower(au.email);

CREATE INDEX IF NOT EXISTS idx_activities_user_id
ON public.activities (user_id);

COMMIT;
