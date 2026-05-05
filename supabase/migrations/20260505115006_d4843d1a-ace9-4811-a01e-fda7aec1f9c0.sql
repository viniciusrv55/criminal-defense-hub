-- Tipos de documento (cadastráveis)
CREATE TABLE public.document_template_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_template_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read doc types" ON public.document_template_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage doc types" ON public.document_template_types FOR ALL USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_doc_types_updated BEFORE UPDATE ON public.document_template_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.document_template_types (name, sort_order) VALUES
  ('Contrato de Honorários', 1),
  ('Declaração', 2),
  ('Procuração', 3),
  ('Outros Documentos', 4);

-- Modelos de documento
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.document_template_types(id) ON DELETE RESTRICT,
  title text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  doc_date date,
  owner_id uuid NOT NULL, -- team_members.id (advogado dono)
  assigned_team_member_ids uuid[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Função: usuário pode ver template? (dono OU atribuído OU admin)
CREATE OR REPLACE FUNCTION public.can_use_document_template(_user_id uuid, _template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_templates dt
    JOIN public.team_members tm ON tm.user_id = _user_id
    WHERE dt.id = _template_id
      AND (dt.owner_id = tm.id OR tm.id = ANY(dt.assigned_team_member_ids))
  );
$$;

CREATE POLICY "Admins manage templates" ON public.document_templates FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Owner or assigned read templates" ON public.document_templates FOR SELECT
  USING (public.can_use_document_template(auth.uid(), id));
CREATE POLICY "Authenticated insert own template" ON public.document_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Owner update own template" ON public.document_templates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.user_id = auth.uid() AND tm.id = owner_id));

CREATE TRIGGER trg_doc_templates_updated BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_doc_templates_owner ON public.document_templates(owner_id);
CREATE INDEX idx_doc_templates_type ON public.document_templates(type_id);