ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assigned_attorney_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_assigned_attorney_idx ON public.clients(assigned_attorney_id);