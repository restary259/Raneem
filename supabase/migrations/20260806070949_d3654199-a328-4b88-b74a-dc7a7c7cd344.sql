CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_en text NOT NULL,
  label_ar text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read_authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_admin_write" ON public.permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_id)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read_authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_admin_write" ON public.role_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);

INSERT INTO public.permissions (key, label_en, label_ar, category) VALUES
  ('view_cases','View cases','عرض الحالات','cases'),
  ('edit_cases','Edit cases','تعديل الحالات','cases'),
  ('delete_cases','Delete cases','حذف الحالات','cases'),
  ('assign_cases','Assign cases','إسناد الحالات','cases'),
  ('archive_cases','Archive cases','أرشفة الحالات','cases'),
  ('view_students','View students','عرض الطلاب','students'),
  ('edit_students','Edit students','تعديل الطلاب','students'),
  ('delete_students','Delete students','حذف الطلاب','students'),
  ('view_own_case','View own case','عرض حالتي','students'),
  ('view_documents','View documents','عرض المستندات','documents'),
  ('upload_documents','Upload documents','رفع المستندات','documents'),
  ('delete_documents','Delete documents','حذف المستندات','documents'),
  ('view_invoices','View invoices','عرض الفواتير','finance'),
  ('create_invoice','Create invoices','إنشاء الفواتير','finance'),
  ('view_finance','View financials','عرض المالية','finance'),
  ('approve_payments','Approve payments','اعتماد المدفوعات','finance'),
  ('approve_payouts','Approve payouts','اعتماد التحويلات','finance'),
  ('request_payout','Request payout','طلب تحويل','finance'),
  ('view_own_earnings','View own earnings','عرض أرباحي','finance'),
  ('export_excel','Export to Excel','التصدير إلى Excel','reports'),
  ('view_reports','View reports','عرض التقارير','reports'),
  ('manage_partners','Manage partners','إدارة الشركاء','admin'),
  ('manage_team','Manage team','إدارة الفريق','admin'),
  ('manage_settings','Manage settings','إدارة الإعدادات','admin'),
  ('manage_pipeline','Manage pipeline stages','إدارة مراحل المسار','admin'),
  ('view_audit_log','View audit log','عرض سجل التدقيق','admin'),
  ('view_appointments','View appointments','عرض المواعيد','appointments'),
  ('manage_appointments','Manage appointments','إدارة المواعيد','appointments'),
  ('view_referrals','View referrals','عرض الإحالات','partners'),
  ('manage_referral_links','Manage referral links','إدارة روابط الإحالة','partners');

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, id FROM public.permissions;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'team_member'::public.app_role, id FROM public.permissions
WHERE key IN ('view_cases','edit_cases','assign_cases','view_students','edit_students','view_own_case',
 'view_documents','upload_documents','view_invoices','create_invoice','view_appointments','manage_appointments','export_excel','view_reports');

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'social_media_partner'::public.app_role, id FROM public.permissions
WHERE key IN ('view_referrals','manage_referral_links','view_own_earnings','request_payout');

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'ambassador'::public.app_role, id FROM public.permissions
WHERE key IN ('view_referrals','manage_referral_links','view_own_earnings','request_payout');

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'student'::public.app_role, id FROM public.permissions
WHERE key IN ('view_own_case','view_documents','upload_documents','view_invoices','view_appointments','view_referrals','view_own_earnings','request_payout');

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.key = _permission
  )
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.key
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated, service_role;