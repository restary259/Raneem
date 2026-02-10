
-- Phase 1b: Add columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_status text NOT NULL DEFAULT 'eligible',
  ADD COLUMN IF NOT EXISTS influencer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Phase 1c: Create checklist_items table
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist items"
  ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert checklist items"
  ON public.checklist_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update checklist items"
  ON public.checklist_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete checklist items"
  ON public.checklist_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1d: Create student_checklist table
CREATE TABLE IF NOT EXISTS public.student_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, checklist_item_id)
);
ALTER TABLE public.student_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own checklist"
  ON public.student_checklist FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Admins can view all checklists"
  ON public.student_checklist FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Influencers can view assigned student checklists"
  ON public.student_checklist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'influencer') AND EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = student_checklist.student_id AND profiles.influencer_id = auth.uid()
  ));
CREATE POLICY "Students can insert own checklist"
  ON public.student_checklist FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Admins can insert any checklist"
  ON public.student_checklist FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can update own checklist"
  ON public.student_checklist FOR UPDATE TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Admins can update any checklist"
  ON public.student_checklist FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete any checklist"
  ON public.student_checklist FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1e: Create influencer_invites table
CREATE TABLE IF NOT EXISTS public.influencer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  created_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influencer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invites"
  ON public.influencer_invites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Influencer can view assigned student profiles
CREATE POLICY "Influencers can view assigned students"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'influencer') AND influencer_id = auth.uid());

-- Seed default checklist items
INSERT INTO public.checklist_items (item_name, description, sort_order) VALUES
  ('جواز السفر', 'نسخة سارية المفعول من جواز السفر', 1),
  ('الشهادات الأكاديمية', 'شهادة الثانوية / البجروت مع كشف الدرجات', 2),
  ('الترجمات المعتمدة', 'ترجمة معتمدة للشهادات والمستندات', 3),
  ('شهادة اللغة', 'شهادة لغة ألمانية أو إنجليزية', 4),
  ('الحساب البنكي المغلق', 'Blocked Account أو كفالة مالية', 5),
  ('التأمين الصحي', 'تأمين صحي ساري المفعول', 6),
  ('صور شخصية', 'صور بحجم جواز السفر', 7),
  ('خطاب القبول الجامعي', 'Zulassungsbescheid أو شرط القبول', 8);

-- Admin can update all profiles (for assigning influencers, changing status)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
