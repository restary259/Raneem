
export type VisaStatus = 'not_applied' | 'applied' | 'approved' | 'rejected' | 'received';
export type StudentStatus = 'eligible' | 'ineligible' | 'converted' | 'paid' | 'nurtured';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  country?: string;
  city?: string;
  intake_month?: string;
  university_name?: string;
  visa_status?: VisaStatus;
  student_status?: StudentStatus;
  influencer_id?: string;
  notes?: string;
  gender?: string;
  eye_color?: string;
  has_changed_legal_name?: boolean;
  previous_legal_name?: string;
  has_criminal_record?: boolean;
  criminal_record_details?: string;
  has_dual_citizenship?: boolean;
  second_passport_country?: string;
  created_at?: string;
  updated_at?: string;
}
