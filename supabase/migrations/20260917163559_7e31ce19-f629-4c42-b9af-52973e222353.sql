CREATE TABLE public.intel_verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  major_id TEXT NOT NULL,
  major_name TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT intel_verification_requests_unique UNIQUE (major_id, requested_by)
);

GRANT SELECT, INSERT ON public.intel_verification_requests TO authenticated;
GRANT ALL ON public.intel_verification_requests TO service_role;

ALTER TABLE public.intel_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can request major verification"
ON public.intel_verification_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_member')
    OR public.has_role(auth.uid(), 'agent')
  )
);

CREATE POLICY "Requester can read own verification requests"
ON public.intel_verification_requests
FOR SELECT
TO authenticated
USING (requested_by = auth.uid());

CREATE POLICY "Admins can read verification requests"
ON public.intel_verification_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));