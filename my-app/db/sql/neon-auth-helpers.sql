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

-- A cook's kitchen (profile, dishes, and everything hanging off them) is only
-- public once onboarding is complete AND the underlying user account is active.
-- Centralizes the public-visibility predicate used by the dishes/* RLS policies.
-- SECURITY DEFINER so it bypasses RLS internally and avoids policy recursion.
CREATE OR REPLACE FUNCTION public.app_cook_is_public(cook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cook_profiles cp
    JOIN "user" u ON u.id = cp.user_id
    WHERE cp.id = cook_id
      AND cp.setup_complete = true
      AND u.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.app_cook_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_cook_is_public(uuid) TO public;
