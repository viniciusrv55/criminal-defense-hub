CREATE TABLE public.client_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'atendimento_encerrado',
  summary text,
  attorney_ids uuid[] NOT NULL DEFAULT '{}',
  practice_area_id uuid REFERENCES public.practice_areas(id) ON DELETE SET NULL,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_history_client_id_idx ON public.client_history(client_id);
CREATE INDEX client_history_lead_id_idx ON public.client_history(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_history TO authenticated;
GRANT ALL ON public.client_history TO service_role;

ALTER TABLE public.client_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read client history"
  ON public.client_history FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Team can insert client history"
  ON public.client_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admin can update client history"
  ON public.client_history FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete client history"
  ON public.client_history FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));