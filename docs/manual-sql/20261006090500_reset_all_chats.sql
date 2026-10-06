-- One-time pre-launch chat reset. Run ONCE, manually.
-- Deletes every chat message and conversation (direct + case).
-- Accounts, cases, payouts and all other data are untouched.
-- Note: voice call history linked to direct chats is removed with them.
BEGIN;
UPDATE public.payout_requests SET thread_id = NULL WHERE thread_id IS NOT NULL;
DELETE FROM public.direct_messages WHERE thread_id IS NOT NULL;
DELETE FROM public.direct_thread_participants WHERE thread_id IS NOT NULL;
DELETE FROM public.direct_threads WHERE id IS NOT NULL;
DELETE FROM public.case_message_reads WHERE case_id IS NOT NULL;
DELETE FROM public.case_messages WHERE case_id IS NOT NULL;
COMMIT;
