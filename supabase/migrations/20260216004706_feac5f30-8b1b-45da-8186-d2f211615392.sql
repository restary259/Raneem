
-- Major categories table
CREATE TABLE public.major_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_ar text NOT NULL,
  title_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.major_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage major categories" ON public.major_categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active categories" ON public.major_categories FOR SELECT USING (is_active = true);

-- Majors (sub-majors) table
CREATE TABLE public.majors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.major_categories(id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  name_de text,
  description_ar text,
  description_en text,
  detailed_description_ar text,
  detailed_description_en text,
  duration_ar text,
  duration_en text,
  career_prospects_ar text,
  career_prospects_en text,
  requirements_ar text,
  requirements_en text,
  suitable_for_ar text,
  suitable_for_en text,
  required_background_ar text,
  required_background_en text,
  language_requirements_ar text,
  language_requirements_en text,
  career_opportunities_ar text,
  career_opportunities_en text,
  arab48_notes_ar text,
  arab48_notes_en text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage majors" ON public.majors FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active majors" ON public.majors FOR SELECT USING (is_active = true);

-- Triggers for updated_at
CREATE TRIGGER update_major_categories_updated_at BEFORE UPDATE ON public.major_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_majors_updated_at BEFORE UPDATE ON public.majors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
