/**
 * Shared TypeScript interfaces for database entities.
 * These replace `any[]` usage across the codebase.
 */

export interface Lead {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  eligibility_score: number | null;
  eligibility_reason: string | null;
  status: string;
  source_type: string;
  source_id: string | null;
  ref_code: string | null;
  created_at: string;
  deleted_at: string | null;
  preferred_city: string | null;
  preferred_major: string | null;
  accommodation: boolean;
  last_contacted: string | null;
  passport_type: string | null;
  english_units: number | null;
  math_units: number | null;
  city: string | null;
  education_level: string | null;
  german_level: string | null;
  budget_range: string | null;
  companion_lead_id: string | null;
  student_portal_created: boolean;
  arab48_flag: boolean;
  is_stale: boolean | null;
  notes: string | null;
  age: number | null;
  fraud_flags: string[] | null;
  visa_history: string | null;
  study_destination: string | null;
  service_requested: string | null;
}

export interface StudentCase {
  id: string;
  lead_id: string;
  assigned_lawyer_id: string | null;
  student_profile_id: string | null;
  case_status: string;
  student_full_name: string | null;
  student_email: string | null;
  student_phone: string | null;
  student_address: string | null;
  student_age: number | null;
  passport_number: string | null;
  nationality: string | null;
  country_of_birth: string | null;
  gender: string | null;
  language_proficiency: string | null;
  intensive_course: string | null;
  selected_city: string | null;
  selected_school: string | null;
  housing_description: string | null;
  accommodation_status: string | null;
  service_fee: number;
  school_commission: number;
  influencer_commission: number;
  lawyer_commission: number;
  referral_discount: number;
  paid_at: string | null;
  paid_countdown_started_at: string | null;
  is_paid_admin: boolean | null;
  submitted_to_admin_at: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  notes: string | null;
  admin_notes: string | null;
  fraud_flagged: boolean | null;
  fraud_notes: string | null;
  commission_created: boolean | null;
  reassigned_from: string | null;
  reassignment_history: any | null;
  reassignment_notes: string | null;
  requires_reassignment: boolean | null;
  refund_status: string | null;
}

export interface Appointment {
  id: string;
  case_id: string | null;
  lawyer_id: string;
  student_name: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  country: string | null;
  city: string | null;
  visa_status: string;
  student_status: string;
  commission_amount: number;
  influencer_id: string | null;
  iban: string | null;
  iban_confirmed_at: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_number: string | null;
  university_name: string | null;
  intake_month: string | null;
  notes: string | null;
  gender: string | null;
  eye_color: string | null;
  arrival_date: string | null;
  has_dual_citizenship: boolean;
  has_criminal_record: boolean;
  has_changed_legal_name: boolean;
  criminal_record_details: string | null;
  previous_legal_name: string | null;
  second_passport_country: string | null;
  must_change_password: boolean;
  consent_accepted_at: string | null;
  consent_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reward {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  currency: string;
  referral_id: string | null;
  admin_notes: string | null;
  paid_at: string | null;
  payout_requested_at: string | null;
  created_at: string;
}

export interface Commission {
  id: string;
  case_id: string;
  influencer_amount: number;
  lawyer_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PayoutRequest {
  id: string;
  requestor_id: string;
  requestor_role: string;
  amount: number;
  status: string;
  linked_reward_ids: string[];
  linked_student_names: string[] | null;
  admin_notes: string | null;
  payment_method: string | null;
  transaction_ref: string | null;
  reject_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string | null;
  action: string;
  target_id: string | null;
  target_table: string | null;
  details: string | null;
  created_at: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  ip_address: string | null;
  created_at: string;
}
