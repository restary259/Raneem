
-- Add foreign key constraints for data integrity

-- student_cases.lead_id -> leads.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'student_cases_lead_id_fkey' AND table_name = 'student_cases'
  ) THEN
    ALTER TABLE public.student_cases
      ADD CONSTRAINT student_cases_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- appointments.case_id -> student_cases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'appointments_case_id_fkey' AND table_name = 'appointments'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.student_cases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- case_payments.case_id -> student_cases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'case_payments_case_id_fkey' AND table_name = 'case_payments'
  ) THEN
    ALTER TABLE public.case_payments
      ADD CONSTRAINT case_payments_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.student_cases(id) ON DELETE CASCADE;
  END IF;
END $$;

-- case_service_snapshots.case_id -> student_cases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'case_service_snapshots_case_id_fkey' AND table_name = 'case_service_snapshots'
  ) THEN
    ALTER TABLE public.case_service_snapshots
      ADD CONSTRAINT case_service_snapshots_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.student_cases(id) ON DELETE CASCADE;
  END IF;
END $$;

-- case_service_snapshots.master_service_id -> master_services.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'case_service_snapshots_master_service_id_fkey' AND table_name = 'case_service_snapshots'
  ) THEN
    ALTER TABLE public.case_service_snapshots
      ADD CONSTRAINT case_service_snapshots_master_service_id_fkey
      FOREIGN KEY (master_service_id) REFERENCES public.master_services(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- commissions.case_id -> student_cases.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'commissions_case_id_fkey' AND table_name = 'commissions'
  ) THEN
    ALTER TABLE public.commissions
      ADD CONSTRAINT commissions_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.student_cases(id) ON DELETE CASCADE;
  END IF;
END $$;

-- rewards.referral_id -> referrals.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rewards_referral_id_fkey' AND table_name = 'rewards'
  ) THEN
    ALTER TABLE public.rewards
      ADD CONSTRAINT rewards_referral_id_fkey
      FOREIGN KEY (referral_id) REFERENCES public.referrals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- transaction_log.payout_request_id -> payout_requests.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transaction_log_payout_request_id_fkey' AND table_name = 'transaction_log'
  ) THEN
    ALTER TABLE public.transaction_log
      ADD CONSTRAINT transaction_log_payout_request_id_fkey
      FOREIGN KEY (payout_request_id) REFERENCES public.payout_requests(id) ON DELETE SET NULL;
  END IF;
END $$;
