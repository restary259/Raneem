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
  Edit,
  Copy,
  Search,
} from "lucide-react";
import CommissionSettingsPanel from "@/components/admin/CommissionSettingsPanel";
import PipelineStatusesPanel from "@/components/admin/PipelineStatusesPanel";
import ServiceCatalogPanel from "@/components/admin/ServiceCatalogPanel";


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
  address_ar?: string | null;
  address_en?: string | null;
  city?: string | null;
  source_url?: string | null;
  last_verified_at?: string | null;
  scope?: string;
  is_universal?: boolean;
  language_school_id?: string | null;
}

interface School {
  id: string;
  name_ar: string;
  name_en: string;
  city: string | null;
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

const CATEGORIES = ["emergency", "medical", "legal", "team", "language_school", "city_office", "immigration", "other"];
const FIELD_TYPES = ["text", "date", "select", "boolean"];
const CONTACT_SCOPES = ["universal", "school_city", "school_only", "city_only"];

// Data categories for selective reset.
// Deletion order within each category matters: child rows first, then parents.
// Tables that CASCADE-delete from a parent (e.g. case_submissions → cases) are
// handled automatically by Postgres and do NOT need to be listed separately.
const RESET_CATEGORIES = [
  {
    id: "cases",
    labelEn: "Cases & Submissions",
    labelAr: "الملفات والتقديمات",
    // case_service_snapshots.case_id → student_cases (not cases), so delete it first.
    // case_submissions cascades from cases, no need to list it explicitly.
    tables: ["case_service_snapshots", "cases"],
  },
  { id: "appointments", labelEn: "Appointments", labelAr: "المواعيد", tables: ["appointments"] },
  { id: "documents", labelEn: "Documents", labelAr: "المستندات", tables: ["documents"] },
  {
    id: "financial",
    labelEn: "Financial Records",
    labelAr: "السجلات المالية",
    // Delete payout_requests before rewards so linked_reward_ids refs are gone first.
    tables: ["payout_requests", "rewards", "commissions"],
  },
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
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  // Admin contacts tab filters / search.
  const [contactFilter, setContactFilter] = useState({
    school: "all", city: "all", category: "all", scope: "all", status: "all", search: "",
  });

  const emptyContactForm = {
    name_ar: "", name_en: "", role_ar: "", role_en: "",
    phone: "", email: "", link: "", category: "other", display_order: "0",
    address_ar: "", address_en: "", city: "", source_url: "", verified_today: true,
    scope: "universal", language_school_id: "",
  };
  const [contactForm, setContactForm] = useState<typeof emptyContactForm>(emptyContactForm);

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
      const [sRes, cRes, schRes] = await Promise.all([
        supabase.from("platform_settings").select("*").limit(1).single(),
        (supabase as any).from("important_contacts").select("*").order("display_order"),
        (supabase as any).from("schools").select("id,name_ar,name_en,city,is_active").order("name_en"),
      ]);
      if (sRes.data) setSettings(sRes.data);
      setContacts(cRes.data || []);
      setSchools((schRes.data as School[]) || []);
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

  // Build the targeting payload from the form, enforcing the scope rules so
  // the server CHECK constraints never reject the write:
  //  - universal: no school, no targeting city
  //  - school_only: school set, no targeting city
  //  - city_only: no school, city set
  //  - school_city: school + city set
  const buildContactPayload = () => {
    const scope = contactForm.scope;
    const isUniversal = scope === "universal";
    const needsSchool = scope === "school_only" || scope === "school_city";
    const needsCity = scope === "city_only" || scope === "school_city";
    return {
      name_ar: contactForm.name_ar,
      name_en: contactForm.name_en,
      role_ar: contactForm.role_ar || null,
      role_en: contactForm.role_en || null,
      phone: contactForm.phone || null,
      email: contactForm.email || null,
      link: contactForm.link || null,
      category: contactForm.category,
      display_order: Number(contactForm.display_order) || 0,
      address_ar: contactForm.address_ar || null,
      address_en: contactForm.address_en || null,
      city: needsCity ? (contactForm.city || null) : (isUniversal ? null : (scope === "school_only" ? null : (contactForm.city || null))),
      source_url: contactForm.source_url || null,
      last_verified_at: contactForm.verified_today ? new Date().toISOString() : null,
      scope,
      is_universal: isUniversal,
      language_school_id: needsSchool ? (contactForm.language_school_id || null) : null,
    } as any;
  };

  const validateContactForm = (): string | null => {
    if (!contactForm.name_ar || !contactForm.name_en)
      return t('admin.settings.nameRequired', 'Name is required');
    const scope = contactForm.scope;
    if ((scope === "school_only" || scope === "school_city") && !contactForm.language_school_id)
      return t('contacts.schoolLabel', 'Language school') + " — required";
    if ((scope === "city_only" || scope === "school_city") && !contactForm.city)
      return t('contacts.cityLabel', 'City') + " — required";
    return null;
  };

  const resetContactForm = () => {
    setContactForm(emptyContactForm);
    setEditingContactId(null);
  };

  const saveContact = async () => {
    const err = validateContactForm();
    if (err) {
      toast({ variant: "destructive", description: err });
      return;
    }
    setContactSaving(true);
    try {
      const payload = buildContactPayload();
      if (editingContactId) {
        const { error } = await (supabase as any).from("important_contacts").update(payload).eq("id", editingContactId);
        if (error) throw error;
        toast({ description: t('contacts.contactUpdated', 'Contact updated') });
      } else {
        const { error } = await (supabase as any).from("important_contacts").insert(payload);
        if (error) throw error;
        toast({ description: t('admin.settings.contactCreated', 'Contact created') });
      }
      resetContactForm();
      setContactOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setContactSaving(false);
    }
  };

  const openCreateContact = () => {
    resetContactForm();
    setContactOpen(true);
  };

  const openEditContact = (c: Contact) => {
    setEditingContactId(c.id);
    setContactForm({
      name_ar: c.name_ar, name_en: c.name_en,
      role_ar: c.role_ar || "", role_en: c.role_en || "",
      phone: c.phone || "", email: c.email || "", link: c.link || "",
      category: c.category, display_order: String(c.display_order ?? 0),
      address_ar: c.address_ar || "", address_en: c.address_en || "",
      city: c.city || "", source_url: c.source_url || "",
      verified_today: false,
      scope: c.scope || "universal",
      language_school_id: c.language_school_id || "",
    });
    setContactOpen(true);
  };

  const duplicateContact = async (c: Contact) => {
    setContactSaving(true);
    try {
      const { error } = await (supabase as any).from("important_contacts").insert({
        name_ar: c.name_ar, name_en: c.name_en,
        role_ar: c.role_ar, role_en: c.role_en,
        phone: c.phone, email: c.email, link: c.link, category: c.category,
        display_order: c.display_order,
        address_ar: c.address_ar ?? null, address_en: c.address_en ?? null,
        city: c.city ?? null, source_url: c.source_url ?? null,
        scope: c.scope || "universal",
        is_universal: (c.scope || "universal") === "universal",
        language_school_id: c.language_school_id ?? null,
      });
      if (error) throw error;
      await fetchData();
      toast({ description: t('contacts.contactDuplicated', 'Contact duplicated') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setContactSaving(false);
    }
  };

  const toggleContact = async (id: string, current: boolean) => {
    const { error } = await (supabase as any).from("important_contacts").update({ is_active: !current }).eq("id", id);
    if (error) toast({ variant: "destructive", description: error.message });
    else fetchData();
  };

  const deleteContact = async (id: string) => {
    const { error } = await (supabase as any).from("important_contacts").delete().eq("id", id);
    if (error) toast({ variant: "destructive", description: error.message });
    else fetchData();
  };

  const scopeLabel = (scope: string) => {
    const m: Record<string, string> = {
      universal: t('contacts.scopeUniversal', 'Universal'),
      school_city: t('contacts.scopeSchoolCity', 'School + City'),
      school_only: t('contacts.scopeSchoolOnly', 'School Only'),
      city_only: t('contacts.scopeCityOnly', 'City Only'),
    };
    return m[scope] ?? scope;
  };

  const schoolName = (id?: string | null) => {
    if (!id) return isRtl ? "—" : "—";
    const s = schools.find((x) => x.id === id);
    return s ? (isRtl ? s.name_ar : s.name_en) : id;
  };

  // Filtered + searched contacts for the admin list.
  const filteredContacts = contacts.filter((c) => {
    const f = contactFilter;
    if (f.school !== "all" && (c.language_school_id ?? "") !== f.school) return false;
    if (f.city !== "all" && (c.city ?? "") !== f.city) return false;
    if (f.category !== "all" && c.category !== f.category) return false;
    if (f.scope !== "all" && (c.scope ?? "universal") !== f.scope) return false;
    if (f.status !== "all" && (c.is_active ? "active" : "inactive") !== f.status) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = [c.name_ar, c.name_en, c.phone, c.email, c.category, c.city, c.scope].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const distinctCities = Array.from(new Set([...contacts.map((c) => c.city).filter(Boolean), ...schools.map((s) => s.city).filter(Boolean)])) as string[];

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

      // Tables come out in the correct child-first order defined in RESET_CATEGORIES.
      const selectedTables = RESET_CATEGORIES
        .filter(c => resetCategories.includes(c.id))
        .flatMap(c => c.tables);

      const errors: string[] = [];
      for (const table of selectedTables) {
        const { error: delErr } = await (supabase as any)
          .from(table)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) {
          console.error(`Failed to delete from ${table}:`, delErr);
          errors.push(table);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Failed to delete from: ${errors.join(", ")}`);
      }

      await supabase.rpc("log_user_activity" as any, {
        p_action: "SELECTIVE_DATA_PURGE",
        p_target_table: "system",
        p_details: `Selective purge: ${selectedTables.join(", ")} by ${user.email}`,
      });

      toast({
        title: t('admin.settings.purgeSuccess', '✅ Data deleted'),
        description: `${selectedTables.join(", ")} cleared successfully.`,
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
      legal: { en: "Legal", ar: "قانوني" }, team: { en: "Team", ar: "الفريق" },
      language_school: { en: "Language School", ar: "مدرسة لغة" },
      city_office: { en: "Citizen Services", ar: "خدمات المواطنين" },
      immigration: { en: "Immigration Authority", ar: "دائرة الهجرة" },
      other: { en: "Other", ar: "أخرى" },
    };
    return isRtl ? m[cat]?.ar : m[cat]?.en;
  };

  const totalRowCount = Object.values(rowCounts).reduce((a, b) => a + b, 0);

  if (loading)
    return <div className="p-8 text-center text-muted-foreground">{t('common.loading', 'Loading...')}</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.settings.title", "Settings")}</h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="platform">
        <TabsList className="flex-wrap w-full h-auto">
          <TabsTrigger value="platform">{t("admin.settings.platform", "Platform")}</TabsTrigger>
          <TabsTrigger value="commissions">
            <DollarSign className="h-3.5 w-3.5 me-1" />
            {t("admin.settings.commissions", "Commissions")}
          </TabsTrigger>
          <TabsTrigger value="pipeline">{t("admin.settings.pipeline.tab", "Pipeline stages")}</TabsTrigger>
          <TabsTrigger value="catalog">{t("admin.settings.catalog.tab", "Service catalog")}</TabsTrigger>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* ── Pipeline stages ── */}
        <TabsContent value="pipeline" className="mt-4">
          <PipelineStatusesPanel />
        </TabsContent>

        {/* ── Service catalog ── */}
        <TabsContent value="catalog" className="mt-4">
          <ServiceCatalogPanel />
        </TabsContent>




        {/* ── Important Contacts ── */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          <Dialog open={contactOpen} onOpenChange={(o) => { setContactOpen(o); if (!o) resetContactForm(); }}>
            <div className="flex justify-end">
              <Button size="sm" className="gap-2" onClick={openCreateContact}>
                <Plus className="h-4 w-4" />
                {t("admin.settings.addContact", "Add Contact")}
              </Button>
            </div>
            <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingContactId ? t('contacts.editContact', 'Edit Contact') : t("admin.settings.addContact", "Add Contact")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormArabicName')}</Label>
                    <Input value={contactForm.name_ar} onChange={(e) => setContactForm((f) => ({ ...f, name_ar: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormEnglishName')}</Label>
                    <Input value={contactForm.name_en} onChange={(e) => setContactForm((f) => ({ ...f, name_en: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormRoleAr')}</Label>
                    <Input value={contactForm.role_ar} onChange={(e) => setContactForm((f) => ({ ...f, role_ar: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormRoleEn')}</Label>
                    <Input value={contactForm.role_en} onChange={(e) => setContactForm((f) => ({ ...f, role_en: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormPhone')}</Label>
                    <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.settings.contactFormEmail')}</Label>
                    <Input value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t('admin.settings.contactFormLink')}</Label>
                  <Input value={contactForm.link} onChange={(e) => setContactForm((f) => ({ ...f, link: e.target.value }))} />
                </div>

                {/* ── Targeting scope ── */}
                <div className="rounded-md border border-border p-3 space-y-3">
                  <div className="space-y-1">
                    <Label>{t('contacts.scopeLabel', 'Targeting scope')}</Label>
                    <Select value={contactForm.scope} onValueChange={(v) => setContactForm((f) => ({ ...f, scope: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_SCOPES.map((s) => (<SelectItem key={s} value={s}>{scopeLabel(s)}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(contactForm.scope === "school_only" || contactForm.scope === "school_city") && (
                    <div className="space-y-1">
                      <Label>{t('contacts.schoolLabel', 'Language school')}</Label>
                      <Select value={contactForm.language_school_id || ""} onValueChange={(v) => {
                        const sch = schools.find((s) => s.id === v);
                        setContactForm((f) => ({ ...f, language_school_id: v, city: sch?.city ?? f.city }));
                      }}>
                        <SelectTrigger><SelectValue placeholder={t('contacts.allSchools', 'All schools')} /></SelectTrigger>
                        <SelectContent>
                          {schools.filter((s) => s.is_active).map((s) => (
                            <SelectItem key={s.id} value={s.id}>{isRtl ? s.name_ar : s.name_en}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {(contactForm.scope === "city_only" || contactForm.scope === "school_city") && (
                    <div className="space-y-1">
                      <Label>{t('contacts.cityLabel', 'City')}</Label>
                      <Input
                        list="contact-cities-datalist"
                        value={contactForm.city}
                        onChange={(e) => setContactForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="Heidelberg"
                      />
                      <datalist id="contact-cities-datalist">
                        {distinctCities.map((c) => (<option key={c} value={c} />))}
                      </datalist>
                    </div>
                  )}
                  {contactForm.scope === "universal" && (
                    <p className="text-xs text-muted-foreground">
                      {isRtl ? "جهة اتصال عامة تظهر لكل الطلاب." : "Universal contact — visible to every student."}
                    </p>
                  )}
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>{isRtl ? "العنوان (عربي)" : "Address (Arabic)"}</Label>
                    <Input value={contactForm.address_ar} onChange={(e) => setContactForm((f) => ({ ...f, address_ar: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{isRtl ? "العنوان (إنجليزي)" : "Address (English)"}</Label>
                    <Input value={contactForm.address_en} onChange={(e) => setContactForm((f) => ({ ...f, address_en: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{isRtl ? "رابط المصدر الرسمي" : "Official source URL"}</Label>
                  <Input value={contactForm.source_url} onChange={(e) => setContactForm((f) => ({ ...f, source_url: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label className="text-sm">{isRtl ? "تم التحقق اليوم" : "Mark verified today"}</Label>
                  <Switch checked={contactForm.verified_today} onCheckedChange={(v) => setContactForm((f) => ({ ...f, verified_today: v }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t('admin.settings.contactFormOrder')}</Label>
                  <Input type="number" value={contactForm.display_order}
                    onChange={(e) => setContactForm((f) => ({ ...f, display_order: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={saveContact} disabled={contactSaving}>
                  {contactSaving ? t('admin.settings.saving') : t("common.save")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Filters + search ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
              <Search className="absolute top-1/2 -translate-y-1/2 start-2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-8"
                placeholder={t('contacts.search', 'Search…')}
                value={contactFilter.search}
                onChange={(e) => setContactFilter((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <Select value={contactFilter.scope} onValueChange={(v) => setContactFilter((f) => ({ ...f, scope: v }))}>
              <SelectTrigger><SelectValue placeholder={t('contacts.filterScope', 'Scope')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filterScope', 'Scope')}</SelectItem>
                {CONTACT_SCOPES.map((s) => (<SelectItem key={s} value={s}>{scopeLabel(s)}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={contactFilter.school} onValueChange={(v) => setContactFilter((f) => ({ ...f, school: v }))}>
              <SelectTrigger><SelectValue placeholder={t('contacts.filterSchool', 'School')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filterSchool', 'School')}</SelectItem>
                {schools.map((s) => (<SelectItem key={s.id} value={s.id}>{isRtl ? s.name_ar : s.name_en}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={contactFilter.city} onValueChange={(v) => setContactFilter((f) => ({ ...f, city: v }))}>
              <SelectTrigger><SelectValue placeholder={t('contacts.filterCity', 'City')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filterCity', 'City')}</SelectItem>
                {distinctCities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={contactFilter.category} onValueChange={(v) => setContactFilter((f) => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder={t('contacts.filterCategory', 'Category')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filterCategory', 'Category')}</SelectItem>
                {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={contactFilter.status} onValueChange={(v) => setContactFilter((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue placeholder={t('contacts.filterStatus', 'Status')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contacts.filterStatus', 'Status')}</SelectItem>
                <SelectItem value="active">{t('contacts.statusActive', 'Active')}</SelectItem>
                <SelectItem value="inactive">{t('contacts.statusInactive', 'Inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {contacts.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t('admin.settings.noContacts')}</p>
              ) : filteredContacts.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{isRtl ? "لا توجد نتائج للفلتر الحالي." : "No contacts match the current filters."}</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredContacts.map((c) => (
                    <div key={c.id} className="flex items-start justify-between p-4 gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{isRtl ? c.name_ar : c.name_en}</p>
                          <Badge variant="outline" className="text-[10px] font-normal">{scopeLabel(c.scope || "universal")}</Badge>
                          {!c.is_active && <Badge variant="secondary" className="text-[10px]">{t('contacts.statusInactive', 'Inactive')}</Badge>}
                        </div>
                        {(isRtl ? c.role_ar : c.role_en) && (
                          <p className="text-xs text-muted-foreground">{isRtl ? c.role_ar : c.role_en}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {[
                            (c.scope === "school_only" || c.scope === "school_city") ? schoolName(c.language_school_id) : null,
                            (c.scope === "city_only" || c.scope === "school_city") ? c.city : null,
                          ].filter(Boolean).join(" — ") || (isRtl ? "كل الطلاب" : "All students")}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          {c.phone && (<a href={`tel:${c.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="h-3 w-3" />{c.phone}</a>)}
                          {c.email && (<a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline"><Mail className="h-3 w-3" />{c.email}</a>)}
                          {c.link && (<a href={c.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><LinkIcon className="h-3 w-3" />Link</a>)}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {catLabel(c.category)} · #{c.display_order}
                        </p>
                        {c.last_verified_at && (
                          <p className="text-[11px] text-muted-foreground">
                            {(isRtl ? "تم التحقق: " : "Verified: ") + new Date(c.last_verified_at).toLocaleDateString('en-US')}
                            {c.source_url && (<> · <a href={c.source_url} target="_blank" rel="noreferrer" className="underline">{isRtl ? "المصدر" : "source"}</a></>)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ms-4 shrink-0">
                        <Button variant="ghost" size="icon" aria-label={t('contacts.edit', 'Edit')} onClick={() => openEditContact(c)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t('contacts.duplicate', 'Duplicate')} onClick={() => duplicateContact(c)} disabled={contactSaving}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Switch checked={c.is_active} onCheckedChange={() => toggleContact(c.id, c.is_active)} />
                        <Button variant="ghost" size="icon" aria-label={isRtl ? "حذف جهة الاتصال" : "Delete contact"} onClick={() => deleteContact(c.id)}>
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
              <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isRtl ? "حقل جديد" : "New Visa Field"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label>{isRtl ? "مفتاح الحقل (فريد)" : "Field Key (unique)"}</Label>
                    <Input value={visaFieldForm.field_key} placeholder="e.g. visa_status"
                      onChange={(e) => setVisaFieldForm(f => ({ ...f, field_key: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <Button variant="ghost" size="icon" aria-label={isRtl ? "حذف الحقل" : "Delete field"} onClick={() => deleteVisaField(f.id)}>
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
                  <div key={cat.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg hover:bg-muted/30">
                    <Checkbox
                      id={`reset-${cat.id}`}
                      checked={resetCategories.includes(cat.id)}
                      onCheckedChange={() => toggleResetCategory(cat.id)}
                    />
                    <Label htmlFor={`reset-${cat.id}`} className="cursor-pointer flex-1 text-sm min-w-0">
                      {isRtl ? cat.labelAr : cat.labelEn}
                    </Label>
                    <span className="text-xs text-muted-foreground break-all w-full ps-6 sm:w-auto sm:break-normal sm:ps-0">{cat.tables.join(", ")}</span>
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
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
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
