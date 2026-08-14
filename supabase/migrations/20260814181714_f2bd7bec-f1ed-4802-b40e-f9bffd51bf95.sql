-- ════════════════════════════════════════════════════════════════════════
-- Agent recruit links — mirror the master-partner recruit-link machinery so
-- an Agent can share a /join/AG-XXXX link, collect recruit applications, and
-- have approved recruits linked via profiles.agent_id at activation.
--
-- The whole flow reuses the existing partner_recruit_applications table +
-- submit_recruit_application + approve-partner-recruit edge function, so the
-- admin review UI, identity-conflict checks, and durable-invitation pattern
-- stay single-source. The only additions are:
--   1. partner_recruit_applications.agent_id (nullable) — the recruiting
--      agent, set from the recruit link's owner when the application is
--      submitted. NULL for the legacy master-partner flow (unchanged).
--   2. ensure_agent_recruit_link() — mints an AG-XXXX code in partner_links.
--   3. resolve_recruit_code() — extended to ALSO match agent recruiters
--      (returned recruiter_name is the agent's full_name; the page already
--      only uses it as a display string, so no contract change).
--   4. submit_recruit_application() — resolves the recruiter as EITHER a
--      master partner (master_partner_id set, agent_id NULL) OR an agent
--      (agent_id set, master_partner_id NULL), never both.
--   5. approve-partner-recruit edge function passes agentId to createInvitation
--      when the application carries an agent_id (separate code change).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Carry agent attribution through the application ──────────────────────
ALTER TABLE public.partner_recruit_applications
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partner_recruit_applications_agent
  ON public.partner_recruit_applications(agent_id);

-- An agent-sourced application has no master partner, so the legacy NOT NULL
-- on master_partner_id must be relaxed (exactly one of the two is set).
ALTER TABLE public.partner_recruit_applications
  ALTER COLUMN master_partner_id DROP NOT NULL;

-- 2. ensure_agent_recruit_link() — mint/return the agent's recruit link ───
CREATE OR REPLACE FUNCTION public.ensure_agent_recruit_link()
RETURNS TABLE(code text, target_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_code text;
  i int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = v_me AND ur.role = 'agent'
  ) THEN
    RAISE EXCEPTION 'Only agents have recruit links';
  END IF;

  SELECT pl.code INTO v_code
  FROM public.partner_links pl
  WHERE pl.partner_id = v_me AND pl.purpose = 'recruit' AND pl.active = true
    AND pl.code LIKE 'AG-%'
  LIMIT 1;

  IF v_code IS NULL THEN
    LOOP
      v_code := 'AG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.partner_links pl2 WHERE lower(pl2.code) = lower(v_code));
      i := i + 1;
      IF i > 30 THEN
        v_code := 'AG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.partner_links (partner_id, code, label, target_path, purpose, active)
    VALUES (v_me, v_code, 'Agent recruit link', '/join/' || v_code, 'recruit', true);
  END IF;

  RETURN QUERY SELECT v_code, '/join/' || v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_agent_recruit_link() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_agent_recruit_link() TO authenticated;

-- 3. resolve_recruit_code() — also match agent recruiters ──────────────────
-- The recruiter display name now resolves for either a master partner or an
-- agent owning the code. The page only uses recruiter_name for display, so
-- extending the match is contract-compatible.
CREATE OR REPLACE FUNCTION public.resolve_recruit_code(p_code text)
RETURNS TABLE(valid boolean, recruiter_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Master-partner recruiter (legacy MP- codes) OR agent recruiter (AG- codes)
  (
    SELECT true, pr.full_name
    FROM public.partner_links pl
    JOIN public.profiles pr ON pr.id = pl.partner_id
    WHERE lower(pl.code) = lower(btrim(p_code))
      AND pl.active = true
      AND pl.purpose = 'recruit'
      AND pr.is_master_partner = true
      AND pr.deleted_at IS NULL
    LIMIT 1
  )
  UNION ALL
  (
    SELECT true, pr.full_name
    FROM public.partner_links pl
    JOIN public.profiles pr ON pr.id = pl.partner_id
    JOIN public.user_roles ur ON ur.user_id = pr.id
    WHERE lower(pl.code) = lower(btrim(p_code))
      AND pl.active = true
      AND pl.purpose = 'recruit'
      AND ur.role = 'agent'
      AND pr.deleted_at IS NULL
    LIMIT 1
  )
$$;

GRANT EXECUTE ON FUNCTION public.resolve_recruit_code(text) TO anon, authenticated;

-- 4. submit_recruit_application() — resolve master OR agent recruiter ─────
CREATE OR REPLACE FUNCTION public.submit_recruit_application(
  p_code text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text DEFAULT NULL,
  p_social_link text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master uuid;
  v_agent uuid;
  v_id uuid;
BEGIN
  -- Master-partner recruiter?
  SELECT pl.partner_id INTO v_master
  FROM public.partner_links pl
  JOIN public.profiles pr ON pr.id = pl.partner_id
  WHERE lower(pl.code) = lower(btrim(p_code))
    AND pl.active = true AND pl.purpose = 'recruit'
    AND pr.is_master_partner = true AND pr.deleted_at IS NULL
  LIMIT 1;

  -- Agent recruiter?
  IF v_master IS NULL THEN
    SELECT pl.partner_id INTO v_agent
    FROM public.partner_links pl
    JOIN public.profiles pr ON pr.id = pl.partner_id
    JOIN public.user_roles ur ON ur.user_id = pr.id
    WHERE lower(pl.code) = lower(btrim(p_code))
      AND pl.active = true AND pl.purpose = 'recruit'
      AND ur.role = 'agent' AND pr.deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_master IS NULL AND v_agent IS NULL THEN
    RAISE EXCEPTION 'Invalid recruit link';
  END IF;

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
    (recruit_code, master_partner_id, agent_id, full_name, email, phone, city, social_link, note)
  VALUES
    (upper(btrim(p_code)), v_master, v_agent,
     left(btrim(p_full_name), 100), lower(btrim(p_email)),
     left(btrim(p_phone), 30), left(btrim(p_city), 80),
     left(btrim(p_social_link), 300), left(btrim(p_note), 1000))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_recruit_application(text, text, text, text, text, text, text) TO anon, authenticated;