-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cases_status            ON public.cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_partner_id        ON public.cases (partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_referred_by       ON public.cases (referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to       ON public.cases (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_student_user_id   ON public.cases (student_user_id) WHERE student_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_created_at        ON public.cases (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email          ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_documents_case_id       ON public.documents (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_student_id    ON public.documents (student_id);
CREATE INDEX IF NOT EXISTS idx_leads_source_id         ON public.leads (source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status            ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_appointments_case_id    ON public.appointments (case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled  ON public.appointments (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_submissions_case   ON public.case_submissions (case_id);
CREATE INDEX IF NOT EXISTS idx_rewards_user_status     ON public.rewards (user_id, status);

-- ── Human-readable case reference ──────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.case_reference_seq;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS case_reference text,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.assign_case_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.case_reference IS NULL THEN
    NEW.case_reference := 'DRB-'
      || to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Jerusalem', 'YYYY')
      || '-' || LPAD(nextval('public.case_reference_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_case_reference ON public.cases;
CREATE TRIGGER trg_assign_case_reference
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_case_reference();

-- Backfill existing cases in creation order.
WITH ordered AS (
  SELECT id, created_at, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.cases
  WHERE case_reference IS NULL
)
UPDATE public.cases c
SET case_reference = 'DRB-'
  || to_char(o.created_at AT TIME ZONE 'Asia/Jerusalem', 'YYYY')
  || '-' || LPAD(o.rn::text, 6, '0')
FROM ordered o
WHERE c.id = o.id;

-- Move the sequence past the backfilled values.
SELECT setval('public.case_reference_seq', GREATEST((SELECT count(*) FROM public.cases), 1));

CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_case_reference ON public.cases (case_reference);
CREATE INDEX IF NOT EXISTS idx_cases_not_archived ON public.cases (created_at DESC) WHERE archived = false AND deleted_at IS NULL;

-- Archiving is an admin-only field: guard it like the other protected columns.
CREATE OR REPLACE FUNCTION public.restrict_cases_financial_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_guarded  text[] := ARRAY[
    'platform_revenue_ils',
    'influencer_commission',
    'lawyer_commission',
    'school_commission',
    'referral_discount',
    'commission_split_done',
    'partner_id',
    'referred_by',
    'source_attribution_method',
    'case_reference'
  ];
  v_new jsonb;
  v_old jsonb;
  v_col text;
BEGIN
  IF COALESCE(current_setting('app.internal_commission_split', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  v_new := to_jsonb(NEW);
  v_old := to_jsonb(OLD);

  FOREACH v_col IN ARRAY v_guarded LOOP
    IF v_new ? v_col AND v_old ? v_col THEN
      IF (v_new ->> v_col) IS DISTINCT FROM (v_old ->> v_col) THEN
        RAISE EXCEPTION 'Only admins can update %', v_col;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Keep archived_at in sync with the archived flag.
CREATE OR REPLACE FUNCTION public.sync_case_archived_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.archived IS DISTINCT FROM OLD.archived THEN
    NEW.archived_at := CASE WHEN NEW.archived THEN now() ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_case_archived_at ON public.cases;
CREATE TRIGGER trg_sync_case_archived_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.sync_case_archived_at();