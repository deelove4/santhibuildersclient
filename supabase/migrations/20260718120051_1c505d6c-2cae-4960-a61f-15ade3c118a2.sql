
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND client_id = _user_id);
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_project_member(uuid, uuid) FROM PUBLIC;

-- Table policies
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS user_roles_select_admin ON public.user_roles;
CREATE POLICY user_roles_select_admin ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS engineers_all_admin ON public.engineers;
DROP POLICY IF EXISTS engineers_select_authenticated ON public.engineers;
CREATE POLICY engineers_all_admin ON public.engineers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE OR REPLACE VIEW public.engineers_public AS
  SELECT id, name, specialization, avatar_url, active FROM public.engineers WHERE active = true;
GRANT SELECT ON public.engineers_public TO authenticated;

DROP POLICY IF EXISTS projects_all_admin ON public.projects;
CREATE POLICY projects_all_admin ON public.projects FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS stages_all_admin ON public.project_stages;
CREATE POLICY stages_all_admin ON public.project_stages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS stages_select_member ON public.project_stages;
CREATE POLICY stages_select_member ON public.project_stages FOR SELECT TO authenticated
  USING (private.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS updates_all_admin ON public.project_updates;
CREATE POLICY updates_all_admin ON public.project_updates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS updates_select_member ON public.project_updates;
CREATE POLICY updates_select_member ON public.project_updates FOR SELECT TO authenticated
  USING (private.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS messages_select_member ON public.messages;
CREATE POLICY messages_select_member ON public.messages FOR SELECT TO authenticated
  USING (private.is_project_member(project_id, auth.uid()));
DROP POLICY IF EXISTS messages_insert_member ON public.messages;
CREATE POLICY messages_insert_member ON public.messages FOR INSERT TO authenticated
  WITH CHECK (private.is_project_member(project_id, auth.uid()) AND sender_id = auth.uid());
DROP POLICY IF EXISTS messages_update_admin ON public.messages;
CREATE POLICY messages_update_admin ON public.messages FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS notifications_all_admin ON public.notifications;
CREATE POLICY notifications_all_admin ON public.notifications FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS activity_select_admin ON public.activity_logs;
CREATE POLICY activity_select_admin ON public.activity_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS activity_select_member ON public.activity_logs;
CREATE POLICY activity_select_member ON public.activity_logs FOR SELECT TO authenticated
  USING (project_id IS NOT NULL AND private.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS media_select_member ON public.project_media;
CREATE POLICY media_select_member ON public.project_media FOR SELECT TO authenticated
  USING (private.is_project_member(project_id, auth.uid()));
DROP POLICY IF EXISTS media_all_admin ON public.project_media;
CREATE POLICY media_all_admin ON public.project_media FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS docs_select_member ON public.project_documents;
CREATE POLICY docs_select_member ON public.project_documents FOR SELECT TO authenticated
  USING (private.is_project_member(project_id, auth.uid()));
DROP POLICY IF EXISTS docs_all_admin ON public.project_documents;
CREATE POLICY docs_all_admin ON public.project_documents FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage templates" ON public.document_templates;
DROP POLICY IF EXISTS "Authenticated can view templates" ON public.document_templates;
CREATE POLICY templates_all_admin ON public.document_templates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

-- Storage policies
DROP POLICY IF EXISTS "media read members" ON storage.objects;
CREATE POLICY "media read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-media' AND private.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));
DROP POLICY IF EXISTS "docs read members" ON storage.objects;
CREATE POLICY "docs read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-documents' AND private.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));

DROP POLICY IF EXISTS "media write admin" ON storage.objects;
CREATE POLICY "media write admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-media' AND private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "media update admin" ON storage.objects;
CREATE POLICY "media update admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-media' AND private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "media delete admin" ON storage.objects;
CREATE POLICY "media delete admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-media' AND private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "docs write admin" ON storage.objects;
CREATE POLICY "docs write admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-documents' AND private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "docs update admin" ON storage.objects;
CREATE POLICY "docs update admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-documents' AND private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "docs delete admin" ON storage.objects;
CREATE POLICY "docs delete admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-documents' AND private.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "templates: admin write" ON storage.objects;
CREATE POLICY "templates: admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'document-templates' AND private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "templates: admin update" ON storage.objects;
CREATE POLICY "templates: admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'document-templates' AND private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "templates: admin delete" ON storage.objects;
CREATE POLICY "templates: admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'document-templates' AND private.has_role(auth.uid(),'admin'));

DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
