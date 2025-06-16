
-- Create enum types for better data consistency
CREATE TYPE public.visa_status AS ENUM ('not_applied', 'applied', 'approved', 'rejected', 'received');
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'completed', 'overdue');
CREATE TYPE public.service_type AS ENUM ('university_application', 'visa_assistance', 'accommodation', 'scholarship', 'language_support', 'travel_booking');

-- Create profiles table for student information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  country TEXT,
  intake_month TEXT,
  university_name TEXT,
  visa_status visa_status DEFAULT 'not_applied',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_type service_type NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completion_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  amount_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_remaining DECIMAL(10,2) GENERATED ALWAYS AS (amount_total - amount_paid) STORED,
  payment_status payment_status DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  payment_date TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table for file uploads
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('student-documents', 'student-documents', false);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS policies for services
CREATE POLICY "Users can view their own services" ON public.services FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Users can insert their own services" ON public.services FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Users can update their own services" ON public.services FOR UPDATE USING (auth.uid() = student_id);

-- RLS policies for payments
CREATE POLICY "Users can view their own payments" ON public.payments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Users can insert their own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Users can update their own payments" ON public.payments FOR UPDATE USING (auth.uid() = student_id);

-- RLS policies for documents
CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING (auth.uid() = student_id);

-- Storage policies for documents bucket
CREATE POLICY "Users can view their own documents in storage" ON storage.objects FOR SELECT USING (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload their own documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own documents in storage" ON storage.objects FOR UPDATE USING (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own documents in storage" ON storage.objects FOR DELETE USING (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
