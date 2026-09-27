ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_reassign_office_appointments boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_reassign_office_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.can_reassign_office_appointments := false; RETURN NEW; END IF;
  IF NEW.can_reassign_office_appointments IS DISTINCT FROM OLD.can_reassign_office_appointments THEN
    RAISE EXCEPTION 'Only admins can change can_reassign_office_appointments';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_reassign_office_flag ON public.profiles;
CREATE TRIGGER trg_guard_reassign_office_flag BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_reassign_office_flag();

CREATE OR REPLACE FUNCTION public.can_reassign_in_office(p_office_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND can_reassign_office_appointments AND deleted_at IS NULL)
    AND EXISTS (SELECT 1 FROM office_members WHERE office_id = p_office_id AND user_id = auth.uid() AND is_active)
  )
$$;

CREATE OR REPLACE FUNCTION public.list_office_members(p_office_id uuid)
RETURNS TABLE(id uuid, full_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_reassign_in_office(p_office_id) THEN RETURN; END IF;
  RETURN QUERY SELECT p.id, p.full_name FROM office_members m JOIN profiles p ON p.id = m.user_id
    WHERE m.office_id = p_office_id AND m.is_active AND p.deleted_at IS NULL ORDER BY p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.reassign_office_appointment(p_appointment_id uuid, p_new_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF a.office_id IS NULL THEN RAISE EXCEPTION 'Appointment has no office'; END IF;
  IF NOT public.can_reassign_in_office(a.office_id) THEN RAISE EXCEPTION 'Not allowed to reassign appointments in this office'; END IF;
  IF NOT EXISTS (SELECT 1 FROM office_members WHERE office_id = a.office_id AND user_id = p_new_member_id AND is_active) THEN
    RAISE EXCEPTION 'Target is not an active member of this office';
  END IF;
  UPDATE appointments SET team_member_id = p_new_member_id, updated_at = now() WHERE id = p_appointment_id;
END $$;

REVOKE ALL ON FUNCTION public.can_reassign_in_office(uuid), public.list_office_members(uuid), public.reassign_office_appointment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_reassign_in_office(uuid), public.list_office_members(uuid), public.reassign_office_appointment(uuid, uuid) TO authenticated;