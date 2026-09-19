CREATE TABLE public.whatsapp_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL DEFAULT '',
  whatsapp_number text NOT NULL,
  country text,
  target_country text,
  desired_program text,
  budget_range text,
  intended_start_date date,
  language_level text,
  assigned_advisor uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'whatsapp',
  consent_status text NOT NULL DEFAULT 'unknown' CHECK (consent_status IN ('unknown','granted','declined','withdrawn')),
  lead_stage text NOT NULL DEFAULT 'new' CHECK (lead_stage IN ('new','qualified','consultation_booked','documents_pending','application_in_progress','won','lost')),
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (whatsapp_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_leads TO authenticated;
GRANT ALL ON public.whatsapp_leads TO service_role;
ALTER TABLE public.whatsapp_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage WhatsApp leads" ON public.whatsapp_leads FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.whatsapp_leads(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'new' CHECK (state IN ('new','open','waiting','resolved')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  human_takeover boolean NOT NULL DEFAULT true,
  takeover_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  takeover_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  first_response_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage WhatsApp conversations" ON public.whatsapp_conversations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  provider_message_id text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','template','system')),
  body text NOT NULL,
  template_name text,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','accepted','sent','delivered','read','failed','received')),
  error_status integer,
  error_message text,
  authored_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage WhatsApp messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));

CREATE TABLE public.whatsapp_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_internal_notes TO authenticated;
GRANT ALL ON public.whatsapp_internal_notes TO service_role;
ALTER TABLE public.whatsapp_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage WhatsApp internal notes" ON public.whatsapp_internal_notes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')) WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')) AND author_id = auth.uid());

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN ('inquiry_follow_up','consultation_confirmation','document_reminder','application_update')),
  provider_name text NOT NULL,
  language_code text NOT NULL,
  category text NOT NULL CHECK (category IN ('UTILITY','MARKETING','AUTHENTICATION')),
  approval_status text NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('APPROVED','PENDING','REJECTED','PAUSED','DISABLED')),
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_name, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage WhatsApp templates" ON public.whatsapp_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));

CREATE TABLE public.whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_events TO authenticated;
GRANT ALL ON public.whatsapp_events TO service_role;
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read WhatsApp audit events" ON public.whatsapp_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member'));

CREATE INDEX whatsapp_leads_stage_idx ON public.whatsapp_leads(lead_stage);
CREATE INDEX whatsapp_leads_owner_idx ON public.whatsapp_leads(assigned_advisor);
CREATE INDEX whatsapp_conversations_state_idx ON public.whatsapp_conversations(state, updated_at DESC);
CREATE INDEX whatsapp_conversations_owner_idx ON public.whatsapp_conversations(assigned_to);
CREATE INDEX whatsapp_messages_conversation_idx ON public.whatsapp_messages(conversation_id, created_at);
CREATE INDEX whatsapp_notes_conversation_idx ON public.whatsapp_internal_notes(conversation_id, created_at DESC);
CREATE INDEX whatsapp_events_conversation_idx ON public.whatsapp_events(conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_whatsapp_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER touch_whatsapp_leads BEFORE UPDATE ON public.whatsapp_leads FOR EACH ROW EXECUTE FUNCTION public.touch_whatsapp_updated_at();
CREATE TRIGGER touch_whatsapp_conversations BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_whatsapp_updated_at();
CREATE TRIGGER touch_whatsapp_notes BEFORE UPDATE ON public.whatsapp_internal_notes FOR EACH ROW EXECUTE FUNCTION public.touch_whatsapp_updated_at();
CREATE TRIGGER touch_whatsapp_templates BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.touch_whatsapp_updated_at();

CREATE OR REPLACE FUNCTION public.audit_whatsapp_conversation_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.whatsapp_events(conversation_id, actor_id, event_type, details) VALUES (NEW.id, auth.uid(), 'conversation_created', jsonb_build_object('state', NEW.state));
  ELSE
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN INSERT INTO public.whatsapp_events(conversation_id, actor_id, event_type, details) VALUES (NEW.id, auth.uid(), 'assignment_changed', jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to)); END IF;
    IF OLD.state IS DISTINCT FROM NEW.state THEN INSERT INTO public.whatsapp_events(conversation_id, actor_id, event_type, details) VALUES (NEW.id, auth.uid(), 'state_changed', jsonb_build_object('from', OLD.state, 'to', NEW.state)); END IF;
    IF OLD.human_takeover IS DISTINCT FROM NEW.human_takeover THEN INSERT INTO public.whatsapp_events(conversation_id, actor_id, event_type, details) VALUES (NEW.id, auth.uid(), CASE WHEN NEW.human_takeover THEN 'human_takeover_enabled' ELSE 'human_takeover_released' END, '{}'::jsonb); END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.audit_whatsapp_conversation_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_whatsapp_conversation_change() TO service_role;
CREATE TRIGGER audit_whatsapp_conversation AFTER INSERT OR UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.audit_whatsapp_conversation_change();

CREATE OR REPLACE FUNCTION public.get_whatsapp_staff_directory() RETURNS TABLE(id uuid, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, COALESCE(NULLIF(p.full_name,''), p.email, 'Staff') FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id WHERE ur.role IN ('admin','team_member') AND p.deleted_at IS NULL ORDER BY p.full_name NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.get_whatsapp_staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_staff_directory() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_whatsapp_dashboard() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_member')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'new_leads', (SELECT count(*) FROM public.whatsapp_leads WHERE lead_stage='new' AND created_at >= date_trunc('day', now())),
    'unassigned', (SELECT count(*) FROM public.whatsapp_conversations WHERE assigned_to IS NULL AND state <> 'resolved'),
    'median_first_response_seconds', (SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (first_response_at-created_at))),0) FROM public.whatsapp_conversations WHERE first_response_at IS NOT NULL),
    'by_stage', (SELECT COALESCE(jsonb_object_agg(lead_stage, total),'{}'::jsonb) FROM (SELECT lead_stage, count(*) total FROM public.whatsapp_leads GROUP BY lead_stage) s)
  ) INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_whatsapp_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_dashboard() TO authenticated, service_role;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;