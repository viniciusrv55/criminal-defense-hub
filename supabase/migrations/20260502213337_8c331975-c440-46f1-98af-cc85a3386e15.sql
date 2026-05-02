
ALTER TABLE public.practice_areas
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_message TEXT,
  ADD COLUMN IF NOT EXISTS cta_button_text TEXT DEFAULT 'Solicitar Atendimento via WhatsApp',
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;

UPDATE public.practice_areas
SET slug = lower(regexp_replace(coalesce(title,''), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS practice_areas_slug_unique ON public.practice_areas(slug);

INSERT INTO storage.buckets (id, name, public)
VALUES ('practice-areas', 'practice-areas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read practice-areas files" ON storage.objects;
CREATE POLICY "Public read practice-areas files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'practice-areas');

DROP POLICY IF EXISTS "Admin upload practice-areas files" ON storage.objects;
CREATE POLICY "Admin upload practice-areas files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'practice-areas' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin update practice-areas files" ON storage.objects;
CREATE POLICY "Admin update practice-areas files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'practice-areas' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin delete practice-areas files" ON storage.objects;
CREATE POLICY "Admin delete practice-areas files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'practice-areas' AND public.is_admin(auth.uid()));
