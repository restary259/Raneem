
-- ============================================================
-- Tiered commission system for influencers (idempotent)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commission_tiers (
  id           serial      PRIMARY KEY,
  min_students integer     NOT NULL,
  max_students integer,
  percentage   numeric     NOT NULL,
  base_amount  numeric     NOT NULL DEFAULT 4000,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commission_tiers'
      AND policyname = 'Admins can manage commission tiers'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can manage commission tiers"
        ON public.commission_tiers FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
    $policy$;
  END IF;
END $$;

INSERT INTO public.commission_tiers (min_students, max_students, percentage, base_amount, description)
SELECT * FROM (VALUES
  (1,  5,    20.00::numeric, 4000.00::numeric, 'Tier 1: students 1–5 → 20% = 800₪'),
  (6,  15,   28.00::numeric, 4000.00::numeric, 'Tier 2: students 6–15 → 28% = 1,120₪'),
  (16, 30,   38.00::numeric, 4000.00::numeric, 'Tier 3: students 16–30 → 38% = 1,520₪'),
  (31, NULL, 43.00::numeric, 4000.00::numeric, 'Tier 4: students 31+ → 43% = 1,720₪')
) AS t(min_students, max_students, percentage, base_amount, description)
WHERE NOT EXISTS (SELECT 1 FROM public.commission_tiers);

CREATE OR REPLACE FUNCTION public.get_influencer_tier_commission(p_influencer_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_paid_count  integer;
  v_next_number integer;
  v_pct         numeric;
  v_base        numeric;
BEGIN
  SELECT COUNT(*)
  INTO   v_paid_count
  FROM   student_cases sc
  JOIN   leads l ON l.id = sc.lead_id
  WHERE  l.source_type  = 'influencer'
    AND  l.source_id    = p_influencer_id
    AND  sc.case_status = 'paid';

  v_next_number := v_paid_count + 1;

  SELECT percentage, base_amount
  INTO   v_pct, v_base
  FROM   commission_tiers
  WHERE  v_next_number >= min_students
    AND  (max_students IS NULL OR v_next_number <= max_students)
  ORDER  BY min_students DESC
  LIMIT  1;

  IF v_pct IS NULL THEN
    SELECT percentage, base_amount
    INTO   v_pct, v_base
    FROM   commission_tiers
    ORDER  BY min_students ASC
    LIMIT  1;
  END IF;

  RETURN ROUND((v_pct / 100.0) * v_base, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_lead                  RECORD;
  v_referral              RECORD;
  v_influencer_commission numeric := 0;
BEGIN
  IF OLD.case_status = 'paid' AND NEW.case_status IS DISTINCT FROM 'paid' THEN
    UPDATE rewards
    SET    status = 'cancelled'
    WHERE  admin_notes LIKE '%' || OLD.id::text || '%'
      AND  status IN ('pending', 'approved');
    UPDATE commissions
    SET    status = 'cancelled'
    WHERE  case_id = OLD.id AND status != 'paid';
    NEW.paid_at := NULL;
  END IF;

  IF NEW.case_status = 'paid' AND (OLD.case_status IS DISTINCT FROM 'paid') THEN
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;

    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;

    IF v_lead.source_type = 'influencer' AND v_lead.source_id IS NOT NULL THEN
      IF NEW.influencer_commission = 0 THEN
        v_influencer_commission := get_influencer_tier_commission(v_lead.source_id);
        NEW.influencer_commission := v_influencer_commission;
      END IF;
    END IF;

    INSERT INTO commissions (case_id, influencer_amount, lawyer_amount, status)
    VALUES (NEW.id, NEW.influencer_commission, NEW.lawyer_commission, 'pending')
    ON CONFLICT DO NOTHING;

    IF v_lead.source_type = 'influencer'
       AND v_lead.source_id IS NOT NULL
       AND NEW.influencer_commission > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (v_lead.source_id, NEW.influencer_commission, 'pending',
              'Auto-generated from case ' || NEW.id::text)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_lead.source_type = 'referral' AND NEW.referral_discount > 0 THEN
      SELECT r.* INTO v_referral FROM referrals r
      WHERE  r.referred_phone = v_lead.phone AND r.status != 'rejected'
      LIMIT  1;
      IF v_referral.id IS NOT NULL THEN
        INSERT INTO rewards (user_id, amount, status, referral_id, admin_notes)
        VALUES (v_referral.referrer_id, NEW.referral_discount, 'pending', v_referral.id,
                'Auto-generated referral cashback')
        ON CONFLICT DO NOTHING;
        UPDATE referrals SET status = 'enrolled' WHERE id = v_referral.id;
      END IF;
    END IF;

    IF NEW.assigned_lawyer_id IS NOT NULL AND NEW.lawyer_commission > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (NEW.assigned_lawyer_id, NEW.lawyer_commission, 'pending',
              'Auto-generated lawyer commission from case ' || NEW.id::text)
      ON CONFLICT DO NOTHING;
    END IF;

    IF NEW.has_translation_service AND NEW.translation_fee > 0
       AND NEW.translation_added_by_user_id IS NOT NULL THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (NEW.translation_added_by_user_id, NEW.translation_fee, 'pending',
              'Auto-generated translation commission from case ' || NEW.id::text)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
