
-- Seed admin user
DO $$
DECLARE admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@santhibuilders.com';
  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@santhibuilders.com', crypt('portal@#santhibuilders', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Santhi Admin"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_id, jsonb_build_object('sub', admin_id::text, 'email', 'admin@santhibuilders.com', 'email_verified', true), 'email', admin_id::text, now(), now(), now());
  END IF;
  INSERT INTO public.profiles (id, email, full_name) VALUES (admin_id, 'admin@santhibuilders.com', 'Santhi Admin')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- Project media (images/videos)
CREATE TABLE public.project_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key text,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  media_type text NOT NULL DEFAULT 'photo', -- photo | drone | video
  caption text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_media TO authenticated;
GRANT ALL ON public.project_media TO service_role;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_select_member ON public.project_media FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY media_all_admin ON public.project_media FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Project documents
CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  category text NOT NULL DEFAULT 'general', -- contract | invoice | drawing | approval | general
  description text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_documents TO authenticated;
GRANT ALL ON public.project_documents TO service_role;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY docs_select_member ON public.project_documents FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY docs_all_admin ON public.project_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage RLS policies for project-media and project-documents buckets
-- Path convention: <project_id>/<file>
CREATE POLICY "media read members" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-media'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "media write admin" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "media update admin" ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "media delete admin" ON storage.objects FOR DELETE
  USING (bucket_id = 'project-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "docs read members" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-documents'
    AND public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
CREATE POLICY "docs write admin" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "docs update admin" ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "docs delete admin" ON storage.objects FOR DELETE
  USING (bucket_id = 'project-documents' AND public.has_role(auth.uid(), 'admin'));
