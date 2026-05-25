
-- Map kanban stage -> whatsapp queue (for automatic transfer on stage change)
CREATE TABLE IF NOT EXISTS public.kanban_stage_queue_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL UNIQUE,
  queue_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kanban_stage_queue_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage stage map" ON public.kanban_stage_queue_map
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Auth read stage map" ON public.kanban_stage_queue_map
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_kanban_stage_queue_map_updated
BEFORE UPDATE ON public.kanban_stage_queue_map
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Flag for "uso geral" templates
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS is_general boolean NOT NULL DEFAULT false;

-- Ensure 'Recibo' document type exists
INSERT INTO public.document_template_types (name, sort_order, active)
SELECT 'Recibo', 100, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_template_types WHERE lower(name) = 'recibo'
);
