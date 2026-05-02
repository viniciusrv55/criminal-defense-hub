
-- 1. Add team_member role to enum (if not exists)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_member';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role_title TEXT,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage team_members"
ON public.team_members FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read team_members"
ON public.team_members FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 3. Kanban stage permissions
CREATE TABLE IF NOT EXISTS public.kanban_stage_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  can_act BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stage, team_member_id)
);

ALTER TABLE public.kanban_stage_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kanban perms"
ON public.kanban_stage_permissions FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read kanban perms"
ON public.kanban_stage_permissions FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 4. Add responsible_ids to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS responsible_ids UUID[] NOT NULL DEFAULT '{}';

-- 5. Helper function to check if a user can act on a stage
CREATE OR REPLACE FUNCTION public.can_act_on_stage(_user_id UUID, _stage TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kanban_stage_permissions ksp
    JOIN public.team_members tm ON tm.id = ksp.team_member_id
    WHERE tm.user_id = _user_id
      AND ksp.stage = _stage
      AND ksp.can_act = true
      AND tm.active = true
  );
$$;

-- 6. Helper: is user responsible for lead
CREATE OR REPLACE FUNCTION public.is_lead_responsible(_user_id UUID, _lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.team_members tm ON tm.id = ANY(l.responsible_ids)
    WHERE l.id = _lead_id
      AND tm.user_id = _user_id
  );
$$;

-- 7. Refresh leads RLS to include team_members
DROP POLICY IF EXISTS "Attorneys can view assigned leads" ON public.leads;

CREATE POLICY "Team members view their leads"
ON public.leads FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR public.is_lead_responsible(auth.uid(), id)
);

CREATE POLICY "Team members update allowed leads"
ON public.leads FOR UPDATE
USING (
  public.is_admin(auth.uid())
  OR (
    public.is_lead_responsible(auth.uid(), id)
    AND public.can_act_on_stage(auth.uid(), kanban_status)
  )
);
