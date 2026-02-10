
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
  created_at?: string;
  updated_at?: string;
}
