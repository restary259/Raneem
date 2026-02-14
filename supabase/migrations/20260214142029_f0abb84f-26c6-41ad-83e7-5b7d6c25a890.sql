
-- Auto-split payment trigger: when case_status changes to 'paid', auto-create rewards and commissions
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_referral RECORD;
BEGIN
  -- Only fire when status changes TO 'paid'
  IF NEW.case_status = 'paid' AND (OLD.case_status IS DISTINCT FROM 'paid') THEN
    -- Set paid_at if not already set
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;

    -- Create commission record
    INSERT INTO commissions (case_id, influencer_amount, lawyer_amount, status)
    VALUES (NEW.id, NEW.influencer_commission, NEW.lawyer_commission, 'approved')
    ON CONFLICT DO NOTHING;

    -- Get the lead to check source
    SELECT * INTO v_lead FROM leads WHERE id = NEW.lead_id;

    -- If lead came from influencer, create reward for them
    IF v_lead.source_type = 'influencer' AND v_lead.source_id IS NOT NULL AND NEW.influencer_commission > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (v_lead.source_id, NEW.influencer_commission, 'pending', 'Auto-generated from case ' || NEW.id::text);
    END IF;

    -- If lead came from referral, create reward for the referrer
    IF v_lead.source_type = 'referral' AND NEW.referral_discount > 0 THEN
      -- Find the referral record that matches this lead's phone
      SELECT r.* INTO v_referral FROM referrals r 
      WHERE r.referred_phone = v_lead.phone AND r.status != 'rejected'
      LIMIT 1;
      
      IF v_referral.id IS NOT NULL THEN
        INSERT INTO rewards (user_id, amount, status, referral_id, admin_notes)
        VALUES (v_referral.referrer_id, NEW.referral_discount, 'pending', v_referral.id, 'Auto-generated referral cashback');
        
        -- Update referral status to enrolled
        UPDATE referrals SET status = 'enrolled' WHERE id = v_referral.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_split_payment ON student_cases;
CREATE TRIGGER trg_auto_split_payment
BEFORE UPDATE ON student_cases
FOR EACH ROW
EXECUTE FUNCTION auto_split_payment();
