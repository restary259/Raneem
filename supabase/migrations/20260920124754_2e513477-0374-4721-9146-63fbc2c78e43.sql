DROP POLICY IF EXISTS "Public contact form submissions are validated"
ON public.contact_submissions;

CREATE POLICY "Public contact form submissions are validated"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  form_source IS NOT NULL
  AND length(form_source) BETWEEN 1 AND 64
  AND data IS NOT NULL
  AND jsonb_typeof(data) = 'object'
  AND length(data::text) <= 8000
  AND admin_notes IS NULL
  AND (status IS NULL OR status = 'new')
  AND (
    form_source <> 'contact_form'
    OR (
      jsonb_typeof(data -> 'full_name') = 'string'
      AND length(btrim(data ->> 'full_name')) BETWEEN 2 AND 100
      AND jsonb_typeof(data -> 'topic') = 'string'
      AND data ->> 'topic' IN (
        'admissions',
        'language_courses',
        'visa',
        'accommodation',
        'partnership',
        'general'
      )
      AND jsonb_typeof(data -> 'message') = 'string'
      AND length(btrim(data ->> 'message')) BETWEEN 5 AND 2000
      AND length(COALESCE(data ->> 'email', '')) <= 255
      AND length(COALESCE(data ->> 'phone', '')) <= 30
      AND (
        length(btrim(COALESCE(data ->> 'email', ''))) > 0
        OR length(btrim(COALESCE(data ->> 'phone', ''))) > 0
      )
      AND COALESCE(data ->> 'locale', '') IN ('ar', 'en')
      AND NOT (
        data ?| ARRAY[
          'admin_notes',
          'status',
          'assigned_to',
          'reviewed_by',
          'reviewed_at'
        ]
      )
    )
  )
);