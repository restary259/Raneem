-- ════════════════════════════════════════════════════════════════════════
-- Agent network fixes — trigger fix, intended_role, ambassador recruit
-- link, pending-applications visibility, and master_partner_id removal
-- from recruit functions.
--
-- Execution order within this migration matters:
--   A. Trigger fix (unblocks all INSERTs into partner_recruit_applications)
--   B. intended_role column on partner_recruit_applications
--   C. target_role column on partner_links
--   D. RLS + RPC for agent pending applications
--   E. ensure_agent_recruit_link replacement (returns 2 links)
--   F. resolve_recruit_code replacement (drops master branch, returns target_role)
--   G. submit_recruit_application replacement (agent-only, stores intended_role)
-- ════════════════════════════════════════════════════════════════════════

-- ── A. Fix notify_recruit_application trigger ───────────────────────────
-- The original trigger referenced NEW.master_partner_id which is now dropped.
-- Notify the recruiting agent instead of the (obsolete) master partner.

CREATE OR REPLACE FUNCTION public.notify_recruit_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
BEGIN
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.emit_notification(
      v_admin, NULL, 'recruit_application',
      'New partner application', 'طلب شراكة جديد',
      COALESCE(NEW.full_name, ''), COALESCE(NEW.full_name, ''), NULL, '/admin/team', NULL);
  END LOOP;

  IF NEW.agent_id IS NOT NULL THEN
    PERFORM public.emit_notification(
      NEW.agent_id, NULL, 'recruit_application',
      'Someone applied through your link', 'قدّم شخص عبر رابطك',
      COALESCE(NEW.full_name, ''), COALESCE(NEW.full_name, ''), NULL, '/agent/network', NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_recruit_application ON public.partner_recruit_applications;
CREATE TRIGGER trg_notify_recruit_application
AFTER INSERT ON public.partner_recruit_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_recruit_application();


-- ── B. Add intended_role to partner_recruit_applications ────────────────
-- Stores which role the recruit intends to fill, determined by the link
-- they used (partner recruit link → social_media_partner, ambassador
-- recruit link → ambassador).

ALTER TABLE public.partner_recruit_applications
  ADD COLUMN IF NOT EXISTS intended_role text
    DEFAULT 'social_media_partner'
    CHECK (intended_role IN ('social_media_partner', 'ambassador'));


-- ── C. Add target_role to partner_links ─────────────────────────────────
-- Distinguishes partner vs ambassador recruit links for the same agent.

ALTER TABLE public.partner_links
  ADD COLUMN IF NOT EXISTS target_role text;


-- ── D. Agent pending applications visibility ────────────────────────────
-- RLS: agents can read their own recruit applications.
-- RPC: get_my_pending_applications() returns pending/approved apps.

DROP POLICY IF EXISTS "agent reads own recruit applications" ON public.partner_recruit_applications;
CREATE POLICY "agent reads own recruit applications"
  ON public.partner_recruit_applications
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_my_pending_applications()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone text,
  city text,
  social_link text,
  status text,
  intended_role text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.full_name, a.email, a.phone, a.city, a.social_link,
         a.status, a.intended_role, a.created_at
  FROM public.partner_recruit_applications a
  WHERE a.agent_id = auth.uid()
    AND a.status IN ('pending', 'approved')
  ORDER BY a.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_applications() TO authenticated;


-- ── E. ensure_agent_recruit_link — returns partner + ambassador links ───
-- Each agent gets up to TWO recruit links: one for partners and one for
-- ambassadors. Missing links are generated on-the-fly.

CREATE OR REPLACE FUNCTION public.ensure_agent_recruit_link()
RETURNS TABLE(code text, target_path text, target_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_roles text[] := ARRAY['social_media_partner', 'ambassador'];
  v_role text;
  v_code text;
  v_existing record;
  i int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = v_me AND ur.role = 'agent'
  ) THEN
    RAISE EXCEPTION 'Only agents have recruit links';
  END IF;

  -- Return existing links
  FOR v_existing IN
    SELECT pl.code AS c, pl.target_path AS tp, pl.target_role AS tr
    FROM public.partner_links pl
    WHERE pl.partner_id = v_me AND pl.purpose = 'recruit' AND pl.active = true
      AND pl.code LIKE 'AG-%'
  LOOP
    code := v_existing.c;
    target_path := v_existing.tp;
    target_role := v_existing.tr;
    RETURN NEXT;
  END LOOP;

  -- Generate missing links for each role
  FOREACH v_role IN ARRAY v_roles LOOP
    -- Skip if already exists
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.partner_links pl2
      WHERE pl2.partner_id = v_me AND pl2.purpose = 'recruit'
        AND pl2.active = true AND pl2.target_role = v_role
    );

    i := 0;
    LOOP
      v_code := 'AG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.partner_links pl3 WHERE lower(pl3.code) = lower(v_code));
      i := i + 1;
      IF i > 30 THEN
        v_code := 'AG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.partner_links (partner_id, code, label, target_path, purpose, target_role, active)
    VALUES (v_me, v_code,
            CASE WHEN v_role = 'ambassador' THEN 'Agent ambassador recruit link' ELSE 'Agent partner recruit link' END,
            '/join/' || v_code, 'recruit', v_role, true);

    code := v_code;
    target_path := '/join/' || v_code;
    target_role := v_role;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_agent_recruit_link() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_agent_recruit_link() TO authenticated;


-- ── F. resolve_recruit_code — agent-only, returns target_role ───────────
-- Master-partner branch removed. Returns the link's target_role so the
-- join page can pre-select the correct role.

CREATE OR REPLACE FUNCTION public.resolve_recruit_code(p_code text)
RETURNS TABLE(valid boolean, recruiter_name text, target_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, pr.full_name, pl.target_role
  FROM public.partner_links pl
  JOIN public.profiles pr ON pr.id = pl.partner_id
  JOIN public.user_roles ur ON ur.user_id = pr.id
  WHERE lower(pl.code) = lower(btrim(p_code))
    AND pl.active = true
    AND pl.purpose = 'recruit'
    AND ur.role = 'agent'
    AND pr.deleted_at IS NULL
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_recruit_code(text) TO anon, authenticated;


-- ── G. submit_recruit_application — agent-only, stores intended_role ────
-- Master-partner logic removed. Only resolves agent recruiters. The
-- intended_role is taken from the link's target_role (or an explicit
-- parameter override).

CREATE OR REPLACE FUNCTION public.submit_recruit_application(
  p_code text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text DEFAULT NULL,
  p_social_link text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_target_role text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid;
  v_link_role text;
  v_intended text;
  v_id uuid;
BEGIN
  -- Resolve the agent recruiter from the recruit link
  SELECT pl.partner_id, pl.target_role INTO v_agent, v_link_role
  FROM public.partner_links pl
  JOIN public.profiles pr ON pr.id = pl.partner_id
  JOIN public.user_roles ur ON ur.user_id = pr.id
  WHERE lower(pl.code) = lower(btrim(p_code))
    AND pl.active = true AND pl.purpose = 'recruit'
    AND ur.role = 'agent' AND pr.deleted_at IS NULL
  LIMIT 1;

  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Invalid recruit link';
  END IF;

  -- Determine intended role: explicit param > link's target_role > default partner
  v_intended := COALESCE(p_target_role, v_link_role, 'social_media_partner');

  IF btrim(COALESCE(p_full_name, '')) = '' OR btrim(COALESCE(p_email, '')) = ''
     OR btrim(COALESCE(p_phone, '')) = '' THEN
    RAISE EXCEPTION 'Name, email and phone are required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.partner_recruit_applications
    WHERE lower(email) = lower(btrim(p_email)) AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'An application with this email is already pending';
  END IF;

  INSERT INTO public.partner_recruit_applications
    (recruit_code, agent_id, intended_role, full_name, email, phone, city, social_link, note)
  VALUES
    (upper(btrim(p_code)), v_agent, v_intended,
     left(btrim(p_full_name), 100), lower(btrim(p_email)),
     left(btrim(p_phone), 30), left(btrim(p_city), 80),
     left(btrim(p_social_link), 300), left(btrim(p_note), 1000))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_recruit_application(text, text, text, text, text, text, text, text) TO anon, authenticated;
