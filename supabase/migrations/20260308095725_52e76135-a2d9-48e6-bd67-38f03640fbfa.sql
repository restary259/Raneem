
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_source_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_source_check 
  CHECK (source = ANY (ARRAY[
    'apply_page', 'manual', 'submit_new_student', 
    'social_media_partner', 'referral', 'contact_form'
  ]));
