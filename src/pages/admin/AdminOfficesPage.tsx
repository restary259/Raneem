import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock3, MapPin, Plus, Save, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import OfficeGoogleBusinessSection from "@/components/admin/OfficeGoogleBusinessSection";
import GoogleBusinessConnectionPanel from "@/components/admin/GoogleBusinessConnectionPanel";

type OfficeType = "darb" | "partner" | "franchise";
type TeamMember = { id: string; full_name: string };
type OfficeMember = { id: string; office_id: string; user_id: string; membership_type: string; is_primary: boolean; is_active: boolean; priority: number };
type DayHours = { office_id?: string; weekday: number; is_open: boolean; open_time: string; close_time: string };
type RoutingRule = { id?: string; office_id?: string; service_type: string; assigned_user_id: string; priority: number; is_active: boolean };
type Office = {
  id: string; name_ar: string; name_en: string; name_he: string; slug: string; office_code: string | null;
  office_type: OfficeType; country: string; city: string; address_line_1: string | null; phone: string | null;
  email: string | null; map_url: string | null; timezone: string; booking_enabled: boolean; is_active: boolean; display_order: number;
};

const DAYS = [
  [0, "Sunday"], [1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"],
] as const;

const SERVICE_TYPES = [
  ["consultation", "Consultation"],
  ["university_application", "University applications"],
  ["language", "Language"],
  ["visa", "Visa"],
  ["accommodation", "Accommodation"],
] as const;

const makeHours = (): DayHours[] => DAYS.map(function (entry) {
  const weekday = entry[0];
  return { weekday: weekday, is_open: weekday <= 4, open_time: "10:00", close_time: "17:00" };
});

const makeForm = () => ({
  id: "",
  name_ar: "",
  name_en: "",
  name_he: "",
  slug: "",
  office_code: "",
  office_type: "darb" as OfficeType,
  country: "IL",
  city: "",
  address_line_1: "",
  phone: "",
  email: "",
  map_url: "",
  timezone: "Asia/Jerusalem",
  booking_enabled: false,
  is_active: true,
  display_order: 1,
  primary_user_id: "",
  backup_user_id: "",
  slot_interval_minutes: 30,
  default_duration_minutes: 60,
  minimum_lead_minutes: 120,
  maximum_days_ahead: 14,
  hours: makeHours(),
  routingRules: [] as RoutingRule[],
});

function localizedOfficeName(office: Office, language: string) {
  if (language.startsWith("ar")) return office.name_ar;
  if (language.startsWith("he")) return office.name_he || office.name_en;
  return office.name_en;
}

export default function AdminOfficesPage() {
  const { i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const language = i18n.language;
  const isRtl = language === "ar" || language === "he";

  const labels = useMemo(function () {
    if (language.startsWith("ar")) {
      return {
        title: "مكاتب درب", add: "إضافة مكتب", edit: "إدارة المكتب",
        save: "حفظ", cancel: "إلغاء", general: "بيانات المكتب", team: "الفريق المسؤول", booking: "إعدادات الحجز", hours: "ساعات العمل",
        routing: "توجيه الخدمات", primary: "عضو الفريق الأساسي", backup: "عضو احتياط", noMember: "غير محدد", active: "نشط",
        inactive: "غير نشط", enabled: "مفعّل", disabled: "غير مفعّل", city: "المدينة", address: "العنوان", phone: "الهاتف",
        type: "نوع المكتب", timezone: "المنطقة الزمنية", nameAr: "الاسم بالعربي", nameEn: "الاسم بالإنجليزي", nameHe: "الاسم بالعبرية",
        slug: "الرابط", code: "رمز المكتب", bookingEnabled: "السماح بالحجز", interval: "الفاصل (دقيقة)", duration: "مدة الموعد (دقيقة)",
        lead: "أقل مدة قبل الحجز (دقيقة)", horizon: "أقصى أيام للحجز", closed: "مغلق", open: "مفتوح", service: "الخدمة", member: "عضو الفريق",
        addRule: "إضافة توجيه", none: "لا توجد قواعد إضافية", warning: "لتفعيل الحجز يجب اختيار عضو فريق أساسي.",
        partner: "شريك", franchise: "فرانشايز", darb: "DARB", invalid: "يرجى تعبئة اسم المكتب والمدينة.", samePerson: "يجب أن يكون العضو الاحتياط مختلفاً عن العضو الأساسي.", saved: "تم حفظ المكتب",
      };
    }
    if (language.startsWith("he")) {
      return {
        title: "משרדי DARB", add: "הוספת משרד", edit: "ניהול משרד",
        save: "שמירה", cancel: "ביטול", general: "פרטי המשרד", team: "הצוות האחראי", booking: "הגדרות הזמנה", hours: "שעות פעילות",
        routing: "ניתוב שירותים", primary: "חבר צוות ראשי", backup: "חבר גיבוי", noMember: "לא מוגדר", active: "פעיל",
        inactive: "לא פעיל", enabled: "מופעל", disabled: "מושבת", city: "עיר", address: "כתובת", phone: "טלפון",
        type: "סוג משרד", timezone: "אזור זמן", nameAr: "שם בערבית", nameEn: "שם באנגלית", nameHe: "שם בעברית",
        slug: "Slug", code: "קוד משרד", bookingEnabled: "אפשר הזמנות", interval: "מרווח (דקות)", duration: "משך (דקות)",
        lead: "מינימום לפני הזמנה (דקות)", horizon: "מקסימום ימים קדימה", closed: "סגור", open: "פתוח", service: "שירות", member: "חבר צוות",
        addRule: "הוספת ניתוב", none: "אין כללי ניתוב נוספים", warning: "יש לבחור חבר צוות ראשי לפני הפעלת הזמנות.",
        partner: "שותף", franchise: "זכיין", darb: "DARB", invalid: "יש למלא שם משרד ועיר.", samePerson: "חבר הגיבוי חייב להיות שונה מהחבר הראשי.", saved: "המשרד נשמר",
      };
    }
    return {
      title: "DARB Offices", add: "Add office", edit: "Manage office",
      save: "Save", cancel: "Cancel", general: "Office details", team: "Responsible team", booking: "Booking settings", hours: "Working hours",
      routing: "Service routing", primary: "Primary team member", backup: "Backup member", noMember: "Not assigned", active: "Active",
      inactive: "Inactive", enabled: "Enabled", disabled: "Disabled", city: "City", address: "Address", phone: "Phone",
      type: "Office type", timezone: "Timezone", nameAr: "Arabic name", nameEn: "English name", nameHe: "Hebrew name",
      slug: "Public slug", code: "Office code", bookingEnabled: "Enable booking", interval: "Slot interval (minutes)", duration: "Default duration (minutes)",
      lead: "Minimum lead time (minutes)", horizon: "Maximum days ahead", closed: "Closed", open: "Open", service: "Service", member: "Team member",
      addRule: "Add routing rule", none: "No additional routing rules", warning: "Select a primary team member before enabling booking.",
      partner: "Partner", franchise: "Franchise", darb: "DARB", invalid: "Office name and city are required.", samePerson: "Backup member must be different from the primary member.", saved: "Office saved",
    };
  }, [language]);

  const [offices, setOffices] = useState<Office[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [hours, setHours] = useState<DayHours[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(makeForm());

  const load = useCallback(async function () {
    setLoading(true);
    try {
      const results = await Promise.all([
        (supabase.from as any)("offices").select("*").is("deleted_at", null).order("display_order").order("name_en"),
        (supabase.from as any)("office_members").select("*"),
        (supabase.rpc as any)("list_office_team_members"),
        (supabase.from as any)("office_hours").select("*").order("weekday"),
        (supabase.from as any)("office_routing_rules").select("*").order("priority"),
        (supabase.from as any)("office_booking_settings").select("*"),
      ]);
      const officeRes = results[0], memberRes = results[1], teamRes = results[2], hourRes = results[3], ruleRes = results[4], settingsRes = results[5];
      if (officeRes.error) throw officeRes.error;
      if (memberRes.error) throw memberRes.error;
      if (teamRes.error) throw teamRes.error;
      if (hourRes.error) throw hourRes.error;
      if (ruleRes.error) throw ruleRes.error;
      if (settingsRes.error) throw settingsRes.error;
      setOffices((officeRes.data || []) as Office[]);
      setMembers((memberRes.data || []) as OfficeMember[]);
      setTeamMembers((teamRes.data || []) as TeamMember[]);
      setHours((hourRes.data || []) as DayHours[]);
      setRules((ruleRes.data || []) as RoutingRule[]);
      const map: Record<string, number> = {};
      (settingsRes.data || []).forEach(function (s: any) {
        map[s.office_id + ":interval"] = Number(s.slot_interval_minutes);
        map[s.office_id + ":duration"] = Number(s.default_duration_minutes);
        map[s.office_id + ":lead"] = Number(s.minimum_lead_minutes);
        map[s.office_id + ":horizon"] = Number(s.maximum_days_ahead);
      });
      setSettings(map);
    } catch (error: any) {
      toast({ variant: "destructive", description: error && error.message ? error.message : "Failed to load offices" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(function () { load(); }, [load]);

  function setField(key: string, value: any) {
    setForm(function (previous) { return Object.assign({}, previous, { [key]: value }); });
  }

  function openCreate() {
    const next = makeForm();
    next.display_order = offices.length + 1;
    setForm(next);
    setDialogOpen(true);
  }

  function openEdit(office: Office) {
    const currentMembers = members.filter(function (m) { return m.office_id === office.id && m.is_active; });
    const primary = currentMembers.find(function (m) { return m.is_primary; });
    const backup = currentMembers.find(function (m) { return !m.is_primary && m.membership_type === "backup"; });
    const officeHours = DAYS.map(function (entry) {
      const weekday = entry[0];
      return hours.find(function (h) { return h.office_id === office.id && h.weekday === weekday; }) || { office_id: office.id, weekday: weekday, is_open: false, open_time: "10:00", close_time: "17:00" };
    });
    setForm({
      id: office.id,
      name_ar: office.name_ar, name_en: office.name_en, name_he: office.name_he, slug: office.slug,
      office_code: office.office_code || "", office_type: office.office_type, country: office.country, city: office.city,
      address_line_1: office.address_line_1 || "", phone: office.phone || "", email: office.email || "", map_url: office.map_url || "",
      timezone: office.timezone, booking_enabled: office.booking_enabled, is_active: office.is_active, display_order: office.display_order,
      primary_user_id: primary ? primary.user_id : "", backup_user_id: backup ? backup.user_id : "",
      slot_interval_minutes: settings[office.id + ":interval"] || 30,
      default_duration_minutes: settings[office.id + ":duration"] || 60,
      minimum_lead_minutes: settings[office.id + ":lead"] || 120,
      maximum_days_ahead: settings[office.id + ":horizon"] || 14,
      hours: officeHours,
      routingRules: rules.filter(function (r) { return r.office_id === office.id; }).map(function (r) {
        return { id: r.id, office_id: office.id, service_type: r.service_type, assigned_user_id: r.assigned_user_id, priority: r.priority, is_active: r.is_active };
      }),
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name_ar.trim() || !form.name_en.trim() || !form.city.trim()) {
      toast({ variant: "destructive", description: labels.invalid });
      return;
    }
    if (form.booking_enabled && !form.primary_user_id) {
      toast({ variant: "destructive", description: labels.warning });
      return;
    }
    if (form.primary_user_id && form.backup_user_id && form.primary_user_id === form.backup_user_id) {
      toast({ variant: "destructive", description: labels.samePerson });
      return;
    }

    setSaving(true);
    try {
      const slug = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")
        || form.name_en.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
      const officePayload = {
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim(),
        name_he: form.name_he.trim(),
        slug: slug,
        office_code: form.office_code.trim() || null,
        office_type: form.office_type,
        country: form.country.trim() || "IL",
        city: form.city.trim(),
        address_line_1: form.address_line_1.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        map_url: form.map_url.trim() || null,
        timezone: form.timezone.trim() || "Asia/Jerusalem",
        booking_enabled: form.booking_enabled,
        is_active: form.is_active,
        display_order: Number(form.display_order) || 0,
      };

      const { error } = await (supabase.rpc as any)("save_office_configuration", {
        p_office_id: form.id || null,
        p_office: officePayload,
        p_settings: {
          slot_interval_minutes: Number(form.slot_interval_minutes),
          default_duration_minutes: Number(form.default_duration_minutes),
          minimum_lead_minutes: Number(form.minimum_lead_minutes),
          maximum_days_ahead: Number(form.maximum_days_ahead),
        },
        p_hours: form.hours.map(function (h) {
          return {
            weekday: h.weekday,
            is_open: h.is_open,
            open_time: h.is_open ? h.open_time : null,
            close_time: h.is_open ? h.close_time : null,
          };
        }),
        p_primary_user_id: form.primary_user_id || null,
        p_backup_user_id: form.backup_user_id || null,
        p_routing_rules: form.routingRules.filter(function (rule) {
          return Boolean(rule.service_type && rule.assigned_user_id);
        }).map(function (rule) {
          return {
            service_type: rule.service_type,
            assigned_user_id: rule.assigned_user_id,
            priority: Number(rule.priority) || 100,
            is_active: Boolean(rule.is_active),
          };
        }),
      });

      if (error) throw error;

      toast({ description: labels.saved });
      setDialogOpen(false);
      await load();
    } catch (error: any) {
      toast({ variant: "destructive", description: error && error.message ? error.message : "Failed to save office" });
    } finally {
      setSaving(false);
    }
  }

  const cards = useMemo(function () {
    return offices.map(function (office) {
      const primary = members.find(function (m) { return m.office_id === office.id && m.is_active && m.is_primary; });
      const primaryName = primary ? (teamMembers.find(function (m) { return m.id === primary.user_id; }) || { full_name: labels.noMember }).full_name : labels.noMember;
      return { office: office, primaryName: primaryName };
    });
  }, [offices, members, teamMembers, labels.noMember]);

  function memberName(id: string) {
    const found = teamMembers.find(function (m) { return m.id === id; });
    return found ? found.full_name : id;
  }

  function serviceLabel(serviceType: string) {
    const map: Record<string, string> = language.startsWith("ar")
      ? {
          consultation: "استشارة",
          university_application: "تقديم جامعي",
          language: "لغة",
          visa: "فيزا",
          accommodation: "سكن",
        }
      : language.startsWith("he")
        ? {
            consultation: "ייעוץ",
            university_application: "הרשמה לאוניברסיטה",
            language: "שפה",
            visa: "ויזה",
            accommodation: "מגורים",
          }
        : {
            consultation: "Consultation",
            university_application: "University applications",
            language: "Language",
            visa: "Visa",
            accommodation: "Accommodation",
          };
    return map[serviceType] ?? serviceType;
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{language.startsWith("ar") ? "جاري التحميل…" : language.startsWith("he") ? "טוען…" : "Loading…"}</div>;

  return (
    <div className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-end gap-3"><h1 className="sr-only">{labels.title}</h1>
        <Button onClick={openCreate}><Plus className="me-2 size-4" />{labels.add}</Button>
      </div>

      <GoogleBusinessConnectionPanel />

      <div className="grid gap-4 xl:grid-cols-2">
        {cards.map(function (item) {
          const office = item.office;
          return (
            <Card key={office.id} className="rounded-2xl border-border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{localizedOfficeName(office, language)}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{office.office_type === "partner" ? labels.partner : office.office_type === "franchise" ? labels.franchise : labels.darb}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={office.is_active ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700" : "rounded-full bg-muted px-2.5 py-1 text-muted-foreground"}>{office.is_active ? labels.active : labels.inactive}</span>
                    <span className={office.booking_enabled ? "rounded-full bg-blue-50 px-2.5 py-1 text-blue-700" : "rounded-full bg-muted px-2.5 py-1 text-muted-foreground"}>{office.booking_enabled ? labels.enabled : labels.disabled}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /><div><div className="text-xs text-muted-foreground">{labels.city}</div><div className="font-medium">{office.city}</div></div></div>
                  <div className="flex items-start gap-2 text-sm"><Users className="mt-0.5 size-4 shrink-0 text-primary" /><div><div className="text-xs text-muted-foreground">{labels.primary}</div><div className="font-medium">{item.primaryName}</div></div></div>
                </div>
                <Button variant="outline" className="w-full" onClick={function () { openEdit(office); }}>{labels.edit}<ChevronRight className={isRtl ? "ms-auto size-4 rotate-180" : "ms-auto size-4"} /></Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{form.id ? labels.edit : labels.add}</DialogTitle></DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{labels.general}</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div><Label>{labels.nameAr}</Label><Input value={form.name_ar} onChange={function (e) { setField("name_ar", e.target.value); }} /></div>
                <div><Label>{labels.nameEn}</Label><Input value={form.name_en} onChange={function (e) { setField("name_en", e.target.value); }} /></div>
                <div><Label>{labels.nameHe}</Label><Input value={form.name_he} onChange={function (e) { setField("name_he", e.target.value); }} /></div>
                <div><Label>{labels.slug}</Label><Input value={form.slug} onChange={function (e) { setField("slug", e.target.value); }} /></div>
                <div><Label>{labels.code}</Label><Input value={form.office_code} onChange={function (e) { setField("office_code", e.target.value.toUpperCase()); }} /></div>
                <div><Label>{labels.type}</Label><Select value={form.office_type} onValueChange={function (v) { setField("office_type", v as OfficeType); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="darb">{labels.darb}</SelectItem><SelectItem value="partner">{labels.partner}</SelectItem><SelectItem value="franchise">{labels.franchise}</SelectItem></SelectContent></Select></div>
                <div><Label>{labels.city}</Label><Input value={form.city} onChange={function (e) { setField("city", e.target.value); }} /></div>
                <div className="md:col-span-2"><Label>{labels.address}</Label><Input value={form.address_line_1} onChange={function (e) { setField("address_line_1", e.target.value); }} /></div>
                <div><Label>{labels.phone}</Label><Input value={form.phone} onChange={function (e) { setField("phone", e.target.value); }} /></div>
                <div className="md:col-span-2"><Label>{labels.timezone}</Label><Input value={form.timezone} onChange={function (e) { setField("timezone", e.target.value); }} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-border p-3"><span className="text-sm font-medium">{labels.active}</span><Switch checked={form.is_active} onCheckedChange={function (v) { setField("is_active", v); }} /></div>
                <div className="flex items-center justify-between rounded-xl border border-border p-3"><span className="text-sm font-medium">{labels.bookingEnabled}</span><Switch checked={form.booking_enabled} onCheckedChange={function (v) { setField("booking_enabled", v); }} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{labels.team}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label>{labels.primary}</Label><Select value={form.primary_user_id || "none"} onValueChange={function (v) { setField("primary_user_id", v === "none" ? "" : v); }}><SelectTrigger><SelectValue placeholder={labels.noMember} /></SelectTrigger><SelectContent><SelectItem value="none">{labels.noMember}</SelectItem>{teamMembers.map(function (m) { return <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>; })}</SelectContent></Select></div>
                <div><Label>{labels.backup}</Label><Select value={form.backup_user_id || "none"} onValueChange={function (v) { setField("backup_user_id", v === "none" ? "" : v); }}><SelectTrigger><SelectValue placeholder={labels.noMember} /></SelectTrigger><SelectContent><SelectItem value="none">{labels.noMember}</SelectItem>{teamMembers.filter(function (m) { return m.id !== form.primary_user_id; }).map(function (m) { return <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>; })}</SelectContent></Select></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{labels.booking}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><Label>{labels.interval}</Label><Input type="number" min={5} max={120} value={form.slot_interval_minutes} onChange={function (e) { setField("slot_interval_minutes", Number(e.target.value)); }} /></div>
                <div><Label>{labels.duration}</Label><Input type="number" min={15} max={240} value={form.default_duration_minutes} onChange={function (e) { setField("default_duration_minutes", Number(e.target.value)); }} /></div>
                <div><Label>{labels.lead}</Label><Input type="number" min={0} value={form.minimum_lead_minutes} onChange={function (e) { setField("minimum_lead_minutes", Number(e.target.value)); }} /></div>
                <div><Label>{labels.horizon}</Label><Input type="number" min={1} max={90} value={form.maximum_days_ahead} onChange={function (e) { setField("maximum_days_ahead", Number(e.target.value)); }} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{labels.hours}</h3>
              <div className="grid gap-2">
                {form.hours.map(function (day) {
                  const dayName = DAYS[day.weekday][1];
                  return <div key={day.weekday} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 rounded-xl border border-border p-3">
                    <div className="w-28 text-sm font-medium">{dayName}</div>
                    <button type="button" className={day.is_open ? "rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary" : "rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"} onClick={function () { setField("hours", form.hours.map(function (h) { return h.weekday === day.weekday ? Object.assign({}, h, { is_open: !h.is_open }) : h; })); }}>{day.is_open ? labels.open : labels.closed}</button>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2"><Input type="time" value={day.open_time} disabled={!day.is_open} onChange={function (e) { setField("hours", form.hours.map(function (h) { return h.weekday === day.weekday ? Object.assign({}, h, { open_time: e.target.value }) : h; })); }} /><Input type="time" value={day.close_time} disabled={!day.is_open} onChange={function (e) { setField("hours", form.hours.map(function (h) { return h.weekday === day.weekday ? Object.assign({}, h, { close_time: e.target.value }) : h; })); }} /></div>
                  </div>;
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{labels.routing}</h3><Button type="button" size="sm" variant="outline" onClick={function () { setField("routingRules", form.routingRules.concat([{ service_type: SERVICE_TYPES[0][0], assigned_user_id: form.primary_user_id || form.backup_user_id, priority: 10 + form.routingRules.length, is_active: true }])); }}><Plus className="me-2 size-4" />{labels.addRule}</Button></div>
              {form.routingRules.length ? form.routingRules.map(function (rule, index) {
                const memberChoices = [form.primary_user_id, form.backup_user_id].filter(Boolean);
                return <div key={rule.id || index} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                  <Select value={rule.service_type} onValueChange={function (v) { setField("routingRules", form.routingRules.map(function (r, i) { return i === index ? Object.assign({}, r, { service_type: v }) : r; })); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERVICE_TYPES.map(function (entry) { return <SelectItem key={entry[0]} value={entry[0]}>{serviceLabel(entry[0])}</SelectItem>; })}</SelectContent></Select>
                  <Select value={rule.assigned_user_id || "none"} onValueChange={function (v) { setField("routingRules", form.routingRules.map(function (r, i) { return i === index ? Object.assign({}, r, { assigned_user_id: v === "none" ? "" : v }) : r; })); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{labels.noMember}</SelectItem>{memberChoices.map(function (id) { return <SelectItem key={id} value={id}>{memberName(id)}</SelectItem>; })}</SelectContent></Select>
                  <Input className="md:w-24" type="number" min={1} value={rule.priority} onChange={function (e) { setField("routingRules", form.routingRules.map(function (r, i) { return i === index ? Object.assign({}, r, { priority: Number(e.target.value) }) : r; })); }} />
                  <Button type="button" variant="ghost" size="icon" onClick={function () { setField("routingRules", form.routingRules.filter(function (_, i) { return i !== index; })); }} aria-label="Remove rule"><X className="size-4" /></Button>
                </div>;
              }) : <p className="text-sm text-muted-foreground">{labels.none}</p>}
            </section>

            {form.id ? (
              <section className="space-y-3">
                <OfficeGoogleBusinessSection
                  officeId={form.id}
                  isAdmin
                  eligibleMembers={members
                    .filter(function (m) { return m.office_id === form.id && m.is_active; })
                    .map(function (m) { return { id: m.user_id, full_name: memberName(m.user_id) }; })}
                  onChanged={load}
                />
              </section>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={function () { setDialogOpen(false); }} disabled={saving}>{labels.cancel}</Button>
            <Button onClick={save} disabled={saving || (form.booking_enabled && !form.primary_user_id)}>{saving ? <Clock3 className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}{labels.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
