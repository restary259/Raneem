
-- Extend the existing profiles table with new fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS preferred_name text,
ADD COLUMN IF NOT EXISTS pronouns text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS bio text;

-- Create academic_backgrounds table
CREATE TABLE IF NOT EXISTS academic_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  institution text NOT NULL,
  degree text,
  field_of_study text,
  gpa numeric(4,2),
  graduation_year smallint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create test_scores table
CREATE TABLE IF NOT EXISTS test_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  test_name text NOT NULL,
  score text NOT NULL,
  date_taken date,
  document_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create student_documents table
CREATE TABLE IF NOT EXISTS student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create student_preferences table
CREATE TABLE IF NOT EXISTS student_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  interests text[],
  destinations text[],
  languages text[],
  notifications jsonb DEFAULT '{"email": true, "push": true, "in_app": true}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE academic_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for academic_backgrounds
CREATE POLICY "Users can view their own academic backgrounds" 
  ON academic_backgrounds 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own academic backgrounds" 
  ON academic_backgrounds 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own academic backgrounds" 
  ON academic_backgrounds 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own academic backgrounds" 
  ON academic_backgrounds 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for test_scores
CREATE POLICY "Users can view their own test scores" 
  ON test_scores 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own test scores" 
  ON test_scores 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test scores" 
  ON test_scores 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own test scores" 
  ON test_scores 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for student_documents
CREATE POLICY "Users can view their own documents" 
  ON student_documents 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents" 
  ON student_documents 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" 
  ON student_documents 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" 
  ON student_documents 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for student_preferences
CREATE POLICY "Users can view their own preferences" 
  ON student_preferences 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences" 
  ON student_preferences 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
  ON student_preferences 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" 
  ON student_preferences 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_academic_backgrounds_updated_at BEFORE UPDATE ON academic_backgrounds FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_test_scores_updated_at BEFORE UPDATE ON test_scores FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_student_documents_updated_at BEFORE UPDATE ON student_documents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_student_preferences_updated_at BEFORE UPDATE ON student_preferences FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
