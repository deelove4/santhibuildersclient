
-- 1. Profile deactivation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Document templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage templates" ON public.document_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view templates" ON public.document_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Enable realtime on relevant tables
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.project_stages REPLICA IDENTITY FULL;
ALTER TABLE public.project_updates REPLICA IDENTITY FULL;
ALTER TABLE public.project_media REPLICA IDENTITY FULL;
ALTER TABLE public.project_documents REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.projects; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.project_stages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.project_updates; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.project_media; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.project_documents; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 4. Notification helper: notify client on project stage change / new update / new media / new doc
CREATE OR REPLACE FUNCTION public.notify_project_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client UUID;
  v_project_name TEXT;
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
  v_link TEXT;
  v_pid UUID;
BEGIN
  v_pid := COALESCE(NEW.project_id, OLD.project_id);
  SELECT client_id, name INTO v_client, v_project_name FROM public.projects WHERE id = v_pid;
  IF v_client IS NULL THEN RETURN NEW; END IF;
  v_link := '/projects/' || v_pid::text;

  IF TG_TABLE_NAME = 'project_stages' THEN
    v_type := 'stage_update';
    v_title := v_project_name || ' — ' || NEW.stage_name;
    v_body := 'Progress: ' || NEW.progress || '% (' || NEW.status || ')';
  ELSIF TG_TABLE_NAME = 'project_media' THEN
    v_type := 'new_media';
    v_title := v_project_name || ' — new media';
    v_body := 'A new photo/video was uploaded';
  ELSIF TG_TABLE_NAME = 'project_documents' THEN
    v_type := 'new_document';
    v_title := v_project_name || ' — new document';
    v_body := NEW.file_name;
  ELSIF TG_TABLE_NAME = 'project_updates' THEN
    v_type := 'update';
    v_title := v_project_name;
    v_body := NEW.title;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    -- notify the other party
    IF NEW.sender_id = v_client THEN
      -- notify all admins
      INSERT INTO public.notifications (user_id, project_id, type, title, body, link)
      SELECT ur.user_id, v_pid, 'chat', v_project_name || ' — new message', LEFT(NEW.body, 120), v_link
      FROM public.user_roles ur WHERE ur.role = 'admin';
    ELSE
      INSERT INTO public.notifications (user_id, project_id, type, title, body, link)
      VALUES (v_client, v_pid, 'chat', v_project_name || ' — new message', LEFT(NEW.body, 120), v_link);
    END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, project_id, type, title, body, link)
  VALUES (v_client, v_pid, v_type, v_title, v_body, v_link);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stage ON public.project_stages;
CREATE TRIGGER trg_notify_stage AFTER UPDATE ON public.project_stages
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.progress IS DISTINCT FROM NEW.progress)
  EXECUTE FUNCTION public.notify_project_event();

DROP TRIGGER IF EXISTS trg_notify_media ON public.project_media;
CREATE TRIGGER trg_notify_media AFTER INSERT ON public.project_media
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();

DROP TRIGGER IF EXISTS trg_notify_doc ON public.project_documents;
CREATE TRIGGER trg_notify_doc AFTER INSERT ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();

DROP TRIGGER IF EXISTS trg_notify_update ON public.project_updates;
CREATE TRIGGER trg_notify_update AFTER INSERT ON public.project_updates
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();

DROP TRIGGER IF EXISTS trg_notify_message ON public.messages;
CREATE TRIGGER trg_notify_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();

-- 5. Update seed_project_stages function with more professional construction names
CREATE OR REPLACE FUNCTION public.seed_project_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stages TEXT[][] := ARRAY[
    ['site_prep','Site Survey & Preparation'],
    ['foundation','Excavation & Foundation'],
    ['structural','RCC Structural Framework'],
    ['brickwork','Masonry & Blockwork'],
    ['roofing','Roof Slab & Waterproofing'],
    ['plumbing','Plumbing & Sanitary Rough-In'],
    ['electrical','Electrical Rough-In & Conduiting'],
    ['plastering','Internal & External Plastering'],
    ['flooring','Flooring & Tiling'],
    ['interior','Interior Finishing & Joinery'],
    ['painting','Painting & Elevation Finish'],
    ['handover','Final Inspection & Handover']
  ];
  i INT;
BEGIN
  FOR i IN 1..array_length(stages,1) LOOP
    INSERT INTO public.project_stages (project_id, stage_key, stage_name, stage_order)
    VALUES (NEW.id, stages[i][1], stages[i][2], i);
  END LOOP;
  RETURN NEW;
END; $$;
