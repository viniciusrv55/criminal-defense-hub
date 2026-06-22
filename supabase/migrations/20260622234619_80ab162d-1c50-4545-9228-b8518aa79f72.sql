
-- Letterhead fields on document templates
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS header_image_url text,
  ADD COLUMN IF NOT EXISTS footer_image_url text,
  ADD COLUMN IF NOT EXISTS background_image_url text,
  ADD COLUMN IF NOT EXISTS letterhead_enabled boolean NOT NULL DEFAULT false;

-- Allow team members to delete dropdown items they created themselves
DROP POLICY IF EXISTS "Creator delete client_groups" ON public.client_groups;
CREATE POLICY "Creator delete client_groups" ON public.client_groups
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Creator delete comarcas" ON public.comarcas;
CREATE POLICY "Creator delete comarcas" ON public.comarcas
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Creator delete varas" ON public.varas;
CREATE POLICY "Creator delete varas" ON public.varas
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
