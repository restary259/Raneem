import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  RefreshCw,
  BookOpen,
  Home,
  Clock,
  BadgeCheck,
  Pause,
  Play,
  Pencil,
  Building2,
  Shield,
} from "lucide-react";

interface Program {
  id: string;
  name_ar: string;
  name_en: string;
  type: string;
  price: number | null;
  currency: string;
  duration: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  lessons_per_week: number | null;
  duration_in_months: number | null;
  fixed_start_day_of_month: number | null;
}
interface School {
  id: string;
  name_en: string;
  name_ar: string;
  city: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
}
interface Accommodation {
  id: string;
  name_ar: string;
  name_en: string;
  price: number | null;
  currency: string;
  description: string | null;
  is_active: boolean;
  school_id: string | null;
}
interface Insurance {
  id: string;
  name: string;
  tier: string;
  price: number;
  currency: string;
  is_active: boolean;
}

const PROGRAM_TYPES = ["language_school", "course", "university", "other"];
const INSURANCE_TIERS = ["basic", "standard", "premium"];

// Bypass Supabase generated types for new tables/columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase as unknown as any;

const AdminProgramsPage = () => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [progOpen, setProgOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [accomOpen, setAccomOpen] = useState(false);
  const [insOpen, setInsOpen] = useState(false);

  const [editProgId, setEditProgId] = useState<string | null>(null);
  const [editSchoolId, setEditSchoolId] = useState<string | null>(null);
  const [editAccomId, setEditAccomId] = useState<string | null>(null);
  const [editInsId, setEditInsId] = useState<string | null>(null);

  const emptyProgForm = {
    name_ar: "",
    name_en: "",
    type: "language_school",
    price: "",
    currency: "EUR",
    duration: "",
    description: "",
    lessons_per_week: "",
    duration_in_months: "",
    fixed_start_day_of_month: "",
  };
  const [progForm, setProgForm] = useState(emptyProgForm);
  const [schoolForm, setSchoolForm] = useState({ name_ar: "", name_en: "", city: "", country: "Germany" });
  const [accomForm, setAccomForm] = useState({
    name_ar: "",
    name_en: "",
    price: "",
    currency: "EUR",
    description: "",
    school_id: "",
  });
  const [insForm, setInsForm] = useState({ name: "", tier: "standard", price: "", currency: "EUR" });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = (await Promise.all([
        db.from("programs").select("*").order("created_at", { ascending: false }),
        db.from("schools").select("*").order("name_en"),
        db.from("accommodations").select("*").order("name_en"),
        db.from("insurances").select("*").order("tier"),
      ])) as any[];
      setPrograms((results[0].data ?? []) as Program[]);
      setSchools((results[1].data ?? []) as School[]);
      setAccommodations((results[2].data ?? []) as Accommodation[]);
      setInsurances((results[3].data ?? []) as Insurance[]);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveProgram = async () => {
    if (!progForm.name_en) {
      toast({ variant: "destructive", description: t('admin.programs.nameRequired') });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name_ar: progForm.name_ar,
        name_en: progForm.name_en,
        type: progForm.type,
        price: progForm.price ? Number(progForm.price) : null,
        currency: progForm.currency,
        duration: progForm.duration || null,
        description: progForm.description || null,
        lessons_per_week: progForm.lessons_per_week ? Number(progForm.lessons_per_week) : null,
        duration_in_months: progForm.duration_in_months ? Number(progForm.duration_in_months) : null,
        fixed_start_day_of_month: progForm.fixed_start_day_of_month ? Number(progForm.fixed_start_day_of_month) : null,
      };
      if (editProgId) await db.from("programs").update(payload).eq("id", editProgId);
      else await db.from("programs").insert(payload);
      setProgOpen(false);
      setEditProgId(null);
      setProgForm(emptyProgForm);
      await fetchAll();
      toast({ description: editProgId ? t('admin.programs.programUpdated') : t('admin.programs.programCreated') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const saveSchool = async () => {
    if (!schoolForm.name_en) {
      toast({ variant: "destructive", description: t('admin.programs.nameRequired') });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name_en: schoolForm.name_en,
        name_ar: schoolForm.name_ar,
        city: schoolForm.city || null,
        country: schoolForm.country,
      };
      if (editSchoolId) await db.from("schools").update(payload).eq("id", editSchoolId);
      else await db.from("schools").insert(payload);
      setSchoolOpen(false);
      setEditSchoolId(null);
      setSchoolForm({ name_ar: "", name_en: "", city: "", country: "Germany" });
      await fetchAll();
      toast({ description: editSchoolId ? t('admin.programs.schoolUpdated') : t('admin.programs.schoolCreated') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const saveAccom = async () => {
    if (!accomForm.name_en) {
      toast({ variant: "destructive", description: t('admin.programs.nameRequired') });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name_ar: accomForm.name_ar,
        name_en: accomForm.name_en,
        price: accomForm.price ? Number(accomForm.price) : null,
        currency: accomForm.currency,
        description: accomForm.description || null,
        school_id: accomForm.school_id || null,
      };
      if (editAccomId) await db.from("accommodations").update(payload).eq("id", editAccomId);
      else await db.from("accommodations").insert(payload);
      setAccomOpen(false);
      setEditAccomId(null);
      setAccomForm({ name_ar: "", name_en: "", price: "", currency: "EUR", description: "", school_id: "" });
      await fetchAll();
      toast({ description: editAccomId ? t('admin.programs.accomUpdated') : t('admin.programs.accomCreated') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const saveIns = async () => {
    if (!insForm.name) {
      toast({ variant: "destructive", description: t('admin.programs.nameRequired') });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: insForm.name,
        tier: insForm.tier,
        price: Number(insForm.price) || 0,
        currency: insForm.currency,
      };
      if (editInsId) await db.from("insurances").update(payload).eq("id", editInsId);
      else await db.from("insurances").insert(payload);
      setInsOpen(false);
      setEditInsId(null);
      setInsForm({ name: "", tier: "standard", price: "", currency: "EUR" });
      await fetchAll();
      toast({ description: editInsId ? t('admin.programs.insUpdated') : t('admin.programs.insCreated') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (table: string, id: string, current: boolean) => {
    await db.from(table).update({ is_active: !current }).eq("id", id);
    fetchAll();
  };

  const deleteRecord = async (table: string, id: string) => {
    const res = await db.from(table).delete().eq("id", id);
    if (res.error) toast({ variant: "destructive", description: res.error.message });
    else fetchAll();
  };

  const openEditProgram = (p: Program) => {
    setEditProgId(p.id);
    setProgForm({
      name_ar: p.name_ar,
      name_en: p.name_en,
      type: p.type,
      price: p.price?.toString() ?? "",
      currency: p.currency,
      duration: p.duration ?? "",
      description: p.description ?? "",
      lessons_per_week: p.lessons_per_week?.toString() ?? "",
      duration_in_months: p.duration_in_months?.toString() ?? "",
      fixed_start_day_of_month: p.fixed_start_day_of_month?.toString() ?? "",
    });
    setProgOpen(true);
  };

  const openEditAccom = (a: Accommodation) => {
    setEditAccomId(a.id);
    setAccomForm({
      name_ar: a.name_ar,
      name_en: a.name_en,
      price: a.price?.toString() ?? "",
      currency: a.currency,
      description: a.description ?? "",
      school_id: a.school_id ?? "",
    });
    setAccomOpen(true);
  };

  const openEditSchool = (s: School) => {
    setEditSchoolId(s.id);
    setSchoolForm({ name_en: s.name_en, name_ar: s.name_ar, city: s.city ?? "", country: s.country });
    setSchoolOpen(true);
  };

  const openEditIns = (i: Insurance) => {
    setEditInsId(i.id);
    setInsForm({ name: i.name, tier: i.tier, price: i.price.toString(), currency: i.currency });
    setInsOpen(true);
  };

  const tierColor: Record<string, string> = {
    basic: "bg-blue-100 text-blue-700",
    standard: "bg-purple-100 text-purple-700",
    premium: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.programs.title')}</h1>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="programs">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="programs">{t('admin.programs.tabPrograms')}</TabsTrigger>
          <TabsTrigger value="schools">{t('admin.programs.tabSchools')}</TabsTrigger>
          <TabsTrigger value="accommodations">{t('admin.programs.tabAccommodations')}</TabsTrigger>
          <TabsTrigger value="insurance">{t('admin.programs.tabInsurance')}</TabsTrigger>
        </TabsList>

        {/* Programs Tab */}
        <TabsContent value="programs" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog
              open={progOpen}
              onOpenChange={(v) => {
                setProgOpen(v);
                if (!v) {
                  setEditProgId(null);
                  setProgForm(emptyProgForm);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('admin.programs.addProgram')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editProgId ? t('admin.programs.editProgram') : t('admin.programs.addProgram')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelNameEn')}</Label>
                      <Input
                        value={progForm.name_en}
                        onChange={(e) => setProgForm((f) => ({ ...f, name_en: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelNameAr')}</Label>
                      <Input
                        value={progForm.name_ar}
                        onChange={(e) => setProgForm((f) => ({ ...f, name_ar: e.target.value }))}
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.programs.labelType')}</Label>
                    <Select value={progForm.type} onValueChange={(v) => setProgForm((f) => ({ ...f, type: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROGRAM_TYPES.map((tp) => (
                          <SelectItem key={tp} value={tp}>
                            {tp.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelPrice')}</Label>
                      <Input
                        type="number"
                        value={progForm.price}
                        onChange={(e) => setProgForm((f) => ({ ...f, price: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelCurrency')}</Label>
                      <Select
                        value={progForm.currency}
                        onValueChange={(v) => setProgForm((f) => ({ ...f, currency: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="ILS">ILS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelDuration')}</Label>
                      <Input
                        value={progForm.duration}
                        onChange={(e) => setProgForm((f) => ({ ...f, duration: e.target.value }))}
                        placeholder="6 months"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelLessonsWeek')}</Label>
                      <Input
                        type="number"
                        value={progForm.lessons_per_week}
                        onChange={(e) => setProgForm((f) => ({ ...f, lessons_per_week: e.target.value }))}
                        placeholder="20"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelDurationMonths')}</Label>
                      <Input
                        type="number"
                        value={progForm.duration_in_months}
                        onChange={(e) => setProgForm((f) => ({ ...f, duration_in_months: e.target.value }))}
                        placeholder="6"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelFixedStartDay')}</Label>
                      <Input
                        type="number"
                        min="1"
                        max="28"
                        value={progForm.fixed_start_day_of_month}
                        onChange={(e) => setProgForm((f) => ({ ...f, fixed_start_day_of_month: e.target.value }))}
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.programs.labelDescription')}</Label>
                    <Input
                      value={progForm.description}
                      onChange={(e) => setProgForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <Button className="w-full" onClick={saveProgram} disabled={saving}>
                    {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{t('admin.programs.loading')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.map((p) => (
                <Card
                  key={p.id}
                  className={`overflow-hidden hover:shadow-md transition-all ${!p.is_active ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-0">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <BookOpen className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold truncate">{p.name_en}</p>
                            <p className="text-xs text-muted-foreground">{p.name_ar}</p>
                          </div>
                        </div>
                        <Badge variant={p.is_active ? "default" : "secondary"} className="shrink-0 text-xs">
                          {p.is_active ? t('admin.programs.statusActive') : t('admin.programs.statusInactive')}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <BadgeCheck className="h-3 w-3 me-1" />
                          {p.type.replace("_", " ")}
                        </span>
                        {p.price != null && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            💰 {p.price.toLocaleString('en-US')} {p.currency}
                          </span>
                        )}
                        {p.duration_in_months && (
                          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700">
                            <Clock className="h-3 w-3 me-1" />
                            {p.duration_in_months}mo
                          </span>
                        )}
                        {p.lessons_per_week && (
                          <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-700">
                            {p.lessons_per_week} {t('admin.programs.lessonsWk')}
                          </span>
                        )}
                        {p.fixed_start_day_of_month && (
                          <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700">
                            {t('admin.programs.startsDay', { day: p.fixed_start_day_of_month })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => openEditProgram(p)}
                      >
                        <Pencil className="h-3 w-3" />
                        {t('admin.programs.btnEdit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => toggleActive("programs", p.id, p.is_active)}
                      >
                        {p.is_active ? (
                          <>
                            <Pause className="h-3 w-3" />
                            {t('admin.programs.btnPause')}
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" />
                            {t('admin.programs.btnActivate')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteRecord("programs", p.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('admin.programs.btnDelete')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {programs.length === 0 && (
                <p className="col-span-3 text-center text-sm text-muted-foreground py-8">{t('admin.programs.noPrograms')}</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Schools Tab */}
        <TabsContent value="schools" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog
              open={schoolOpen}
              onOpenChange={(v) => {
                setSchoolOpen(v);
                if (!v) {
                  setEditSchoolId(null);
                  setSchoolForm({ name_ar: "", name_en: "", city: "", country: "Germany" });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('admin.programs.addSchool')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editSchoolId ? t('admin.programs.editSchool') : t('admin.programs.addSchool')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelNameEn')}</Label>
                      <Input
                        value={schoolForm.name_en}
                        onChange={(e) => setSchoolForm((f) => ({ ...f, name_en: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelNameAr')}</Label>
                      <Input
                        value={schoolForm.name_ar}
                        onChange={(e) => setSchoolForm((f) => ({ ...f, name_ar: e.target.value }))}
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelCity')}</Label>
                      <Input
                        value={schoolForm.city}
                        onChange={(e) => setSchoolForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="Berlin"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelCountry')}</Label>
                      <Input
                        value={schoolForm.country}
                        onChange={(e) => setSchoolForm((f) => ({ ...f, country: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button className="w-full" onClick={saveSchool} disabled={saving}>
                    {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((s) => (
              <Card
                key={s.id}
                className={`overflow-hidden hover:shadow-md transition-all ${!s.is_active ? "opacity-60" : ""}`}
              >
                <CardContent className="p-0">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                        <Building2 className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{s.name_en}</p>
                        <p className="text-xs text-muted-foreground">
                          {[s.city, s.country].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.programs.accommodationsLinked', { count: accommodations.filter((a) => a.school_id === s.id).length })}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEditSchool(s)}>
                      <Pencil className="h-3 w-3" />
                      {t('admin.programs.btnEdit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => toggleActive("schools", s.id, s.is_active)}
                    >
                      {s.is_active ? (
                        <>
                          <Pause className="h-3 w-3" />
                          {t('admin.programs.btnPause')}
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          {t('admin.programs.btnActivate')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteRecord("schools", s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('admin.programs.btnDelete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && schools.length === 0 && (
              <p className="col-span-3 text-center text-sm text-muted-foreground py-8">{t('admin.programs.noSchools')}</p>
            )}
          </div>
        </TabsContent>

        {/* Accommodations Tab */}
        <TabsContent value="accommodations" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog
              open={accomOpen}
              onOpenChange={(v) => {
                setAccomOpen(v);
                if (!v) {
                  setEditAccomId(null);
                  setAccomForm({
                    name_ar: "",
                    name_en: "",
                    price: "",
                    currency: "EUR",
                    description: "",
                    school_id: "",
                  });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('admin.programs.addAccommodation')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editAccomId ? t('admin.programs.editAccommodation') : t('admin.programs.addAccommodation')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelNameEn')}</Label>
                      <Input
                        value={accomForm.name_en}
                        onChange={(e) => setAccomForm((f) => ({ ...f, name_en: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelNameAr')}</Label>
                      <Input
                        value={accomForm.name_ar}
                        onChange={(e) => setAccomForm((f) => ({ ...f, name_ar: e.target.value }))}
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.programs.labelLinkedSchool')}</Label>
                    <Select
                      value={accomForm.school_id}
                      onValueChange={(v) => setAccomForm((f) => ({ ...f, school_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('admin.programs.selectSchoolPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {schools
                          .filter((s) => s.is_active)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name_en}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelPriceMonth')}</Label>
                      <Input
                        type="number"
                        value={accomForm.price}
                        onChange={(e) => setAccomForm((f) => ({ ...f, price: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelCurrency')}</Label>
                      <Select
                        value={accomForm.currency}
                        onValueChange={(v) => setAccomForm((f) => ({ ...f, currency: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="ILS">ILS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.programs.labelDescription')}</Label>
                    <Input
                      value={accomForm.description}
                      onChange={(e) => setAccomForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <Button className="w-full" onClick={saveAccom} disabled={saving}>
                    {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accommodations.map((a) => {
              const linkedSchool = schools.find((s) => s.id === a.school_id);
              return (
                <Card
                  key={a.id}
                  className={`overflow-hidden hover:shadow-md transition-all ${!a.is_active ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-0">
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                          <Home className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{a.name_en}</p>
                          {linkedSchool && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {linkedSchool.name_en}
                            </p>
                          )}
                        </div>
                      </div>
                      {a.price != null && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          💰 {a.price.toLocaleString('en-US')} {a.currency}/mo
                        </span>
                      )}
                      {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                    </div>
                    <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEditAccom(a)}>
                        <Pencil className="h-3 w-3" />
                        {t('admin.programs.btnEdit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => toggleActive("accommodations", a.id, a.is_active)}
                      >
                        {a.is_active ? (
                          <>
                            <Pause className="h-3 w-3" />
                            {t('admin.programs.btnPause')}
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" />
                            {t('admin.programs.btnActivate')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteRecord("accommodations", a.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('admin.programs.btnDelete')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!loading && accommodations.length === 0 && (
              <p className="col-span-3 text-center text-sm text-muted-foreground py-8">{t('admin.programs.noAccommodations')}</p>
            )}
          </div>
        </TabsContent>

        {/* Insurance Tab */}
        <TabsContent value="insurance" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog
              open={insOpen}
              onOpenChange={(v) => {
                setInsOpen(v);
                if (!v) {
                  setEditInsId(null);
                  setInsForm({ name: "", tier: "standard", price: "", currency: "EUR" });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('admin.programs.addInsurance')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editInsId ? t('admin.programs.editInsurance') : t('admin.programs.addInsurance')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label>{t('admin.programs.labelName')}</Label>
                    <Input
                      value={insForm.name}
                      onChange={(e) => setInsForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Public Health Insurance"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('admin.programs.labelTier')}</Label>
                    <Select value={insForm.tier} onValueChange={(v) => setInsForm((f) => ({ ...f, tier: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INSURANCE_TIERS.map((tp) => (
                          <SelectItem key={tp} value={tp}>
                            {tp.charAt(0).toUpperCase() + tp.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelPriceMonth')}</Label>
                      <Input
                        type="number"
                        value={insForm.price}
                        onChange={(e) => setInsForm((f) => ({ ...f, price: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('admin.programs.labelCurrency')}</Label>
                      <Select
                        value={insForm.currency}
                        onValueChange={(v) => setInsForm((f) => ({ ...f, currency: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="ILS">ILS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="w-full" onClick={saveIns} disabled={saving}>
                    {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {insurances.map((ins) => (
              <Card
                key={ins.id}
                className={`overflow-hidden hover:shadow-md transition-all ${!ins.is_active ? "opacity-60" : ""}`}
              >
                <CardContent className="p-0">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                        <Shield className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{ins.name}</p>
                        <Badge className={`text-xs mt-0.5 ${tierColor[ins.tier] ?? "bg-muted text-muted-foreground"}`}>
                          {ins.tier}
                        </Badge>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      💰 {ins.price.toLocaleString('en-US')} {ins.currency}/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1 border-t bg-muted/30 px-3 py-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEditIns(ins)}>
                      <Pencil className="h-3 w-3" />
                      {t('admin.programs.btnEdit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => toggleActive("insurances", ins.id, ins.is_active)}
                    >
                      {ins.is_active ? (
                        <>
                          <Pause className="h-3 w-3" />
                          {t('admin.programs.btnPause')}
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          {t('admin.programs.btnActivate')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteRecord("insurances", ins.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('admin.programs.btnDelete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && insurances.length === 0 && (
              <p className="col-span-3 text-center text-sm text-muted-foreground py-8">{t('admin.programs.noInsurance')}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminProgramsPage;
