export type VisaStatus = 'not_applied' | 'applied' | 'approved' | 'rejected' | 'received';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  country?: string;
  intake_month?: string;
  university_name?: string;
  visa_status?: VisaStatus;
  notes?: string;
}
