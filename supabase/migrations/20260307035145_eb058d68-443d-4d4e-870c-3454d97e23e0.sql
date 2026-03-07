
CREATE TABLE IF NOT EXISTS public.visa_fields (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key    TEXT NOT NULL UNIQUE,
  label_en     TEXT NOT NULL,
  label_ar     TEXT NOT NULL,
  field_type   TEXT NOT NULL DEFAULT 'text',
  options_json JSONB,
  is_required  BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.visa_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage visa fields" ON public.visa_fields;
DROP POLICY IF EXISTS "All roles read active visa fields" ON public.visa_fields;

CREATE POLICY "Admins manage visa fields" ON public.visa_fields FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "All roles read active visa fields" ON public.visa_fields FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.visa_field_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL,
  field_id        UUID NOT NULL REFERENCES public.visa_fields(id) ON DELETE CASCADE,
  value           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, field_id)
);

ALTER TABLE public.visa_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage visa values" ON public.visa_field_values;
DROP POLICY IF EXISTS "Team manage visa values" ON public.visa_field_values;
DROP POLICY IF EXISTS "Students read own visa values" ON public.visa_field_values;

CREATE POLICY "Admins manage visa values" ON public.visa_field_values FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Team manage visa values" ON public.visa_field_values FOR ALL USING (public.has_role(auth.uid(), 'team_member'));
CREATE POLICY "Students read own visa values" ON public.visa_field_values FOR SELECT USING (student_user_id = auth.uid());

INSERT INTO public.visa_fields (field_key, label_en, label_ar, field_type, display_order) VALUES
  ('passport_number',     'Passport Number',           'رقم جواز السفر',          'text',    1),
  ('passport_expiry',     'Passport Expiry Date',      'تاريخ انتهاء الجواز',     'date',    2),
  ('nationality',         'Nationality',                'الجنسية',                 'text',    3),
  ('visa_status',         'Visa Status',                'حالة التأشيرة',           'select',  4),
  ('visa_applied_at',     'Application Date',           'تاريخ التقديم',           'date',    5),
  ('visa_appointment',    'Embassy Appointment',        'موعد السفارة',            'date',    6),
  ('address_abroad',      'Address Abroad',             'العنوان في الخارج',       'text',    7),
  ('contact_abroad',      'Emergency Contact Abroad',   'جهة اتصال في الخارج',    'text',    8),
  ('bank_statement',      'Bank Statement Ready',       'كشف حساب جاهز',          'boolean', 9),
  ('health_insurance',    'Health Insurance',           'التأمين الصحي',           'boolean', 10),
  ('accommodation_proof', 'Accommodation Proof',        'إثبات السكن',             'boolean', 11),
  ('visa_notes',          'Notes',                      'ملاحظات',                 'text',    12)
ON CONFLICT (field_key) DO NOTHING;

UPDATE public.visa_fields 
SET options_json = '[{"value":"not_applied","en":"Not Applied","ar":"لم يتقدم"},{"value":"applied","en":"Applied","ar":"تقدّم"},{"value":"approved","en":"Approved","ar":"مقبول"},{"value":"rejected","en":"Rejected","ar":"مرفوض"},{"value":"received","en":"Visa Received","ar":"استلم التأشيرة"}]'::jsonb 
WHERE field_key = 'visa_status';
