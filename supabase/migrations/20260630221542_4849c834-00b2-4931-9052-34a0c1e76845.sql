
-- Allow team members to update templates assigned to them
CREATE POLICY "Assigned can update templates" ON public.document_templates
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.id = ANY(document_templates.assigned_team_member_ids))
);

-- Error logs table for the super admin to see issues
CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  route TEXT,
  screen TEXT,
  action TEXT,
  table_name TEXT,
  error_code TEXT,
  error_message TEXT,
  error_details TEXT,
  payload JSONB,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.error_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- anyone (even anon) can insert an error log
CREATE POLICY "Anyone can insert error logs" ON public.error_logs
FOR INSERT WITH CHECK (true);

-- only super_admin can view/delete
CREATE POLICY "Super admins view logs" ON public.error_logs
FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins delete logs" ON public.error_logs
FOR DELETE USING (has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
