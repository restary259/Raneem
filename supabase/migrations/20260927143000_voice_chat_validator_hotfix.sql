BEGIN;

-- Production-safe hotfix for voice attachments.
-- The earlier voice migration also replaces message RPCs, but CI/build does not
-- apply Supabase migrations. Replacing only this validator makes existing
-- send_case_message/send_direct_message implementations accept voice notes too.

CREATE OR REPLACE FUNCTION public.validate_chat_attachments(_att jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v jsonb := COALESCE(_att, '[]'::jsonb);
  item jsonb;
  v_kind text;
  v_mime text;
  v_duration numeric;
BEGIN
  IF jsonb_typeof(v) <> 'array' THEN
    RAISE EXCEPTION 'Attachments must be a list';
  END IF;

  IF jsonb_array_length(v) > 5 THEN
    RAISE EXCEPTION 'Too many attachments';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(v) LOOP
    IF COALESCE(item->>'path','') = '' OR COALESCE(item->>'name','') = '' THEN
      RAISE EXCEPTION 'Attachment is missing a file';
    END IF;

    IF COALESCE((item->>'size')::bigint, 0) > 15728640 THEN
      RAISE EXCEPTION 'File is larger than 15MB';
    END IF;

    v_kind := COALESCE(NULLIF(item->>'kind', ''), 'file');
    v_mime := COALESCE(item->>'mime', '');

    IF v_kind = 'voice' THEN
      IF v_mime NOT IN (
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg',
        'audio/ogg;codecs=opus'
      ) THEN
        RAISE EXCEPTION 'Voice format is not allowed';
      END IF;

      IF COALESCE(item->>'durationMs', '') = ''
         OR item->>'durationMs' !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Voice duration is invalid';
      END IF;

      v_duration := (item->>'durationMs')::numeric;
      IF v_duration <= 0 OR v_duration > 300000 THEN
        RAISE EXCEPTION 'Voice recording must be between 1ms and 5 minutes';
      END IF;
    ELSE
      IF v_kind <> 'file' THEN
        RAISE EXCEPTION 'Attachment kind is not allowed';
      END IF;

      IF v_mime NOT IN (
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ) THEN
        RAISE EXCEPTION 'File type not allowed';
      END IF;
    END IF;
  END LOOP;

  RETURN v;
END;
$function$;

COMMIT;
