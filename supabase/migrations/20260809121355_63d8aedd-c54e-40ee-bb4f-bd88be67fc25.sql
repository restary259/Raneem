ALTER TABLE public.important_contacts DROP CONSTRAINT IF EXISTS important_contacts_category_check;
ALTER TABLE public.important_contacts ADD CONSTRAINT important_contacts_category_check
  CHECK (category IN ('support','team','embassy','emergency','language_school','city_office','immigration','other'));