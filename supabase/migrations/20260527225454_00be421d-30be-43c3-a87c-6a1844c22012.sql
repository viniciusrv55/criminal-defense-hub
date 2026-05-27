
-- Customizable kanban columns
CREATE TABLE public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text DEFAULT 'border-accent',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kanban_columns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_columns TO authenticated;
GRANT ALL ON public.kanban_columns TO service_role;

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view columns"
  ON public.kanban_columns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage columns insert"
  ON public.kanban_columns FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage columns update"
  ON public.kanban_columns FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage columns delete"
  ON public.kanban_columns FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_kanban_columns_updated
  BEFORE UPDATE ON public.kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default columns
INSERT INTO public.kanban_columns (key, label, color, sort_order) VALUES
  ('new', 'Novos', 'border-blue-500', 1),
  ('contacted', 'Contatado', 'border-yellow-500', 2),
  ('in_progress', 'Em Atendimento', 'border-accent', 3),
  ('proposal', 'Proposta', 'border-purple-500', 4),
  ('closed', 'Finalizado', 'border-green-500', 5)
ON CONFLICT (key) DO NOTHING;
