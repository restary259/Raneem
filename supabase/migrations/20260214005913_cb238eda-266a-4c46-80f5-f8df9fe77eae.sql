
-- Create appointments table for team calendar
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.student_cases(id) ON DELETE SET NULL,
  lawyer_id UUID NOT NULL,
  student_name TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Lawyers can view their own appointments
CREATE POLICY "Lawyers can view own appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = lawyer_id);

-- Lawyers can insert their own appointments
CREATE POLICY "Lawyers can insert own appointments"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = lawyer_id);

-- Lawyers can update their own appointments
CREATE POLICY "Lawyers can update own appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = lawyer_id);

-- Lawyers can delete their own appointments
CREATE POLICY "Lawyers can delete own appointments"
ON public.appointments FOR DELETE
USING (auth.uid() = lawyer_id);

-- Admins can manage all appointments
CREATE POLICY "Admins can manage all appointments"
ON public.appointments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookup by lawyer and date
CREATE INDEX idx_appointments_lawyer_date ON public.appointments(lawyer_id, scheduled_at);
