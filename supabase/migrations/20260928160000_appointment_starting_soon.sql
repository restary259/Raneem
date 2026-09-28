-- Appointment "starting soon" alert (15-minute, time-sensitive push).
--
-- The appointment reminder pipeline (sync_appointment_reminders -> the
-- send-appointment-reminders edge worker -> emit_notification -> the
-- notifications -> push_notifications queue -> push-dispatch -> Web Push) is
-- extended, NOT duplicated. Three focused changes:
--
--   1. A new `t_15m` reminder window alongside the existing 24h / 1h rows.
--   2. Per-channel delivery stamps so the push leg and the email leg are
--      tracked independently (a failed email can no longer cause the working
--      push to be re-sent on the next cron tick).
--   3. `emit_notification` learns an optional `_priority`, so the 15-minute
--      alert can land as `time_sensitive` instead of the generic `medium`.
--
-- MANUAL DEPLOY: apply via `supabase db push` or the dashboard SQL editor.
-- The Vercel build and CI do not run DDL.

-- ---------------------------------------------------------------------------
-- 1. Accept the new reminder kind and record each delivery channel separately.
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointment_reminders
  DROP CONSTRAINT IF EXISTS appointment_reminders_kind_check;
ALTER TABLE public.appointment_reminders
  ADD CONSTRAINT appointment_reminders_kind_check
  CHECK (kind IN ('t_24h', 't_1h', 't_15m'));

-- NULL means "not delivered on that channel yet". `sent_at` is retained as the
-- coarse "fully processed" marker for backward compatibility with any older
-- reader, and is still stamped after the worker finishes the row.
ALTER TABLE public.appointment_reminders
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- Existing rows were delivered under the old single-stamp model; treat them as
-- already handled on both channels so the worker never re-sends history.
UPDATE public.appointment_reminders
   SET push_sent_at = COALESCE(push_sent_at, sent_at),
       email_sent_at = COALESCE(email_sent_at, sent_at)
 WHERE sent_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Rebuild the reminder rows: 24h (normal) / 1h (important) / 15m
--    (time-sensitive). Re-issued verbatim from 20260926093118 (the live
--    definition) with only the t_15m window added.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_appointment_reminders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.appointment_reminders WHERE appointment_id=NEW.id AND sent_at IS NULL;
  IF NEW.team_member_id IS NULL OR NEW.scheduled_at IS NULL OR NEW.outcome IS NOT NULL OR NEW.rescheduled_to IS NOT NULL OR (NEW.public_booking AND NEW.confirmation_status <> 'confirmed') THEN RETURN NEW; END IF;
  IF NEW.scheduled_at - interval '24 hours' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_24h',NEW.scheduled_at - interval '24 hours') ON CONFLICT DO NOTHING; END IF;
  IF NEW.scheduled_at - interval '1 hour' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_1h',NEW.scheduled_at - interval '1 hour') ON CONFLICT DO NOTHING; END IF;
  IF NEW.scheduled_at - interval '15 minutes' > now() THEN INSERT INTO public.appointment_reminders (appointment_id,recipient_id,kind,due_at) VALUES(NEW.id,NEW.team_member_id,'t_15m',NEW.scheduled_at - interval '15 minutes') ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 3. A priority-aware emit_notification that REPLACES the 10-argument function.
--    It is deliberately NOT added as an overload. An 11-argument signature
--    contains every argument of the 10-argument one plus a trailing default, so
--    a 10-argument call matches BOTH candidates and PostgreSQL raises
--    `function public.emit_notification(...) is not unique` (PostgREST
--    PGRST203). That would break every existing caller: trg_notify_case_event
--    alone calls it 9 times on every case event, plus the WhatsApp-inbound and
--    recruit_application triggers. Both old signatures are therefore DROPPED
--    first, leaving exactly ONE function; 7/8/9/10-argument calls still resolve
--    against it via the trailing defaults. This mirrors
--    20260820170000_cash_collection_workflow.sql, which drops both
--    confirm_agency_service_payment signatures for the same reason — and it
--    means re-running this migration also HEALS a database that already applied
--    the overload version.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.emit_notification(uuid, uuid, text, text, text, text, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.emit_notification(uuid, uuid, text, text, text, text, text, uuid, text, text, text);

CREATE FUNCTION public.emit_notification(
  _user_id uuid,
  _actor_id uuid,
  _source text,
  _title_en text,
  _title_ar text,
  _body_en text,
  _body_ar text,
  _case_id uuid DEFAULT NULL,
  _link text DEFAULT NULL,
  _dedupe_key text DEFAULT NULL,
  _priority text DEFAULT 'medium'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (user_id, title, body, source, priority, title_en, title_ar, body_en, body_ar, case_id, link, dedupe_key)
  VALUES
    (_user_id, _title_en, _body_en, _source, COALESCE(_priority, 'medium'),
     _title_en, _title_ar, _body_en, _body_ar, _case_id, _link, _dedupe_key)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_notification(uuid, uuid, text, text, text, text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_notification(uuid, uuid, text, text, text, text, text, uuid, text, text, text) TO service_role;

-- Verification (read-only): the 15m kind is accepted, both channel stamps
-- exist, and emit_notification exists as a SINGLE 11-argument function (not an
-- overload — two rows here would mean the ambiguous state has returned).
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'public.appointment_reminders'::regclass AND conname LIKE '%kind%';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'appointment_reminders'
--      AND column_name IN ('push_sent_at','email_sent_at');
--   SELECT proname, pronargs FROM pg_proc
--    WHERE proname = 'emit_notification';  -- expect exactly one row, pronargs = 11
