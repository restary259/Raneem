-- Server-authoritative "send bank details" for partners / ambassadors / agents.
--
-- Before this, the browser built the bank-share message body from a preview
-- loaded client-side and posted it through `send_direct_message` — so a caller
-- could send ANY values (or ANY thread) regardless of what is actually saved on
-- their `profiles` row. This RPC makes the saved row the single source of truth:
-- it reads the caller's own bank columns, verifies the caller is in the thread,
-- verifies an admin is also in the thread, and only then posts.
--
-- The body keeps the exact marker + JSON + human block shape produced by
-- `buildBankDetailsBody` (src/lib/chatFormat.ts) so MessageList stays
-- marker-driven and BankDetailsCard renders unchanged. The inserted row is
-- tagged kind = 'bank_share' (direct_messages.kind has no CHECK constraint, so
-- no column migration is needed).

CREATE OR REPLACE FUNCTION public.send_bank_details_to_admin(p_thread_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_row record;
  v_body text;
  v_json text;
  v_human text;
  v_message uuid;
  v_dash text := chr(8212); -- em dash, matching the JS '—' placeholder
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- The share surface is for payout-earning recruiters only. Students and team
  -- members have no bank-share flow; rejecting here keeps the trust boundary
  -- server-side rather than relying on the UI hiding the action.
  IF NOT (public.has_role(v_me, 'social_media_partner'::app_role)
          OR public.has_role(v_me, 'ambassador'::app_role)
          OR public.has_role(v_me, 'agent'::app_role)) THEN
    RAISE EXCEPTION 'Only partners, ambassadors and agents can send bank details';
  END IF;

  IF NOT public.is_direct_thread_member(p_thread_id, v_me) THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  -- An admin must be a participant — the request is "send to Administration".
  -- Checked from the thread's actual participants, never from client input.
  IF NOT EXISTS (
    SELECT 1
      FROM public.direct_thread_participants p
     WHERE p.thread_id = p_thread_id
       AND public.has_role(p.user_id, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'This conversation has no administrator to receive bank details';
  END IF;

  SELECT bank_country, bank_name, bank_branch, bank_account_number, iban, bic
    INTO v_row
    FROM public.profiles
   WHERE id = v_me;

  IF v_row IS NULL THEN RAISE EXCEPTION 'BANK_DETAILS_MISSING'; END IF;

  IF COALESCE(btrim(v_row.bank_name), '') = ''
     AND COALESCE(btrim(v_row.bank_branch), '') = ''
     AND COALESCE(btrim(v_row.bank_account_number), '') = ''
     AND COALESCE(btrim(v_row.iban), '') = ''
     AND COALESCE(btrim(v_row.bic), '') = '' THEN
    RAISE EXCEPTION 'BANK_DETAILS_MISSING';
  END IF;

  -- Key order must match BankDetailsPayload in chatFormat.ts.
  v_json := jsonb_build_object(
    'bankCountry', COALESCE(v_row.bank_country, ''),
    'bankName', COALESCE(v_row.bank_name, ''),
    'bankBranch', COALESCE(v_row.bank_branch, ''),
    'bankAccount', COALESCE(v_row.bank_account_number, ''),
    'iban', COALESCE(v_row.iban, ''),
    'bic', COALESCE(v_row.bic, '')
  )::text;

  v_human :=
      'Bank name: ' || COALESCE(NULLIF(v_row.bank_name, ''), v_dash)
   || E'\nBranch: ' || COALESCE(NULLIF(v_row.bank_branch, ''), v_dash)
   || E'\nAccount number: ' || COALESCE(NULLIF(v_row.bank_account_number, ''), v_dash)
   || E'\nIBAN: ' || COALESCE(NULLIF(v_row.iban, ''), v_dash)
   || E'\nBIC/SWIFT: ' || COALESCE(NULLIF(v_row.bic, ''), v_dash)
   || E'\nCountry: ' || COALESCE(NULLIF(v_row.bank_country, ''), v_dash);

  v_body := '::bank-details::' || E'\n' || v_json || E'\n\n' || v_human;

  v_message := public.send_direct_message(p_thread_id, v_body, '[]'::jsonb, '{}'::uuid[]);

  UPDATE public.direct_messages
     SET kind = 'bank_share'
   WHERE id = v_message;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_bank_details_to_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_bank_details_to_admin(uuid) TO authenticated;
