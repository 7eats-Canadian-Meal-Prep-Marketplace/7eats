CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '');
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '');
$$;

CREATE OR REPLACE FUNCTION public.app_public_user_is_active(user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "user"
    WHERE id = user_id
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.app_public_user_is_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_public_user_is_active(text) TO public;
