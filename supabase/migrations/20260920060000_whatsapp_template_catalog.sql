-- Expand the WhatsApp template catalog to match DARB's operational lifecycle.
-- STAGED ONLY. Apply only during the final Supabase migration pass.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_templates'::regclass
      AND conname = 'whatsapp_templates_purpose_check'
  ) THEN
    ALTER TABLE public.whatsapp_templates DROP CONSTRAINT whatsapp_templates_purpose_check;
  END IF;

  ALTER TABLE public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_purpose_check
    CHECK (purpose IN (
      'lead_received',
      'lead_followup',
      'inquiry_follow_up',
      'appointment_invitation',
      'appointment_confirmation',
      'consultation_confirmation',
      'appointment_reminder',
      'documents_missing',
      'document_reminder',
      'profile_incomplete',
      'document_received',
      'payment_instruction',
      'payment_reminder',
      'payment_confirmed',
      'application_started',
      'application_submitted',
      'application_update',
      'student_welcome',
      'enrollment_confirmation',
      'next_steps',
      'support_followup',
      'case_update'
    ));
END
$$;
