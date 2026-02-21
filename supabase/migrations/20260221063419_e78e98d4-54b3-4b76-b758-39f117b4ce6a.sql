-- Fix: Set view to SECURITY INVOKER so RLS of the querying user applies
ALTER VIEW public.leads_lawyer_safe SET (security_invoker = on);