CREATE TABLE public.featured_attorneys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  specialty TEXT,
  oab_number TEXT,
  photo_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_attorneys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read featured attorneys"
  ON public.featured_attorneys FOR SELECT USING (active = true);

CREATE POLICY "Admins manage featured attorneys"
  ON public.featured_attorneys FOR ALL USING (is_admin(auth.uid()));

CREATE TRIGGER set_featured_attorneys_updated_at
  BEFORE UPDATE ON public.featured_attorneys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (key, value) VALUES
  ('areas_page_eyebrow', 'Áreas de Atuação'),
  ('areas_page_title', 'Onde podemos defender você'),
  ('areas_page_title_highlight', 'defender você'),
  ('areas_page_subtitle', 'Atuação especializada em Direito Criminal. Selecione uma área para ver detalhes, casos, galeria e solicitar atendimento.'),
  ('attorneys_section_eyebrow', 'Nossa Equipe'),
  ('attorneys_section_title', 'Advogados que defendem você')
ON CONFLICT (key) DO NOTHING;