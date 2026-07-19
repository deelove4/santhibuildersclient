DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'profiles_updated_at'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'engineers_updated_at'
      AND tgrelid = 'public.engineers'::regclass
  ) THEN
    CREATE TRIGGER engineers_updated_at
    BEFORE UPDATE ON public.engineers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'projects_updated_at'
      AND tgrelid = 'public.projects'::regclass
  ) THEN
    CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'project_stages_updated_at'
      AND tgrelid = 'public.project_stages'::regclass
  ) THEN
    CREATE TRIGGER project_stages_updated_at
    BEFORE UPDATE ON public.project_stages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'seed_stages_on_project'
      AND tgrelid = 'public.projects'::regclass
  ) THEN
    CREATE TRIGGER seed_stages_on_project
    AFTER INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.seed_project_stages();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'notify_project_stage_event'
      AND tgrelid = 'public.project_stages'::regclass
  ) THEN
    CREATE TRIGGER notify_project_stage_event
    AFTER UPDATE ON public.project_stages
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'notify_project_media_event'
      AND tgrelid = 'public.project_media'::regclass
  ) THEN
    CREATE TRIGGER notify_project_media_event
    AFTER INSERT ON public.project_media
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'notify_project_document_event'
      AND tgrelid = 'public.project_documents'::regclass
  ) THEN
    CREATE TRIGGER notify_project_document_event
    AFTER INSERT ON public.project_documents
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'notify_project_update_event'
      AND tgrelid = 'public.project_updates'::regclass
  ) THEN
    CREATE TRIGGER notify_project_update_event
    AFTER INSERT ON public.project_updates
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'notify_project_message_event'
      AND tgrelid = 'public.messages'::regclass
  ) THEN
    CREATE TRIGGER notify_project_message_event
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();
  END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;