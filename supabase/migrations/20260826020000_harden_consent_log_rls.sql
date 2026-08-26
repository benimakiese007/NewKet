-- Cookie-consent evidence is written only by the API using the service role.
-- Clients may read their own history, but must not be able to forge records.

BEGIN;

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consent_log_insert_service_role" ON public.consent_log;
DROP POLICY IF EXISTS "consent_log_select_own" ON public.consent_log;

CREATE POLICY "consent_log_select_own"
ON public.consent_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

COMMIT;
