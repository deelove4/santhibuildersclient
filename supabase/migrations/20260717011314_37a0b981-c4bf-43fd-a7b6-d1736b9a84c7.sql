
CREATE POLICY "templates: authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'document-templates');

CREATE POLICY "templates: admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'document-templates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "templates: admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'document-templates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "templates: admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'document-templates' AND public.has_role(auth.uid(), 'admin'));
