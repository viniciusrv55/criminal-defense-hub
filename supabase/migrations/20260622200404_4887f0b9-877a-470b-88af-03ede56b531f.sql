
-- 1) Helper: é atendente (role_title = 'Atendimento')?
CREATE OR REPLACE FUNCTION public.is_atendente(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND active = true
      AND lower(coalesce(role_title,'')) IN ('atendimento','atendente')
  );
$$;

-- 2) CLIENTS: SELECT restrito por advogado atribuído
DROP POLICY IF EXISTS "Team members read clients" ON public.clients;
CREATE POLICY "Team members read assigned clients"
ON public.clients FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR created_by = auth.uid()
  OR assigned_attorney_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.id = clients.assigned_attorney_id
      AND tm.active = true
  )
);

-- 3) CONTRACTS: SELECT restrito por advogado atribuído
DROP POLICY IF EXISTS "Team members read contracts" ON public.contracts;
CREATE POLICY "Team members read assigned contracts"
ON public.contracts FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR created_by = auth.uid()
  OR attorney_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.id = contracts.attorney_id
      AND tm.active = true
  )
);

-- 4) LEADS: SELECT para todos os membros do time (visão Kanban global)
DROP POLICY IF EXISTS "Team members view their leads" ON public.leads;
CREATE POLICY "Team members view all leads"
ON public.leads FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR is_team_member(auth.uid()));

-- 5) LEADS: UPDATE — admin OU (etapa permitida E (atendente OU responsável pelo lead))
DROP POLICY IF EXISTS "Team members update allowed leads" ON public.leads;
CREATE POLICY "Team members update allowed leads"
ON public.leads FOR UPDATE TO authenticated
USING (
  is_admin(auth.uid())
  OR (
    can_act_on_stage(auth.uid(), kanban_status)
    AND (is_atendente(auth.uid()) OR is_lead_responsible(auth.uid(), id))
  )
)
WITH CHECK (
  is_admin(auth.uid())
  OR (
    can_act_on_stage(auth.uid(), kanban_status)
    AND (is_atendente(auth.uid()) OR is_lead_responsible(auth.uid(), id))
  )
);
