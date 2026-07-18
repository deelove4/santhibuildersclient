-- ─────────────────────────────────────────────────────────────────
-- 1. Add external_url column to project_media (for demo / placeholder images)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.project_media
  ADD COLUMN IF NOT EXISTS external_url text;

-- ─────────────────────────────────────────────────────────────────
-- 2. Project Issues (Snag Tracker)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_issues (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key    text,
  title        text        NOT NULL,
  description  text,
  priority     text        NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  status       text        NOT NULL DEFAULT 'open',   -- open | in_progress | resolved | closed
  raised_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_issues ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_issues TO authenticated;
GRANT ALL ON public.project_issues TO service_role;

CREATE TRIGGER project_issues_updated_at
  BEFORE UPDATE ON public.project_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Members can read all issues; members can raise new ones; admin can update/delete
CREATE POLICY issues_select_member ON public.project_issues FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY issues_insert_member ON public.project_issues FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()));
CREATE POLICY issues_update_admin ON public.project_issues FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY issues_delete_admin ON public.project_issues FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER TABLE public.project_issues REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.project_issues;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 3. Project Budget (Budget vs Actual Tracker)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_budget (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid           NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key        text,
  category         text           NOT NULL DEFAULT 'materials', -- materials | labour | equipment | overhead
  description      text           NOT NULL,
  budgeted_amount  numeric(14,2)  NOT NULL DEFAULT 0,
  actual_amount    numeric(14,2)  NOT NULL DEFAULT 0,
  notes            text,
  created_at       timestamptz    NOT NULL DEFAULT now(),
  updated_at       timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE public.project_budget ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_budget TO authenticated;
GRANT ALL ON public.project_budget TO service_role;

CREATE TRIGGER project_budget_updated_at
  BEFORE UPDATE ON public.project_budget
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY budget_select_member ON public.project_budget FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY budget_all_admin ON public.project_budget FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER TABLE public.project_budget REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.project_budget;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Seed: demo client + demo project with rich dummy data
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  demo_client_id uuid := '00000000-0000-0000-0000-000000000002'::uuid;
  demo_project_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  admin_id uuid;
BEGIN
  -- Resolve admin user
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@santhibuilders.com';

  -- ── Demo client auth user ──────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_client_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', demo_client_id,
      'authenticated', 'authenticated',
      'rajesh.kumar@demo.com',
      crypt('demo@client123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Rajesh Kumar"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), demo_client_id,
      jsonb_build_object('sub', demo_client_id::text, 'email', 'rajesh.kumar@demo.com', 'email_verified', true),
      'email', demo_client_id::text, now(), now(), now()
    );
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (demo_client_id, 'rajesh.kumar@demo.com', 'Rajesh Kumar', '+91 98456 12340')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (demo_client_id, 'client')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ── Demo project ───────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = demo_project_id) THEN

    INSERT INTO public.projects (
      id, name, villa_number, address, client_id, project_type,
      area_sqft, start_date, expected_completion, status,
      overall_progress, current_stage_key, notes, created_by
    ) VALUES (
      demo_project_id,
      'Villa Prestige — Plot 12B',
      'V-12B',
      '12B Greenview Township, Whitefield, Bengaluru — 560066',
      demo_client_id,
      'Residential Villa',
      2800,
      '2025-11-01',
      '2026-10-31',
      'active',
      42,
      'brickwork',
      'Premium G+2 villa with modern architecture. Client requires Italian marble flooring for living areas and premium kitchen fittings.',
      admin_id
    );

    -- ── Stages ────────────────────────────────────────────────────
    INSERT INTO public.project_stages
      (project_id, stage_key, stage_name, stage_order, status, progress, notes, started_at, completed_at)
    VALUES
      (demo_project_id, 'site_prep',  'Site Preparation & Survey',   1,  'completed',   100, 'Completed. Soil test report attached.', now()-'180 days'::interval, now()-'150 days'::interval),
      (demo_project_id, 'foundation', 'Foundation & Excavation',      2,  'completed',   100, 'RCC footings done. Anti-termite treatment applied.', now()-'149 days'::interval, now()-'90 days'::interval),
      (demo_project_id, 'structural', 'RCC Structural Framework',     3,  'completed',   100, 'G+1 columns and beams complete.', now()-'89 days'::interval, now()-'40 days'::interval),
      (demo_project_id, 'brickwork',  'Masonry & Blockwork',          4,  'in_progress',  60, 'Ground floor walls done. First floor ongoing.', now()-'39 days'::interval, null),
      (demo_project_id, 'electrical', 'Electrical Rough-In',          5,  'in_progress',  20, 'Ground floor conduit work started.', now()-'10 days'::interval, null),
      (demo_project_id, 'plumbing',   'Plumbing Rough-In',            6,  'pending',       0, null, null, null),
      (demo_project_id, 'roofing',    'Roof Slab & Waterproofing',    7,  'pending',       0, null, null, null),
      (demo_project_id, 'interior',   'Interior Finishes',            8,  'pending',       0, null, null, null),
      (demo_project_id, 'painting',   'Painting & Polishing',         9,  'pending',       0, null, null, null),
      (demo_project_id, 'elevation',  'External Elevation',           10, 'pending',       0, null, null, null),
      (demo_project_id, 'inspection', 'Quality Inspection & Snagging',11, 'pending',       0, null, null, null),
      (demo_project_id, 'handover',   'Final Handover',               12, 'pending',       0, null, null, null);

    -- ── Chat messages ──────────────────────────────────────────────
    INSERT INTO public.messages (project_id, sender_id, body, created_at)
    VALUES
      (demo_project_id, admin_id,       'Welcome, Rajesh! Your villa project has officially kicked off. We''re excited to build your dream home. 🏠', now()-'60 days'::interval),
      (demo_project_id, demo_client_id, 'Thank you! I''m very excited. When can I expect the foundation work to be completed?',                       now()-'59 days'::interval),
      (demo_project_id, admin_id,       'Foundation is already wrapped up — ahead of schedule! We''re now into the RCC structural framework phase.',   now()-'40 days'::interval),
      (demo_project_id, demo_client_id, 'That''s brilliant news! Can I visit the site this Saturday to have a look?',                                 now()-'39 days'::interval),
      (demo_project_id, admin_id,       'Of course! Saturday at 10 AM works great. Please bring your ID and wear closed-toe shoes. Our site engineer will guide you.', now()-'38 days'::interval),
      (demo_project_id, demo_client_id, 'Perfect. Also wanted to confirm — are we still on track for the Italian marble flooring in the living room?', now()-'5 days'::interval),
      (demo_project_id, admin_id,       'Yes, confirmed! We''ve placed the order. Delivery is expected by the time we start interior finishes.',       now()-'4 days'::interval),
      (demo_project_id, demo_client_id, 'Excellent! Very happy with the progress so far. The team is doing a great job. 👍',                          now()-'3 days'::interval);

    -- ── Media (external Unsplash placeholder images) ───────────────
    INSERT INTO public.project_media
      (project_id, stage_key, storage_path, file_name, mime_type, media_type, caption, external_url, uploaded_by)
    VALUES
      (demo_project_id, 'site_prep',  'demo/site_aerial.jpg',        'site_aerial_view.jpg',     'image/jpeg', 'drone', 'Aerial view of plot before construction',        'https://images.unsplash.com/photo-1429497419816-9ca5cfb4571a?w=600&q=80', admin_id),
      (demo_project_id, 'foundation', 'demo/foundation_work.jpg',    'foundation_footing.jpg',   'image/jpeg', 'photo', 'RCC footing and PCC work in progress',           'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80', admin_id),
      (demo_project_id, 'structural', 'demo/structural_columns.jpg', 'rcc_columns_gf.jpg',       'image/jpeg', 'photo', 'RCC column casting — Ground floor',              'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&q=80', admin_id),
      (demo_project_id, 'structural', 'demo/structural_slab.jpg',    'first_floor_slab.jpg',     'image/jpeg', 'photo', 'First floor slab shuttering and pour',           'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80', admin_id),
      (demo_project_id, 'brickwork',  'demo/brickwork_gf.jpg',       'brickwork_ground_floor.jpg','image/jpeg','photo', 'Ground floor brick masonry complete',            'https://images.unsplash.com/photo-1590682680695-43b964a3ae17?w=600&q=80', admin_id),
      (demo_project_id, 'brickwork',  'demo/site_overview.jpg',      'site_overview_july.jpg',   'image/jpeg', 'drone', 'Drone overview — construction at 40% milestone', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', admin_id);

    -- ── Documents (metadata only — no real storage files) ──────────
    INSERT INTO public.project_documents
      (project_id, storage_path, file_name, mime_type, size_bytes, category, description)
    VALUES
      (demo_project_id, 'demo/contract_main.pdf',      'Main_Contract_Agreement.pdf',   'application/pdf', 204800, 'contract', 'Signed construction agreement between client and Santhi Builders'),
      (demo_project_id, 'demo/structural_drawing.pdf', 'Structural_Drawing_Rev2.pdf',   'application/pdf', 512000, 'drawing',  'Revised G+2 structural drawings — Rev 2.0'),
      (demo_project_id, 'demo/invoice_001.pdf',        'Invoice_001_Foundation.pdf',    'application/pdf', 102400, 'invoice',  'Foundation stage invoice — Stage 2'),
      (demo_project_id, 'demo/soil_test_report.pdf',   'Soil_Test_Report.pdf',          'application/pdf', 153600, 'approval', 'Geotechnical soil test and bore log report'),
      (demo_project_id, 'demo/building_permit.pdf',    'Building_Permit_Approval.pdf',  'application/pdf',  89600, 'approval', 'Municipal building plan sanction letter');

    -- ── Issues (Snag Tracker) ──────────────────────────────────────
    INSERT INTO public.project_issues
      (project_id, stage_key, title, description, priority, status, raised_by)
    VALUES
      (demo_project_id, 'structural', 'Column out of plumb at Grid C3',          'Column at Grid C3 is 12 mm out of plumb. Requires rectification before next slab pour.',  'high',     'in_progress', admin_id),
      (demo_project_id, 'brickwork',  'Mortar gap above window lintel',           'Gap visible above lintel on the south elevation — risk of water ingress if not sealed.',   'medium',   'open',        admin_id),
      (demo_project_id, 'site_prep',  'East boundary marker unclear',             'Boundary peg on the east side not clearly marked. Surveyor revisit required.',            'low',      'resolved',    admin_id),
      (demo_project_id, 'foundation', 'Waterproofing membrane undersize overlap', 'Membrane overlap on north side is only 80 mm; specification requires minimum 150 mm.',   'critical', 'resolved',    admin_id),
      (demo_project_id, 'brickwork',  'Client: extra power sockets in kitchen',   'Client requested two additional 15 A sockets on the kitchen south wall. Needs approval.', 'low',      'open',        demo_client_id);

    -- ── Budget entries ─────────────────────────────────────────────
    INSERT INTO public.project_budget
      (project_id, stage_key, category, description, budgeted_amount, actual_amount)
    VALUES
      (demo_project_id, 'site_prep',  'labour',    'Site clearing, levelling, and survey',           85000,   82000),
      (demo_project_id, 'site_prep',  'equipment', 'JCB hire — 3 days',                              45000,   48000),
      (demo_project_id, 'foundation', 'materials', 'Cement, sand, and aggregates',                  320000,  315000),
      (demo_project_id, 'foundation', 'labour',    'Excavation and PCC labour',                     140000,  138000),
      (demo_project_id, 'foundation', 'materials', 'TMT steel reinforcement bars',                  280000,  291000),
      (demo_project_id, 'structural', 'materials', 'RCC columns, beams, and slab materials',        550000,  542000),
      (demo_project_id, 'structural', 'labour',    'Shuttering, binding, and RCC labour',           180000,  185000),
      (demo_project_id, 'brickwork',  'materials', 'AAC blocks and mortar',                         220000,  205000),
      (demo_project_id, 'brickwork',  'labour',    'Masonry labour',                                120000,  110000),
      (demo_project_id, 'electrical', 'materials', 'Conduits and wiring (rough-in only)',            95000,   78000),
      (demo_project_id, 'plumbing',   'materials', 'CPVC pipes, fittings, and sanitary rough-in',  110000,       0),
      (demo_project_id, 'roofing',    'materials', 'Waterproofing membrane and terrace materials',  180000,       0),
      (demo_project_id, 'interior',   'materials', 'Italian marble flooring — living areas',        850000,       0),
      (demo_project_id, 'interior',   'labour',    'Tiling, plastering, and joinery labour',        280000,       0),
      (demo_project_id, 'painting',   'materials', 'Primer, putty, and premium emulsion',           120000,       0),
      (demo_project_id, 'elevation',  'materials', 'External texture and facade paint',              85000,       0);

  END IF; -- end IF project not exists
END $$;
