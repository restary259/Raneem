import { supabase } from "@/integrations/supabase/client";

/**
 * Version of the privacy policy / terms the user is agreeing to.
 * Bump this whenever the legal copy in public/locales/*\/legal.json changes
 * materially — historical consent records keep pointing at the old version.
 */
export const POLICY_VERSION = "2026-08-06";

export type ConsentSourceForm =
  | "apply_page"
  | "contact_form"
  | "student_profile"
  | "partnership_form";

export interface ConsentInput {
  sourceForm: ConsentSourceForm;
  subjectName?: string | null;
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
  /** Consent to be contacted about the service itself (always required to submit). */
  serviceContact: boolean;
  /** Separate, optional consent to receive marketing / promotional messages. */
  marketing: boolean;
  /** Channels the marketing consent covers. */
  marketingChannels?: { email?: boolean; whatsapp?: boolean; sms?: boolean };
  locale?: string;
}

/**
 * Append-only consent record. Never blocks the main submission: a failure here
 * is logged but the user's application still goes through.
 */
export async function recordConsent(input: ConsentInput): Promise<void> {
  try {
    const { error } = await supabase.from("consent_records").insert({
      source_form: input.sourceForm,
      subject_name: input.subjectName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      user_id: input.userId ?? null,
      policy_version: POLICY_VERSION,
      service_contact_consent: input.serviceContact,
      marketing_consent: input.marketing,
      marketing_channels: input.marketing
        ? (input.marketingChannels ?? { email: true, whatsapp: true, sms: false })
        : {},
      locale: input.locale ?? null,
    });
    if (error) console.warn("[consent] failed to record consent:", error.message);
  } catch (err) {
    console.warn("[consent] failed to record consent:", err);
  }
}
