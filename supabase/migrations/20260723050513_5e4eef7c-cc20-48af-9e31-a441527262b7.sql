
-- Optional stage image uploads
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Per-stage messages (chat scoped to a stage) — nullable so existing project chat still works
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS stage_key text;

-- Trigger: notify all admins when a stage status/notes/images change
CREATE OR REPLACE FUNCTION public.notify_stage_admin_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_name text;
  v_link text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.image_urls IS DISTINCT FROM OLD.image_urls THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = NEW.project_id;
    v_link := '/projects/' || NEW.project_id::text;
    INSERT INTO public.notifications (user_id, project_id, type, title, body, link)
    SELECT ur.user_id, NEW.project_id, 'stage_update',
      COALESCE(v_project_name,'Project') || ' — ' || NEW.stage_name,
      'Status: ' || NEW.status,
      v_link
    FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id <> COALESCE(NEW.updated_by, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_stage_admin_update ON public.project_stages;
CREATE TRIGGER trg_notify_stage_admin_update
AFTER UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public.notify_stage_admin_update();

-- Ensure messages trigger for chat notifications exists (uses existing notify_project_event)
DROP TRIGGER IF EXISTS trg_notify_message ON public.messages;
CREATE TRIGGER trg_notify_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();
