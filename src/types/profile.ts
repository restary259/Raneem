
export type VisaStatus = 'not_applied' | 'applied' | 'approved' | 'rejected' | 'received';
export type DocumentStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  preferred_name?: string;
  pronouns?: string;
  avatar_url?: string;
  phone_number?: string;
  phone?: string;
  country?: string;
  city?: string;
  bio?: string;
  intake_month?: string;
  university_name?: string;
  visa_status?: VisaStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AcademicBackground {
  id: string;
  user_id: string;
  institution: string;
  degree?: string;
  field_of_study?: string;
  gpa?: number;
  graduation_year?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TestScore {
  id: string;
  user_id: string;
  test_name: string;
  score: string;
  date_taken?: string;
  document_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StudentDocument {
  id: string;
  user_id: string;
  name: string;
  type: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  status: DocumentStatus;
  uploaded_at?: string;
  updated_at?: string;
}

export interface StudentPreferences {
  user_id: string;
  interests?: string[];
  destinations?: string[];
  languages?: string[];
  notifications?: {
    email: boolean;
    push: boolean;
    in_app: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

export interface ProfileCompletion {
  personal: number;
  academic: number;
  documents: number;
  preferences: number;
  overall: number;
}
