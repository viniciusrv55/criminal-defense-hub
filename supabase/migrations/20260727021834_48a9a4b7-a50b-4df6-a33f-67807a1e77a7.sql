
-- Public read for site image buckets (works once buckets are switched to public)
CREATE POLICY "Public read site images" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id IN ('site-assets','practice-areas','blog-images'));

CREATE POLICY "Authenticated manage site images" ON storage.objects FOR ALL TO authenticated
USING (bucket_id IN ('site-assets','practice-areas','blog-images'))
WITH CHECK (bucket_id IN ('site-assets','practice-areas','blog-images'));

-- Private buckets: only authenticated staff
CREATE POLICY "Authenticated read private files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('contracts','whatsapp-media'));

CREATE POLICY "Authenticated write private files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id IN ('contracts','whatsapp-media'))
WITH CHECK (bucket_id IN ('contracts','whatsapp-media'));
