
CREATE POLICY "stage_images_select_member" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'stage-images' AND private.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY "stage_images_admin_all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'stage-images' AND private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'stage-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
