DROP FUNCTION IF EXISTS public.send_case_message(uuid, text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.send_direct_message(uuid, text, jsonb);

REVOKE ALL ON FUNCTION public.send_case_message(uuid, text, text, jsonb, text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_direct_message(uuid, text, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_case_message(uuid, text, text, jsonb, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text, jsonb, uuid[]) TO authenticated;