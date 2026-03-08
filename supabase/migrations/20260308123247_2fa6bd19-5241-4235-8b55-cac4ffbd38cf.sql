
-- Data repair: insert the missing case for "test rayan contact"
-- This lead was submitted via contact form but was blocked by a false duplicate
-- detection against an unrelated referral case with the same phone number (0525260549)
INSERT INTO public.cases (full_name, phone_number, source, status)
VALUES ('test rayan contact', '0525260549', 'contact_form', 'new');
