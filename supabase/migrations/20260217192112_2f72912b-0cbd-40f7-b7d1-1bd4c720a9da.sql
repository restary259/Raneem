
CREATE OR REPLACE FUNCTION public.auto_split_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_referral RECORD;
  v_influencer_commission numeric := 0;
BEGIN
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

    INSERT INTO commissions (case_id, influencer_amount, lawyer_amount, status)
    VALUES (NEW.id, NEW.influencer_commission, NEW.lawyer_commission, 'approved')
    ON CONFLICT DO NOTHING;

    -- Influencer reward
    IF v_lead.source_type = 'influencer' AND v_lead.source_id IS NOT NULL AND NEW.influencer_commission > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (v_lead.source_id, NEW.influencer_commission, 'pending', 'Auto-generated from case ' || NEW.id::text);
    END IF;

    -- Referral reward
    IF v_lead.source_type = 'referral' AND NEW.referral_discount > 0 THEN
      SELECT r.* INTO v_referral FROM referrals r 
      WHERE r.referred_phone = v_lead.phone AND r.status != 'rejected'
      LIMIT 1;
      
      IF v_referral.id IS NOT NULL THEN
        INSERT INTO rewards (user_id, amount, status, referral_id, admin_notes)
        VALUES (v_referral.referrer_id, NEW.referral_discount, 'pending', v_referral.id, 'Auto-generated referral cashback');
        UPDATE referrals SET status = 'enrolled' WHERE id = v_referral.id;
      END IF;
    END IF;

    -- Lawyer/team member reward
    IF NEW.assigned_lawyer_id IS NOT NULL AND NEW.lawyer_commission > 0 THEN
      INSERT INTO rewards (user_id, amount, status, admin_notes)
      VALUES (NEW.assigned_lawyer_id, NEW.lawyer_commission, 'pending',
              'Auto-generated lawyer commission from case ' || NEW.id::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
