DROP POLICY IF EXISTS "Partners can view their own cases" ON public.cases;
DROP POLICY IF EXISTS "Partners can view their own cases (via view)" ON public.cases;
DROP VIEW IF EXISTS public.partner_cases;