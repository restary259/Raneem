-- Per-team-member access control for the shared WhatsApp inbox.
-- Default is OFF. Admins manage the flag from Admin > Members > Team.
-- Team members without access continue to use the case-profile WhatsApp action,
-- which opens the case's attached number in the normal WhatsApp route.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_inbox_enabled boolean NOT NULL DEFAULT false;

-- Shared policy helper. Admins always have access; team members need the flag.
CREATE OR REPLACE FUNCTION public.has_whatsapp_inbox_access(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(p_user, 'admin'::app_role)
    OR (
      has_role(p_user, 'team_member'::app_role)
      AND COALESCE(
        (SELECT p.whatsapp_inbox_enabled
           FROM public.profiles p
          WHERE p.id = p_user
            AND p.deleted_at IS NULL),
        false
      )
    )
$$;

REVOKE ALL ON FUNCTION public.has_whatsapp_inbox_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_whatsapp_inbox_access(uuid) TO authenticated, service_role;

-- Keep the existing strict profile-write guard and add the new flag to the
-- admin-only protected fields.
CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_jwt_role text;
BEGIN
  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN
    v_jwt_role := NULL;
  END;

  IF public.has_role(auth.uid(), 'admin')
     OR v_jwt_role = 'service_role'
     OR session_user IN ('service_role', 'postgres', 'supabase_admin')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.commission_amount := 0;
    NEW.student_status := 'not_applied';
    NEW.visa_status := 'not_applied';
    NEW.must_change_password := false;
    NEW.case_id := NULL;
    NEW.linked_case_id := NULL;
    NEW.deleted_at := NULL;
    NEW.iban_confirmed_at := NULL;
    NEW.is_manager := false;
    NEW.referral_code_enabled := false;
    NEW.apply_form_enabled := false;
    NEW.whatsapp_inbox_enabled := false;
    NEW.deactivated_by := NULL;
    NEW.deactivated_reason := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.commission_amount IS DISTINCT FROM OLD.commission_amount THEN
      RAISE EXCEPTION 'Non-admin users cannot change commission_amount';
    END IF;
    IF NEW.student_status IS DISTINCT FROM OLD.student_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change student_status';
    END IF;
    IF NEW.visa_status IS DISTINCT FROM OLD.visa_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change visa_status';
    END IF;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      RAISE EXCEPTION 'Non-admin users cannot change must_change_password';
    END IF;
    IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change case_id';
    END IF;
    IF NEW.linked_case_id IS DISTINCT FROM OLD.linked_case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change linked_case_id';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change deleted_at';
    END IF;
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code';
    END IF;
    IF NEW.referral_code_enabled IS DISTINCT FROM OLD.referral_code_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code_enabled';
    END IF;
    IF NEW.apply_form_enabled IS DISTINCT FROM OLD.apply_form_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change apply_form_enabled';
    END IF;
    IF NEW.whatsapp_inbox_enabled IS DISTINCT FROM OLD.whatsapp_inbox_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change whatsapp_inbox_enabled';
    END IF;
    IF NEW.is_manager IS DISTINCT FROM OLD.is_manager THEN
      RAISE EXCEPTION 'Non-admin users cannot change is_manager';
    END IF;
    IF NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
       OR NEW.deactivated_reason IS DISTINCT FROM OLD.deactivated_reason THEN
      RAISE EXCEPTION 'Non-admin users cannot change account deactivation fields';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Non-admin users cannot change the profile id';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Non-admin users cannot change email';
    END IF;
    IF NEW.iban_confirmed_at IS DISTINCT FROM OLD.iban_confirmed_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change iban_confirmed_at';
    END IF;
    IF OLD.iban_confirmed_at IS NOT NULL AND (
         NEW.iban IS DISTINCT FROM OLD.iban
      OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
      OR NEW.bank_branch IS DISTINCT FROM OLD.bank_branch
      OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    ) THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- The generic WhatsApp staff guard is now capability-aware.
CREATE OR REPLACE FUNCTION public.is_whatsapp_staff(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_whatsapp_inbox_access(p_user)
$$;

REVOKE ALL ON FUNCTION public.is_whatsapp_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_whatsapp_staff(uuid) TO service_role;

-- Team members without the inbox feature must not gain access by calling
-- table APIs directly. Admin policies remain unchanged.
DROP POLICY IF EXISTS "Team read own or unassigned WhatsApp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Team read own or unassigned WhatsApp conversations"
ON public.whatsapp_conversations
FOR SELECT TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

DROP POLICY IF EXISTS "Team update own or unassigned WhatsApp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Team update own or unassigned WhatsApp conversations"
ON public.whatsapp_conversations
FOR UPDATE TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
)
WITH CHECK (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

DROP POLICY IF EXISTS "Team read WhatsApp leads for visible conversations" ON public.whatsapp_leads;
CREATE POLICY "Team read WhatsApp leads for visible conversations"
ON public.whatsapp_leads
FOR SELECT TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.lead_id = whatsapp_leads.id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Team update WhatsApp lead fields for visible conversations" ON public.whatsapp_leads;
CREATE POLICY "Team update WhatsApp lead fields for visible conversations"
ON public.whatsapp_leads
FOR UPDATE TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.lead_id = whatsapp_leads.id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
)
WITH CHECK (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.lead_id = whatsapp_leads.id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Team read WhatsApp messages for visible conversations" ON public.whatsapp_messages;
CREATE POLICY "Team read WhatsApp messages for visible conversations"
ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Team read WhatsApp internal notes for visible conversations" ON public.whatsapp_internal_notes;
CREATE POLICY "Team read WhatsApp internal notes for visible conversations"
ON public.whatsapp_internal_notes
FOR SELECT TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_internal_notes.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Team insert own WhatsApp internal notes" ON public.whatsapp_internal_notes;
CREATE POLICY "Team insert own WhatsApp internal notes"
ON public.whatsapp_internal_notes
FOR INSERT TO authenticated
WITH CHECK (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_internal_notes.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Team read WhatsApp audit events for visible conversations" ON public.whatsapp_events;
CREATE POLICY "Team read WhatsApp audit events for visible conversations"
ON public.whatsapp_events
FOR SELECT TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_events.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Team read released WhatsApp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Staff read WhatsApp templates" ON public.whatsapp_templates;
CREATE POLICY "Team read released WhatsApp templates"
ON public.whatsapp_templates
FOR SELECT TO authenticated
USING (
  public.has_whatsapp_inbox_access(auth.uid())
  AND public.has_role(auth.uid(), 'team_member'::app_role)
  AND approval_status = 'APPROVED'
  AND is_active = true
  AND available_to_team = true
);

-- Case search is an inbox feature; keep it available to admins and explicitly
-- enabled team members only.
CREATE OR REPLACE FUNCTION public.whatsapp_search_cases(p_query text)
RETURNS TABLE(id uuid, case_reference text, full_name text, status text, phone_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT c.id, c.case_reference, c.full_name, c.status, c.phone_number
  FROM public.cases c
  WHERE c.deleted_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (
        public.has_whatsapp_inbox_access(auth.uid())
        AND public.has_role(auth.uid(), 'team_member'::app_role)
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
      )
    )
    AND (
      coalesce(p_query, '') = ''
      OR c.case_reference ILIKE '%' || p_query || '%'
      OR c.full_name ILIKE '%' || p_query || '%'
      OR regexp_replace(coalesce(c.phone_number, ''), '\D', '', 'g')
          LIKE '%' || regexp_replace(coalesce(p_query, ''), '\D', '', 'g') || '%'
    )
  ORDER BY c.last_activity_at DESC NULLS LAST
  LIMIT 8
$function$;

REVOKE ALL ON FUNCTION public.whatsapp_search_cases(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_search_cases(text) TO authenticated;

