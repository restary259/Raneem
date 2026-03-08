import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Phone,
  Mail,
  Link as LinkIcon,
  AlertTriangle,
  ShieldAlert,
  DollarSign,
  Eye,
} from "lucide-react";
import CommissionSettingsPanel from "@/components/admin/CommissionSettingsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface PlatformSettings {
  id: string;
  partner_commission_rate: number;
  forgotten_new_case_days: number;
  forgotten_contacted_days: number;
}

interface Contact {
  id: string;
  name_ar: string;
  name_en: string;
  role_ar: string | null;
  role_en: string | null;
  phone: string | null;
  email: string | null;
  link: string | null;
  category: string;
  display_order: number;
  is_active: boolean;
}

interface VisaField {
  id: string;
  field_key: string;
  label_en: string;
  label_ar: string;
  field_type: string;
  options_json: any[] | null;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
}

const CATEGORIES = ["emergency", "medical", "legal", "team", "other"];
const FIELD_TYPES = ["text", "date", "select", "boolean"];

// Data categories for selective reset
const RESET_CATEGORIES = [
  { id: "cases", labelEn: "Cases & Submissions", labelAr: "الملفات والتقديمات", tables: ["cases", "case_submissions", "case_service_snapshots"] },
  { id: "appointments", labelEn: "Appointments", labelAr: "المواعيد", tables: ["appointments"] },
  { id: "documents", labelEn: "Documents", labelAr: "المستندات", tables: ["documents"] },
  { id: "financial", labelEn: "Financial Records", labelAr: "السجلات المالية", tables: ["rewards", "commissions", "payout_requests"] },
  { id: "leads", labelEn: "Leads", labelAr: "العملاء المحتملين", tables: ["leads"] },
  { id: "referrals", labelEn: "Referrals", labelAr: "الإحالات", tables: ["referrals"] },
  { id: "activity", labelEn: "Activity Log", labelAr: "سجل النشاط", tables: ["activity_log"] },
];

const AdminSettingsPage = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";

  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);

  const [contactForm, setContactForm] = useState({
    name_ar: "", name_en: "", role_ar: "", role_en: "",
    phone: "", email: "", link: "", category: "other", display_order: "0",
  });

  // ── Visa fields state ──────────────────────────────────────────────
  const [visaFields, setVisaFields] = useState<VisaField[]>([]);
  const [visaLoading, setVisaLoading] = useState(false);
  const [visaFieldOpen, setVisaFieldOpen] = useState(false);
  const [visaFieldSaving, setVisaFieldSaving] = useState(false);
  const [visaFieldForm, setVisaFieldForm] = useState({
    field_key: "", label_en: "", label_ar: "",
    field_type: "text", is_required: false, display_order: "0",
  });

  // ── Selective reset state ──────────────────────────────────────────
  const [resetCategories, setResetCategories] = useState<string[]>([]);
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [countLoading, setCountLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        supabase.from("platform_settings").select("*").limit(1).single(),
        supabase.from("important_contacts").select("*").order("display_order"),
      ]);
      if (sRes.data) setSettings(sRes.data);
      setContacts(cRes.data || []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchVisaFields = useCallback(async () => {
    setVisaLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("visa_fields")
        .select("*")
        .order("display_order");
      if (error) throw error;
      setVisaFields(data ?? []);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setVisaLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("platform_settings")
        .update({
          partner_commission_rate: settings.partner_commission_rate,
          forgotten_new_case_days: settings.forgotten_new_case_days,
          forgotten_contacted_days: settings.forgotten_contacted_days,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
      toast({ description: t('admin.settings.settingsSaved', 'Settings saved') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const createContact = async () => {
    if (!contactForm.name_ar || !contactForm.name_en) {
      toast({ variant: "destructive", description: t('admin.settings.nameRequired', 'Name is required') });
      return;
    }
    setContactSaving(true);
    try {
      const { error } = await supabase.from("important_contacts").insert({
        name_ar: contactForm.name_ar, name_en: contactForm.name_en,
        role_ar: contactForm.role_ar || null, role_en: contactForm.role_en || null,
        phone: contactForm.phone || null, email: contactForm.email || null,
        link: contactForm.link || null, category: contactForm.category,
        display_order: Number(contactForm.display_order) || 0,
      });
      if (error) throw error;
      setContactForm({ name_ar: "", name_en: "", role_ar: "", role_en: "", phone: "", email: "", link: "", category: "other", display_order: "0" });
      setContactOpen(false);
      await fetchData();
      toast({ description: t('admin.settings.contactCreated', 'Contact created') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setContactSaving(false);
    }
  };

  const toggleContact = async (id: string, current: boolean) => {
    const { error } = await supabase.from("important_contacts").update({ is_active: !current }).eq("id", id);
    if (error) toast({ variant: "destructive", description: error.message });
    else fetchData();
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from("important_contacts").delete().eq("id", id);
    if (error) toast({ variant: "destructive", description: error.message });
    else fetchData();
  };

  const createVisaField = async () => {
    if (!visaFieldForm.field_key || !visaFieldForm.label_en || !visaFieldForm.label_ar) {
      toast({ variant: "destructive", description: t('admin.settings.allFieldsRequired', 'All fields are required') });
      return;
    }
    setVisaFieldSaving(true);
    try {
      const { error } = await (supabase as any).from("visa_fields").insert({
        field_key: visaFieldForm.field_key.toLowerCase().replace(/\s+/g, '_'),
        label_en: visaFieldForm.label_en,
        label_ar: visaFieldForm.label_ar,
        field_type: visaFieldForm.field_type,
        is_required: visaFieldForm.is_required,
        display_order: Number(visaFieldForm.display_order) || 0,
      });
      if (error) throw error;
      setVisaFieldForm({ field_key: "", label_en: "", label_ar: "", field_type: "text", is_required: false, display_order: "0" });
      setVisaFieldOpen(false);
      await fetchVisaFields();
      toast({ description: t('admin.settings.fieldAdded', 'Field added') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setVisaFieldSaving(false);
    }
  };

  const toggleVisaField = async (id: string, current: boolean) => {
    const { error } = await (supabase as any).from("visa_fields").update({ is_active: !current }).eq("id", id);
    if (error) toast({ variant: "destructive", description: error.message });
    else fetchVisaFields();
  };

  const deleteVisaField = async (id: string) => {
    const { error } = await (supabase as any).from("visa_fields").delete().eq("id", id);
    if (error) toast({ variant: "destructive", description: error.message });
    else fetchVisaFields();
  };

  // ── Selective reset ────────────────────────────────────────────────
  const toggleResetCategory = (id: string) => {
    setResetCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const loadRowCounts = async () => {
    if (!resetCategories.length) return;
    setCountLoading(true);
    const counts: Record<string, number> = {};
    const tables = RESET_CATEGORIES
      .filter(c => resetCategories.includes(c.id))
      .flatMap(c => c.tables);
    for (const table of tables) {
      const { count } = await (supabase as any)
        .from(table)
        .select("*", { count: "exact", head: true });
      counts[table] = count ?? 0;
    }
    setRowCounts(counts);
    setCountLoading(false);
  };

  const handleDataReset = async () => {
    if (!user?.email || !resetCategories.length) return;
    setResetting(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: resetPassword });
      if (authErr) throw new Error(t('admin.settings.incorrectPassword', 'Incorrect password'));

      const selectedTables = RESET_CATEGORIES
        .filter(c => resetCategories.includes(c.id))
        .flatMap(c => c.tables);

      for (const table of selectedTables) {
        await (supabase as any).from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }

      await supabase.rpc("log_user_activity" as any, {
        p_action: "SELECTIVE_DATA_PURGE",
        p_target_table: "system",
        p_details: `Selective purge: ${selectedTables.join(", ")} by ${user.email}`,
      });

      toast({
        title: t('admin.settings.purgeSuccess', '✅ Data deleted'),
        description: t('admin.settings.finalConfirmDesc', '{{count}} records will be permanently deleted.', { count: selectedTables.length }),
      });
      setShowFinalConfirm(false);
      setResetPassword("");
      setResetCategories([]);
      setRowCounts({});
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setResetting(false);
    }
  };

  const catLabel = (cat: string) => {
    const m: Record<string, { en: string; ar: string }> = {
      emergency: { en: "Emergency", ar: "طوارئ" }, medical: { en: "Medical", ar: "طبي" },
      legal: { en: "Legal", ar: "قانوني" }, team: { en: "Team", ar: "الفريق" }, other: { en: "Other", ar: "أخرى" },
    };
    return isRtl ? m[cat]?.ar : m[cat]?.en;
  };

  const totalRowCount = Object.values(rowCounts).reduce((a, b) => a + b, 0);

  if (loading)
    return <div className="p-8 text-center text-muted-foreground">{t('common.loading', 'Loading...')}</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.settings.title", "Settings")}</h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="platform">
        <TabsList className="flex-wrap">
          <TabsTrigger value="platform">{t("admin.settings.platform", "Platform")}</TabsTrigger>
          <TabsTrigger value="commissions">
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            {t("admin.settings.commissions", "Commissions")}
          </TabsTrigger>
          <TabsTrigger value="contacts">{t("admin.settings.contacts", "Important Contacts")}</TabsTrigger>
          <TabsTrigger value="visa">{t('admin.settings.visaTabLabel', 'Visa Fields')}</TabsTrigger>
          <TabsTrigger value="reset" className="text-destructive data-[state=active]:text-destructive">
            {t('admin.settings.resetTabLabel', '⚠️ Data Reset')}
          </TabsTrigger>
        </TabsList>

        {/* ── Platform Settings ── */}
        <TabsContent value="platform" className="space-y-4 mt-4">
          {settings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("admin.settings.platformTitle", "Platform Configuration")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>{t('admin.settings.newCaseDays', 'New Case Forgotten Days')}</Label>
                    <Input type="number" value={settings.forgotten_new_case_days}
                      onChange={(e) => setSettings((s) => (s ? { ...s, forgotten_new_case_days: Number(e.target.value) } : s))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactedDays', 'Contacted Case Forgotten Days')}</Label>
                    <Input type="number" value={settings.forgotten_contacted_days}
                      onChange={(e) => setSettings((s) => (s ? { ...s, forgotten_contacted_days: Number(e.target.value) } : s))} />
                  </div>
                </div>
                <Button onClick={saveSettings} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? t('admin.settings.saving', 'Saving...') : t("common.save", "Save Changes")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Commission Settings ── */}
        <TabsContent value="commissions" className="mt-4">
          <CommissionSettingsPanel />
        </TabsContent>

        {/* ── Important Contacts ── */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={contactOpen} onOpenChange={setContactOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("admin.settings.addContact", "Add Contact")}
                </Button>
              </DialogTrigger>
              <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("admin.settings.addContact", "Add Contact")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.settings.contactFormArabicName')}</Label>
                      <Input value={contactForm.name_ar} onChange={(e) => setContactForm((f) => ({ ...f, name_ar: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.settings.contactFormEnglishName')}</Label>
                      <Input value={contactForm.name_en} onChange={(e) => setContactForm((f) => ({ ...f, name_en: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.settings.contactFormRoleAr')}</Label>
                      <Input value={contactForm.role_ar} onChange={(e) => setContactForm((f) => ({ ...f, role_ar: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.settings.contactFormRoleEn')}</Label>
                      <Input value={contactForm.role_en} onChange={(e) => setContactForm((f) => ({ ...f, role_en: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormPhone')}</Label>
                    <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormEmail')}</Label>
                    <Input value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormLink')}</Label>
                    <Input value={contactForm.link} onChange={(e) => setContactForm((f) => ({ ...f, link: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormCategory')}</Label>
                    <Select value={contactForm.category} onValueChange={(v) => setContactForm((f) => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormOrder')}</Label>
                    <Input type="number" value={contactForm.display_order}
                      onChange={(e) => setContactForm((f) => ({ ...f, display_order: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={createContact} disabled={contactSaving}>
                    {contactSaving ? t('admin.settings.saving') : t("common.save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {contacts.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t('admin.settings.noContacts')}</p>
              ) : (
                <div className="divide-y divide-border">
                  {contacts.map((c) => (
                    <div key={c.id} className="flex items-start justify-between p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{isRtl ? c.name_ar : c.name_en}</p>
                        {(isRtl ? c.role_ar : c.role_en) && (
                          <p className="text-xs text-muted-foreground">{isRtl ? c.role_ar : c.role_en}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-1">
                          {c.phone && (<a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="h-3 w-3" />{c.phone}</a>)}
                          {c.email && (<a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Mail className="h-3 w-3" />{c.email}</a>)}
                          {c.link && (<a href={c.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><LinkIcon className="h-3 w-3" />Link</a>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ms-4 shrink-0">
                        <span className="text-xs text-muted-foreground">{catLabel(c.category)}</span>
                        <Switch checked={c.is_active} onCheckedChange={() => toggleContact(c.id, c.is_active)} />
                        <Button variant="ghost" size="icon" onClick={() => deleteContact(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Visa Fields Manager ── */}
        <TabsContent value="visa" className="space-y-4 mt-4" onAnimationStart={fetchVisaFields}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{isRtl ? "إدارة حقول التأشيرة" : "Visa Fields Manager"}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRtl ? "أضف أو عدّل الحقول التي تظهر في صفحة التأشيرة" : "Add or edit fields shown on the visa page"}
              </p>
            </div>
            <Dialog open={visaFieldOpen} onOpenChange={setVisaFieldOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {isRtl ? "إضافة حقل" : "Add Field"}
                </Button>
              </DialogTrigger>
              <DialogContent dir={isRtl ? "rtl" : "ltr"}>
                <DialogHeader>
                  <DialogTitle>{isRtl ? "حقل جديد" : "New Visa Field"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label>{isRtl ? "مفتاح الحقل (فريد)" : "Field Key (unique)"}</Label>
                    <Input value={visaFieldForm.field_key} placeholder="e.g. passport_number"
                      onChange={(e) => setVisaFieldForm(f => ({ ...f, field_key: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{isRtl ? "التسمية (إنجليزي)" : "Label (English)"}</Label>
                      <Input value={visaFieldForm.label_en}
                        onChange={(e) => setVisaFieldForm(f => ({ ...f, label_en: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>{isRtl ? "التسمية (عربي)" : "Label (Arabic)"}</Label>
                      <Input value={visaFieldForm.label_ar} dir="rtl"
                        onChange={(e) => setVisaFieldForm(f => ({ ...f, label_ar: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{isRtl ? "نوع الحقل" : "Field Type"}</Label>
                    <Select value={visaFieldForm.field_type} onValueChange={(v) => setVisaFieldForm(f => ({ ...f, field_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">{isRtl ? "نص" : "Text"}</SelectItem>
                        <SelectItem value="date">{isRtl ? "تاريخ" : "Date"}</SelectItem>
                        <SelectItem value="select">{isRtl ? "قائمة" : "Dropdown"}</SelectItem>
                        <SelectItem value="boolean">{isRtl ? "نعم/لا" : "Yes/No"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={visaFieldForm.is_required}
                      onCheckedChange={(v) => setVisaFieldForm(f => ({ ...f, is_required: v }))} />
                    <Label>{isRtl ? "إلزامي" : "Required"}</Label>
                  </div>
                  <div className="space-y-1">
                    <Label>{isRtl ? "الترتيب" : "Display Order"}</Label>
                    <Input type="number" value={visaFieldForm.display_order}
                      onChange={(e) => setVisaFieldForm(f => ({ ...f, display_order: e.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={createVisaField} disabled={visaFieldSaving}>
                    {visaFieldSaving ? "..." : t("common.save", "Save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {visaLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{isRtl ? "جار التحميل..." : "Loading..."}</div>
              ) : visaFields.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{isRtl ? "لا توجد حقول" : "No visa fields yet"}</div>
              ) : (
                <div className="divide-y divide-border">
                  {visaFields.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{isRtl ? f.label_ar : f.label_en}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{f.field_key}</span>
                          {" · "}
                          <span className="capitalize">{f.field_type}</span>
                          {f.is_required && (
                            <span className="ms-2 text-destructive">*{isRtl ? "إلزامي" : "required"}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ms-4 shrink-0">
                        <Switch checked={f.is_active} onCheckedChange={() => toggleVisaField(f.id, f.is_active)} />
                        <Button variant="ghost" size="icon" onClick={() => deleteVisaField(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Selective Data Reset ── */}
        <TabsContent value="reset" className="space-y-4 mt-4">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                {isRtl ? "⚠️ مسح البيانات" : "⚠️ Data Reset"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {isRtl
                  ? "اختر الفئات التي تريد حذفها. هذا الإجراء لا يمكن التراجع عنه."
                  : "Select data categories to delete. This action cannot be undone."}
              </p>

              {/* Step 1: Category selection */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {isRtl ? "اختر فئات البيانات:" : "Select data categories:"}
                </p>
                {RESET_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30">
                    <Checkbox
                      id={`reset-${cat.id}`}
                      checked={resetCategories.includes(cat.id)}
                      onCheckedChange={() => toggleResetCategory(cat.id)}
                    />
                    <Label htmlFor={`reset-${cat.id}`} className="cursor-pointer flex-1 text-sm">
                      {isRtl ? cat.labelAr : cat.labelEn}
                    </Label>
                    <span className="text-xs text-muted-foreground">{cat.tables.join(", ")}</span>
                  </div>
                ))}
              </div>

              {/* Step 2: Count preview */}
              {resetCategories.length > 0 && (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={loadRowCounts} disabled={countLoading} className="gap-2">
                    <Eye className="h-4 w-4" />
                    {countLoading
                      ? (isRtl ? "جار الحساب..." : "Counting...")
                      : (isRtl ? "معاينة عدد السجلات" : "Preview Record Count")}
                  </Button>

                  {Object.keys(rowCounts).length > 0 && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-1">
                      {Object.entries(rowCounts).map(([tbl, count]) => (
                        <p key={tbl} className="text-xs text-destructive/80">
                          <span className="font-mono font-semibold">{tbl}</span>: {count} {isRtl ? "سجل" : "records"}
                        </p>
                      ))}
                      <p className="text-sm font-semibold text-destructive pt-1 border-t border-destructive/30 mt-2">
                        {isRtl ? `الإجمالي: ${totalRowCount} سجل` : `Total: ${totalRowCount} records will be deleted`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Password + confirm */}
              {resetCategories.length > 0 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-destructive">
                      {isRtl ? "أدخل كلمة مرورك للتأكيد:" : "Enter your admin password to confirm:"}
                    </Label>
                    <Input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="••••••••"
                      className="border-destructive/50 focus:border-destructive"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    disabled={!resetPassword.trim() || resetting}
                    onClick={() => setShowFinalConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isRtl ? "حذف البيانات المحددة" : "Delete Selected Data"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Final confirmation dialog */}
      <AlertDialog open={showFinalConfirm} onOpenChange={setShowFinalConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              {isRtl ? "تأكيد نهائي — هل أنت متأكد؟" : "Final Confirmation — Are you absolutely sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRtl
                ? `سيتم حذف ${totalRowCount || "جميع"} سجل بشكل دائم من الفئات المختارة. لا يمكن التراجع.`
                : `${totalRowCount ? `${totalRowCount} records` : "Selected records"} will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDataReset}
              disabled={resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting
                ? (isRtl ? "جار الحذف..." : "Deleting...")
                : (isRtl ? "نعم، احذف" : "Yes, Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSettingsPage;
