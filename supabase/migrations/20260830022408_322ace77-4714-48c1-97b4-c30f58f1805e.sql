-- ===========================================================================
-- ONE-TIME PRODUCTION DATA RESET
-- KEEP: admin 4abfba8f-1cb9-484d-9b4b-90397179b9d7 (ranimdwahde3@gmail.com)
-- KEEP: case  f29ccd89-a7ad-4d21-b79c-3b48f189e81a (Naif) + its lead
-- KEEP: all catalog/config tables (schools, programs, accommodations,
--       insurances, majors, service_catalog, master_services, platform_settings,
--       pipeline_statuses, permissions, role_permissions, eligibility_*,
--       checklist_items, important_contacts, documents_library)
-- Business triggers are bypassed for this maintenance transaction only.
-- ===========================================================================
SET session_replication_role = 'replica';

-- ---------- case-scoped child data -----------------------------------------
DELETE FROM public.appointment_reminders;
DELETE FROM public.appointments WHERE case_id IS DISTINCT FROM 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_payment_proofs;
DELETE FROM public.case_payments        WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_finance_confirmations WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_invoices        WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_service_snapshots WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_services        WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_financial_snapshots WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_submissions     WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.case_message_reads;
DELETE FROM public.case_messages        WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.message_thread_mutes;
DELETE FROM public.document_versions;
DELETE FROM public.documents;
DELETE FROM public.student_checklist;
DELETE FROM public.services;
DELETE FROM public.payments;
DELETE FROM public.visa_field_values;
DELETE FROM public.visa_applications;
DELETE FROM public.case_events          WHERE case_id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';

-- ---------- money / attribution artefacts ----------------------------------
DELETE FROM public.commission_transactions;
DELETE FROM public.commissions;
DELETE FROM public.rewards;
DELETE FROM public.referrals;
DELETE FROM public.referral_milestones;
DELETE FROM public.payout_requests;
DELETE FROM public.commission_rate_history;
DELETE FROM public.agent_commission_overrides;
DELETE FROM public.agent_self_referral_overrides;
DELETE FROM public.partner_commission_overrides;
DELETE FROM public.team_member_commission_overrides;
DELETE FROM public.student_referral_reward_overrides;
DELETE FROM public.agent_relationships;
DELETE FROM public.partner_clicks;
DELETE FROM public.partner_links;
DELETE FROM public.partner_recruit_applications;
DELETE FROM public.influencer_invites;

-- ---------- cases + leads ---------------------------------------------------
DELETE FROM public.cases WHERE id <> 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.leads WHERE id <> '25116495-1e38-4418-8929-f48be0f96142';
DELETE FROM public.contact_submissions;
DELETE FROM public.case_submissions cs
  WHERE NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.id = cs.case_id);

-- ---------- direct messaging ------------------------------------------------
DELETE FROM public.direct_messages;
DELETE FROM public.direct_thread_participants;
DELETE FROM public.direct_threads;

-- ---------- notifications / preferences / push ------------------------------
DELETE FROM public.notifications WHERE case_id IS DISTINCT FROM 'f29ccd89-a7ad-4d21-b79c-3b48f189e81a';
DELETE FROM public.push_delivery_log;
DELETE FROM public.push_subscriptions WHERE user_id <> '4abfba8f-1cb9-484d-9b4b-90397179b9d7';
DELETE FROM public.notification_preferences WHERE user_id <> '4abfba8f-1cb9-484d-9b4b-90397179b9d7';

-- ---------- account-linked records for every non-admin user ------------------
DELETE FROM public.active_sessions        WHERE user_id <> '4abfba8f-1cb9-484d-9b4b-90397179b9d7';
DELETE FROM public.admin_security_sessions WHERE admin_id <> '4abfba8f-1cb9-484d-9b4b-90397179b9d7';
DELETE FROM public.consent_records        WHERE user_id IS DISTINCT FROM '4abfba8f-1cb9-484d-9b4b-90397179b9d7';
DELETE FROM public.data_requests;
DELETE FROM public.user_invitations;
DELETE FROM public.ai_chat_logs;

-- ---------- email plumbing tied to test addresses ---------------------------
DELETE FROM public.email_send_log;
DELETE FROM public.email_send_state;
DELETE FROM public.email_unsubscribe_tokens;
DELETE FROM public.suppressed_emails;

-- ---------- operational logs -------------------------------------------------
DELETE FROM public.activity_log;
DELETE FROM public.admin_audit_log;
DELETE FROM public.auth_failure_log;
DELETE FROM public.login_attempts;
DELETE FROM public.transaction_log;
DELETE FROM public.deletion_logs;

-- ---------- accounts ----------------------------------------------------------
UPDATE public.profiles SET agent_id = NULL, created_by = NULL
  WHERE agent_id IS NOT NULL OR created_by IS NOT NULL;
DELETE FROM public.user_roles WHERE user_id <> '4abfba8f-1cb9-484d-9b4b-90397179b9d7';
DELETE FROM public.profiles   WHERE id      <> '4abfba8f-1cb9-484d-9b4b-90397179b9d7';

-- Hard-delete the auth identities so the e-mail addresses become reusable.
DELETE FROM auth.users WHERE id <> '4abfba8f-1cb9-484d-9b4b-90397179b9d7';

SET session_replication_role = 'origin';