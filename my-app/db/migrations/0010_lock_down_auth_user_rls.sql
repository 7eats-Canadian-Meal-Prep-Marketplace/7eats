CREATE OR REPLACE FUNCTION auth.uid()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '');
$$;
--> statement-breakpoint
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
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.app_public_user_is_active(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.app_public_user_is_active(text) TO public;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_select_all" ON "user";
--> statement-breakpoint
CREATE POLICY "user_select_own" ON "user" AS PERMISSIVE FOR SELECT TO public USING (id = auth.uid());
--> statement-breakpoint
CREATE POLICY "user_select_admin" ON "user" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'admin');
--> statement-breakpoint
CREATE POLICY "user_select_service" ON "user" AS PERMISSIVE FOR SELECT TO public USING (auth.role() = 'service_role');
--> statement-breakpoint
ALTER POLICY "cook_profiles_select_active" ON "cook_profiles" TO public USING (app_public_user_is_active(cook_profiles.user_id));
