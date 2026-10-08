ALTER TABLE public.projects
 ADD COLUMN IF NOT EXISTS video_path text,
 ADD COLUMN IF NOT EXISTS video_name text,
 ADD COLUMN IF NOT EXISTS video_size bigint,
 ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS error_message text,
 ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'upload',
 ADD COLUMN IF NOT EXISTS source_url text;
GRANT INSERT ON public.projects TO authenticated;
GRANT UPDATE (video_path, video_name, video_size, source_type, source_url, status, progress, error_message) ON public.projects TO authenticated;
CREATE POLICY projects_create_own ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND NOT suspended));
CREATE POLICY projects_update_own ON public.projects FOR UPDATE TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND NOT suspended)) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.clips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL,
 start_seconds numeric NOT NULL,
 end_seconds numeric NOT NULL,
 score integer NOT NULL DEFAULT 0,
 video_path text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clips TO authenticated;
GRANT ALL ON public.clips TO service_role;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY clips_read ON public.clips FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_owner());
CREATE INDEX clips_project_id_idx ON public.clips(project_id);
CREATE TABLE public.exports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 clip_id uuid NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 provider text NOT NULL DEFAULT 'shotstack',
 render_id text,
 status text NOT NULL DEFAULT 'queued',
 output_url text,
 output_path text,
 error_message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exports TO authenticated;
GRANT ALL ON public.exports TO service_role;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY exports_read ON public.exports FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_owner());
CREATE INDEX exports_project_id_idx ON public.exports(project_id);
ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
CREATE UNIQUE INDEX project_processing_reservation_once ON public.credit_ledger(project_id) WHERE kind IN ('project_processing', 'project_processing_unlimited');
CREATE UNIQUE INDEX project_processing_refund_once ON public.credit_ledger(project_id) WHERE kind = 'project_processing_refund';
CREATE FUNCTION public.reserve_project_processing(project_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; project public.projects; charge bigint := 5;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO project FROM public.projects WHERE id = project_id AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND OR project.video_path IS NULL THEN RAISE EXCEPTION 'Project unavailable'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
 IF NOT FOUND OR p.suspended THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 IF EXISTS (SELECT 1 FROM public.credit_ledger l WHERE l.project_id = project.id AND l.kind IN ('project_processing', 'project_processing_unlimited')) THEN RETURN false; END IF;
 IF p.unlimited_credits AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p.id AND role = 'owner_admin') THEN
  INSERT INTO public.credit_ledger(user_id, amount, kind, project_id) VALUES (p.id, 0, 'project_processing_unlimited', project.id);
 ELSE
  IF p.credit_balance IS NULL OR p.credit_balance < charge THEN RAISE EXCEPTION 'Créditos insuficientes'; END IF;
  UPDATE public.profiles SET credit_balance = credit_balance - charge WHERE id = p.id;
  INSERT INTO public.credit_ledger(user_id, amount, kind, project_id) VALUES (p.id, -charge, 'project_processing', project.id);
 END IF;
 UPDATE public.projects SET status = 'queued', progress = 15, error_message = NULL WHERE id = project.id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_project_processing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_project_processing(uuid) TO authenticated;
CREATE FUNCTION public.refund_processing_for_project(target uuid, project_id uuid, amount bigint, reason text DEFAULT 'processing_start_failed') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE project public.projects; reserved bigint;
BEGIN
 SELECT * INTO project FROM public.projects WHERE id = project_id AND user_id = target FOR UPDATE;
 IF NOT FOUND OR project.status <> 'failed' THEN RETURN false; END IF;
 SELECT -l.amount INTO reserved FROM public.credit_ledger l WHERE l.project_id = project.id AND l.user_id = target AND l.kind = 'project_processing';
 IF reserved IS NULL OR reserved <= 0 OR reserved <> amount THEN RETURN false; END IF;
 IF EXISTS (SELECT 1 FROM public.credit_ledger l WHERE l.project_id = project.id AND l.kind = 'project_processing_refund') THEN RETURN false; END IF;
 UPDATE public.profiles SET credit_balance = credit_balance + reserved WHERE id = target AND NOT unlimited_credits;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.credit_ledger(user_id, amount, kind, project_id) VALUES (target, reserved, 'project_processing_refund', project.id);
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.refund_processing_for_project(uuid,uuid,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_processing_for_project(uuid,uuid,bigint,text) TO service_role;