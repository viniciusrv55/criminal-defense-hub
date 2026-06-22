GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.team_members TO service_role;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));