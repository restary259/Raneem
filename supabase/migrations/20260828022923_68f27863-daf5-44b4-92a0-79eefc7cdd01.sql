CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE (msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  FROM pgmq.read(read_email_batch.queue_name, read_email_batch.vt, read_email_batch.batch_size) AS r
$$;

REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT pgmq.delete(delete_email.queue_name, delete_email.message_id)
$$;

REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;