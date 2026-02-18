
-- ============================================================
-- PHASE 6 MIGRATION 1: Fix auto_split_payment idempotency
-- Adds unique indexes for lawyer & referral rewards so that
-- duplicate trigger firings cannot create duplicate rewards.
-- ============================================================

-- 1a. Unique index for lawyer reward pattern (mirrors the existing influencer index)
CREATE UNIQUE INDEX IF NOT EXISTS rewards_lawyer_case_unique
  ON public.rewards (user_id, admin_notes)
  WHERE admin_notes IS NOT NULL
    AND admin_notes LIKE 'Auto-generated lawyer commission from case%';

-- 1b. Unique index for referral cashback (per referral_id, not admin_notes)
CREATE UNIQUE INDEX IF NOT EXISTS rewards_referral_cashback_unique
  ON public.rewards (user_id, referral_id)
  WHERE referral_id IS NOT NULL;

-- 2. Recreate auto_split_payment() with ON CONFLICT DO NOTHING on ALL reward INSERTs
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_referral RECORD;
  v_influencer_commission numeric := 0;
BEGIN
  -- CANCEL rewards if moving AWAY from paid (refund / cancellation safeguard)
  IF OLD.case_status = 'paid' AND NEW.case_status IS DISTINCT FROM 'paid' THEN
    UPDATE rewards SET status = 'cancelled'
    WHERE admin_notes LIKE '%' || OLD.id::text || '%'
      AND status IN ('pending', 'approved');
    UPDATE commissions SET status = 'cancelled'
    WHERE case_id = OLD.id AND status != 'paid';
    NEW.paid_at := NULL;
  END IF;

  -- CREATE rewards when moving TO paid
  IF NEW.case_status = 'paid' AND (OLD.case_status IS DISTINCT FROM 'paid') THEN
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;

    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;

    -- Read influencer's fixed commission_amount from profiles
    IF v_lead.source_type = 'influencer' AND v_lead.source_id IS NOT NULL THEN
      SELECT COALESCE(p.commission_amount, 0) INTO v_influencer_commission
      FROM profiles p WHERE p.id = v_lead.source_id;
      NEW.influencer_commission := v_influencer_commission;
    END IF;

    -- Commission record (idempotent via existing constraint)
    INSERT INTO commissions (case_id, influencer_amount, lawyer_amount, status)
    VALUES (NEW.id, NEW.influencer_commission, NEW.lawyer_commission, 'approved')
    ON CONFLICT DO NOTHING;

    -- Influencer reward (idempotent via rewards_user_case_unique index)
    IF v_lead.source_type = 'influencer' AND v_lead.source_id IS NOT NULL AND NEW.influencer_commission > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (v_lead.source_id, NEW.influencer_commission, 'pending', 'Auto-generated from case ' || NEW.id::text)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Referral reward (idempotent via rewards_referral_cashback_unique index)
    IF v_lead.source_type = 'referral' AND NEW.referral_discount > 0 THEN
      SELECT r.* INTO v_referral FROM referrals r
      WHERE r.referred_phone = v_lead.phone AND r.status != 'rejected'
      LIMIT 1;

      IF v_referral.id IS NOT NULL THEN
        INSERT INTO rewards (user_id, amount, status, referral_id, admin_notes)
        VALUES (v_referral.referrer_id, NEW.referral_discount, 'pending', v_referral.id, 'Auto-generated referral cashback')
        ON CONFLICT DO NOTHING;
        UPDATE referrals SET status = 'enrolled' WHERE id = v_referral.id;
      END IF;
    END IF;

    -- Lawyer reward (idempotent via rewards_lawyer_case_unique index)
    IF NEW.assigned_lawyer_id IS NOT NULL AND NEW.lawyer_commission > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (NEW.assigned_lawyer_id, NEW.lawyer_commission, 'pending',
              'Auto-generated lawyer commission from case ' || NEW.id::text)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
