
-- 1. Helper: is_team_member
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND active = true
  );
$$;

-- 2. audience_members: restrict SELECT to team members
DROP POLICY IF EXISTS "Auth read audience_members" ON public.audience_members;
CREATE POLICY "Team read audience_members" ON public.audience_members
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_team_member(auth.uid()));

-- 3. campaign_recipients: restrict SELECT to team members
DROP POLICY IF EXISTS "Auth read recipients" ON public.campaign_recipients;
CREATE POLICY "Team read recipients" ON public.campaign_recipients
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_team_member(auth.uid()));

-- 4. unsubscribes: restrict SELECT to team members
DROP POLICY IF EXISTS "Auth read unsubscribes" ON public.unsubscribes;
CREATE POLICY "Team read unsubscribes" ON public.unsubscribes
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_team_member(auth.uid()));

-- 5. whatsapp_instances: restrict SELECT to team members (protects webhook_secret)
DROP POLICY IF EXISTS "Authenticated read whatsapp_instances" ON public.whatsapp_instances;
CREATE POLICY "Team read whatsapp_instances" ON public.whatsapp_instances
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_team_member(auth.uid()));

-- 6. team_members: restrict SELECT to team members themselves (hide PII from client portal users)
DROP POLICY IF EXISTS "Authenticated users can read team_members" ON public.team_members;
CREATE POLICY "Team read team_members" ON public.team_members
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_team_member(auth.uid()));

-- 7. lead_history: require authentication on INSERT
DROP POLICY IF EXISTS "Public can insert lead history" ON public.lead_history;
CREATE POLICY "Authenticated insert lead history" ON public.lead_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Storage: contracts bucket — replace broad SELECT with ownership check
DROP POLICY IF EXISTS "Authenticated read contract files" ON storage.objects;
CREATE POLICY "Team or client read contract files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (
      is_admin(auth.uid())
      OR is_team_member(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        JOIN public.client_portal_access cpa ON cpa.client_id = c.client_id
        WHERE cpa.user_id = auth.uid()
          AND cpa.active = true
          AND (storage.foldername(storage.objects.name))[1] = c.id::text
      )
    )
  );

-- 9. Storage: whatsapp-media — restrict to team members
DROP POLICY IF EXISTS "Authenticated read whatsapp-media" ON storage.objects;
CREATE POLICY "Team read whatsapp-media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (is_admin(auth.uid()) OR is_team_member(auth.uid()))
  );

-- 10. Fix can_access_conversation: require user to be a team_member, not just any auth user
CREATE OR REPLACE FUNCTION public.can_access_conversation(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_admin(_user_id)
    OR (
      is_team_member(_user_id)
      AND EXISTS (
        SELECT 1 FROM public.whatsapp_conversations c
        LEFT JOIN public.team_members tm ON tm.user_id = _user_id AND tm.active = true
        LEFT JOIN public.whatsapp_queues q ON q.id = c.current_queue_id
        LEFT JOIN public.whatsapp_queue_members qm ON qm.queue_id = q.id AND qm.team_member_id = tm.id
        WHERE c.id = _conversation_id
          AND (
            c.assigned_team_member_id = tm.id
            OR q.team_member_id = tm.id
            OR qm.id IS NOT NULL
            OR q.team_member_id IS NULL
          )
      )
    );
$$;

-- 11. Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 12. Realtime.messages: restrict broadcast/presence subscriptions to team members
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team read realtime messages" ON realtime.messages;
CREATE POLICY "Team read realtime messages" ON realtime.messages
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid()));
DROP POLICY IF EXISTS "Team write realtime messages" ON realtime.messages;
CREATE POLICY "Team write realtime messages" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_team_member(auth.uid()));
