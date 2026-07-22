
ALTER TABLE public.project_stages
  ADD COLUMN IF NOT EXISTS phase_name TEXT,
  ADD COLUMN IF NOT EXISTS phase_order INT NOT NULL DEFAULT 1;

DROP TRIGGER IF EXISTS trg_seed_project_stages ON public.projects;
DROP FUNCTION IF EXISTS public.seed_project_stages() CASCADE;

CREATE TABLE IF NOT EXISTS public.stage_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stage_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.stage_templates(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  phase_order INT NOT NULL,
  stage_name TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  stage_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_template_items_template ON public.stage_template_items(template_id, stage_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_templates TO authenticated;
GRANT ALL ON public.stage_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_template_items TO authenticated;
GRANT ALL ON public.stage_template_items TO service_role;

ALTER TABLE public.stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates readable" ON public.stage_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates admin insert" ON public.stage_templates
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "templates admin update" ON public.stage_templates
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "templates admin delete" ON public.stage_templates
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "template items readable" ON public.stage_template_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "template items admin insert" ON public.stage_template_items
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "template items admin update" ON public.stage_template_items
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "template items admin delete" ON public.stage_template_items
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_stage_templates_updated
  BEFORE UPDATE ON public.stage_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE
  t_res UUID; t_com UUID; t_ren UUID; t_oth UUID;
BEGIN
  INSERT INTO public.stage_templates (name, category, is_default) VALUES ('Residential Construction','residential',true) RETURNING id INTO t_res;
  INSERT INTO public.stage_templates (name, category, is_default) VALUES ('Commercial','commercial',true) RETURNING id INTO t_com;
  INSERT INTO public.stage_templates (name, category, is_default) VALUES ('Renovation','renovation',true) RETURNING id INTO t_ren;
  INSERT INTO public.stage_templates (name, category, is_default) VALUES ('Other / Custom','other',true) RETURNING id INTO t_oth;

  INSERT INTO public.stage_template_items (template_id, phase_name, phase_order, stage_name, stage_key, stage_order)
  SELECT t_res, ph, po, sn, lower(regexp_replace(sn,'\W+','_','g')), (row_number() OVER ())::int
  FROM (VALUES
    ('Design & Planning',1,'Architectural designs'),
    ('Design & Planning',1,'Structural plan'),
    ('Design & Planning',1,'Approvals and permits'),
    ('Design & Planning',1,'Site preparation'),
    ('Construction',2,'Excavation & foundation work'),
    ('Construction',2,'Basement work'),
    ('Construction',2,'Structural work'),
    ('Construction',2,'Brickwork / Blockwork'),
    ('Construction',2,'Electrical'),
    ('Construction',2,'Plumbing'),
    ('Construction',2,'HVAC'),
    ('Construction',2,'Roofing & waterproofing'),
    ('Finishing',3,'Windows & Doors'),
    ('Finishing',3,'Interior plastering'),
    ('Finishing',3,'Exterior plastering'),
    ('Finishing',3,'Painting'),
    ('Finishing',3,'Tiling / Flooring'),
    ('Finishing',3,'Final carpentry'),
    ('Finishing',3,'Cleaning'),
    ('Finishing',3,'Landscaping'),
    ('Finishing',3,'Final Inspection'),
    ('Finishing',3,'Handover')
  ) AS v(ph,po,sn);

  INSERT INTO public.stage_template_items (template_id, phase_name, phase_order, stage_name, stage_key, stage_order)
  SELECT t_com, ph, po, sn, lower(regexp_replace(sn,'\W+','_','g')), (row_number() OVER ())::int
  FROM (VALUES
    ('Planning',1,'Feasibility study'),
    ('Planning',1,'Budgeting'),
    ('Planning',1,'Site Analysis'),
    ('Planning',1,'Preliminary drawings'),
    ('Planning',1,'Approval process'),
    ('Designing',2,'Architectural modeling'),
    ('Designing',2,'Structural drawings'),
    ('Designing',2,'MEP drawings'),
    ('Designing',2,'Final design approval'),
    ('Construction',3,'Site preparation'),
    ('Construction',3,'Foundation work'),
    ('Construction',3,'Structural work'),
    ('Construction',3,'Slab preparation'),
    ('Construction',3,'Framing'),
    ('Construction',3,'Installation'),
    ('Finishing',4,'Interior work'),
    ('Finishing',4,'Final Inspection'),
    ('Finishing',4,'Handover')
  ) AS v(ph,po,sn);

  INSERT INTO public.stage_template_items (template_id, phase_name, phase_order, stage_name, stage_key, stage_order)
  SELECT t_ren, ph, po, sn, lower(regexp_replace(sn,'\W+','_','g')), (row_number() OVER ())::int
  FROM (VALUES
    ('Designing & Planning',1,'Scope of work confirmation'),
    ('Designing & Planning',1,'Material selection'),
    ('Designing & Planning',1,'Architectural designs'),
    ('Designing & Planning',1,'Structural plan'),
    ('Designing & Planning',1,'Obtaining permits'),
    ('Construction',2,'Demolition'),
    ('Construction',2,'Structural changes'),
    ('Construction',2,'Masonry & waterproofing work'),
    ('Construction',2,'Electrical work'),
    ('Construction',2,'Plumbing work'),
    ('Construction',2,'HVAC'),
    ('Construction',2,'Painting work'),
    ('Construction',2,'Flooring'),
    ('Finishing',3,'Interior works'),
    ('Finishing',3,'Final Inspection'),
    ('Finishing',3,'Handover')
  ) AS v(ph,po,sn);

  INSERT INTO public.stage_template_items (template_id, phase_name, phase_order, stage_name, stage_key, stage_order)
  VALUES (t_oth,'Custom',1,'New stage','new_stage',1);
END $$;
