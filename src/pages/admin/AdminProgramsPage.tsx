import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw } from "lucide-react";
import PriceTiersEditor, { PriceTier, parseTiers } from "@/components/admin/PriceTiersEditor";
import InsuranceRatesEditor from "@/components/admin/InsuranceRatesEditor";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { AgePriceTier, parseAgeTiers } from "@/lib/insurancePricing";
import SchoolDirectory from "@/components/admin/programs/SchoolDirectory";
import SchoolProfilePanel from "@/components/admin/programs/SchoolProfilePanel";
import InsuranceSection from "@/components/admin/programs/InsuranceSection";
import { Program, School, Accommodation, Insurance, UNASSIGNED_KEY } from "@/components/admin/programs/types";

const PROGRAM_TYPES = ["language_school", "course", "university", "other"];
const INSURANCE_TIERS = ["basic", "standard", "premium"];
const COVERAGE_SCOPES = ["germany_only", "schengen", "worldwide", "worldwide_incl_usa_canada"];

const emptyInsForm = {
  name: "",
  tier: "standard",
  price: "",
  currency: "EUR",
  provider: "",
  coverage_scope: "worldwide",
  billing_period: "monthly",
  min_months: "",
  max_months: "",
  max_age: "",
  terms_url: "",
  description_ar: "",
  description_en: "",
  photos: [] as string[],
};

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

  // Selected school in the directory; UNASSIGNED_KEY shows the unlinked items.
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const [progOpen, setProgOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [accomOpen, setAccomOpen] = useState(false);
  const [insOpen, setInsOpen] = useState(false);

  const [editProgId, setEditProgId] = useState<string | null>(null);
  const [editSchoolId, setEditSchoolId] = useState<string | null>(null);
  const [editAccomId, setEditAccomId] = useState<string | null>(null);
  const [editInsId, setEditInsId] = useState<string | null>(null);

  // When a program/accommodation dialog is opened from inside a school
  // profile, the school is inherited from context and the picker is hidden.
  const [progSchoolLocked, setProgSchoolLocked] = useState(false);
  const [accomSchoolLocked, setAccomSchoolLocked] = useState(false);

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
    school_id: "",
    cefr_range: "",
    hours_per_week: "",
    start_rule: "",
    registration_fee: "",
    photos: [] as string[],
  };
  const emptyAccomForm = {
    name_ar: "",
    name_en: "",
    price: "",
    currency: "EUR",
    description: "",
    school_id: "",
    room_type: "",
    meals: "",
    deposit: "",
    placement_fee: "",
    distance_note: "",
    photos: [] as string[],
  };
  const [progForm, setProgForm] = useState(emptyProgForm);
  const [progTiers, setProgTiers] = useState<PriceTier[]>([]);
  const [schoolForm, setSchoolForm] = useState({ name_ar: "", name_en: "", city: "", country: "Germany", photos: [] as string[] });
  const [accomForm, setAccomForm] = useState(emptyAccomForm);
  const [accomTiers, setAccomTiers] = useState<PriceTier[]>([]);
  const [insForm, setInsForm] = useState(emptyInsForm);
  const [insRates, setInsRates] = useState<AgePriceTier[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = (await Promise.all([
        db.from("programs").select("*").order("created_at", { ascending: false }),
        db.from("schools").select("*").order("name_en"),
        db.from("accommodations").select("*").order("name_en"),
        db.from("insurances").select("*").order("tier"),
      ])) as any[];
      const failed = results.find((r) => r.error);
      // Without this an RLS/network failure renders as "no records exist".
      if (failed) throw failed.error;
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

  // Pre-select the first school so the profile column is never empty.
  useEffect(() => {
    if (selectedSchoolId === null && schools.length > 0) {
      setSelectedSchoolId(schools[0].id);
    }
  }, [schools, selectedSchoolId]);

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
        school_id: progForm.school_id || null,
        cefr_range: progForm.cefr_range || null,
        hours_per_week: progForm.hours_per_week ? Number(progForm.hours_per_week) : null,
        start_rule: progForm.start_rule || null,
        registration_fee: progForm.registration_fee ? Number(progForm.registration_fee) : null,
        price_tiers: progTiers.filter((tier) => tier.price != null),
        photos: progForm.photos,
      };
      const { error } = editProgId
        ? await db.from("programs").update(payload).eq("id", editProgId)
        : await db.from("programs").insert(payload);
      if (error) throw error;
      setProgOpen(false);
      setEditProgId(null);
      setProgForm(emptyProgForm);
      setProgTiers([]);
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
        photos: schoolForm.photos,
      };
      const { error } = editSchoolId
        ? await db.from("schools").update(payload).eq("id", editSchoolId)
        : await db.from("schools").insert(payload);
      if (error) throw error;
      setSchoolOpen(false);
      setEditSchoolId(null);
      setSchoolForm({ name_ar: "", name_en: "", city: "", country: "Germany", photos: [] });
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
        room_type: accomForm.room_type || null,
        meals: accomForm.meals || null,
        deposit: accomForm.deposit ? Number(accomForm.deposit) : null,
        placement_fee: accomForm.placement_fee ? Number(accomForm.placement_fee) : null,
        distance_note: accomForm.distance_note || null,
        price_tiers: accomTiers.filter((tier) => tier.price != null),
        photos: accomForm.photos,
      };
      const { error } = editAccomId
        ? await db.from("accommodations").update(payload).eq("id", editAccomId)
        : await db.from("accommodations").insert(payload);
      if (error) throw error;
      setAccomOpen(false);
      setEditAccomId(null);
      setAccomForm(emptyAccomForm);
      setAccomTiers([]);
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
        provider: insForm.provider || null,
        coverage_scope: insForm.coverage_scope || null,
        billing_period: insForm.billing_period || "monthly",
        min_months: insForm.min_months ? Number(insForm.min_months) : null,
        max_months: insForm.max_months ? Number(insForm.max_months) : null,
        max_age: insForm.max_age ? Number(insForm.max_age) : null,
        terms_url: insForm.terms_url || null,
        description_ar: insForm.description_ar || null,
        description_en: insForm.description_en || null,
        age_price_tiers: insRates.filter((r) => r.price != null),
        photos: insForm.photos,
      };
      const { error } = editInsId
        ? await db.from("insurances").update(payload).eq("id", editInsId)
        : await db.from("insurances").insert(payload);
      if (error) throw error;
      setInsOpen(false);
      setEditInsId(null);
      setInsForm(emptyInsForm);
      setInsRates([]);
      await fetchAll();

      toast({ description: editInsId ? t('admin.programs.insUpdated') : t('admin.programs.insCreated') });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (table: string, id: string, current: boolean) => {
    const { error } = await db.from(table).update({ is_active: !current }).eq("id", id);
    if (error) {
      toast({ variant: "destructive", description: error.message });
      return;
    }
    fetchAll();
  };

  const deleteRecord = async (table: string, id: string) => {
    const res = await db.from(table).delete().eq("id", id);
    if (res.error) toast({ variant: "destructive", description: res.error.message });
    else fetchAll();
  };

  // Schools / programs / accommodations go through the guarded RPC dialog.
  const [deleteTarget, setDeleteTarget] = useState<CatalogDeleteTarget | null>(null);

  const openAddProgram = (schoolId: string) => {
    setEditProgId(null);
    setProgForm({ ...emptyProgForm, school_id: schoolId });
    setProgTiers([]);
    setProgSchoolLocked(true);
    setProgOpen(true);
  };

  const openEditProgram = (p: Program, lockSchool: boolean) => {
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
      school_id: p.school_id ?? "",
      cefr_range: p.cefr_range ?? "",
      hours_per_week: p.hours_per_week?.toString() ?? "",
      start_rule: p.start_rule ?? "",
      registration_fee: p.registration_fee?.toString() ?? "",
      photos: p.photos ?? [],
    });
    setProgTiers(parseTiers(p.price_tiers));
    setProgSchoolLocked(lockSchool);
    setProgOpen(true);
  };

  const openAddAccom = (schoolId: string) => {
    setEditAccomId(null);
    setAccomForm({ ...emptyAccomForm, school_id: schoolId });
    setAccomTiers([]);
    setAccomSchoolLocked(true);
    setAccomOpen(true);
  };

  const openEditAccom = (a: Accommodation, lockSchool: boolean) => {
    setEditAccomId(a.id);
    setAccomForm({
      name_ar: a.name_ar,
      name_en: a.name_en,
      price: a.price?.toString() ?? "",
      currency: a.currency,
      description: a.description ?? "",
      school_id: a.school_id ?? "",
      room_type: a.room_type ?? "",
      meals: a.meals ?? "",
      deposit: a.deposit?.toString() ?? "",
      placement_fee: a.placement_fee?.toString() ?? "",
      distance_note: a.distance_note ?? "",
      photos: a.photos ?? [],
    });
    setAccomTiers(parseTiers(a.price_tiers));
    setAccomSchoolLocked(lockSchool);
    setAccomOpen(true);
  };

  const openEditSchool = (s: School) => {
    setEditSchoolId(s.id);
    setSchoolForm({ name_en: s.name_en, name_ar: s.name_ar, city: s.city ?? "", country: s.country, photos: s.photos ?? [] });
    setSchoolOpen(true);
  };

  const openEditIns = (i: Insurance) => {
    setEditInsId(i.id);
    setInsForm({
      name: i.name,
      tier: i.tier,
      price: i.price.toString(),
      currency: i.currency,
      provider: i.provider ?? "",
      coverage_scope: i.coverage_scope ?? "worldwide",
      billing_period: i.billing_period ?? "monthly",
      min_months: i.min_months?.toString() ?? "",
      max_months: i.max_months?.toString() ?? "",
      max_age: i.max_age?.toString() ?? "",
      terms_url: i.terms_url ?? "",
      description_ar: i.description_ar ?? "",
      description_en: i.description_en ?? "",
      photos: i.photos ?? [],
    });
    setInsRates(parseAgeTiers(i.age_price_tiers));
    setInsOpen(true);
  };

  const isUnassignedView = selectedSchoolId === UNASSIGNED_KEY;
  const selectedSchool =
    selectedSchoolId && !isUnassignedView ? schools.find((s) => s.id === selectedSchoolId) ?? null : null;
  const isUnlinked = (item: { school_id: string | null }) =>
    !item.school_id || !schools.some((s) => s.id === item.school_id);
  const profilePrograms = selectedSchool
    ? programs.filter((p) => p.school_id === selectedSchool.id)
    : isUnassignedView
      ? programs.filter(isUnlinked)
      : [];
  const profileAccoms = selectedSchool
    ? accommodations.filter((a) => a.school_id === selectedSchool.id)
    : isUnassignedView
      ? accommodations.filter(isUnlinked)
      : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.programs.hubTitle')}</h1>
        <div className="flex items-center gap-2">
          <Dialog
            open={schoolOpen}
            onOpenChange={(v) => {
              setSchoolOpen(v);
              if (!v) {
                setEditSchoolId(null);
                setSchoolForm({ name_ar: "", name_en: "", city: "", country: "Germany", photos: [] });
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
                <PhotoUploader
                  photos={schoolForm.photos}
                  onChange={(photos) => setSchoolForm((f) => ({ ...f, photos }))}
                  folder="schools"
                  label={t('admin.programs.labelPhotos')}
                />
                <Button className="w-full" onClick={saveSchool} disabled={saving}>
                  {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <SchoolDirectory
          schools={schools}
          programs={programs}
          accommodations={accommodations}
          selectedId={selectedSchoolId}
          onSelect={setSelectedSchoolId}
        />
        {loading && schools.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{t('admin.programs.loading')}</div>
        ) : (
          <SchoolProfilePanel
            selectedId={selectedSchoolId}
            school={selectedSchool}
            programs={profilePrograms}
            accommodations={profileAccoms}
            onEditSchool={openEditSchool}
            onToggleSchool={(s) => toggleActive("schools", s.id, s.is_active)}
            onAddProgram={() => selectedSchool && openAddProgram(selectedSchool.id)}
            onEditProgram={(p) => openEditProgram(p, !!selectedSchool)}
            onToggleProgram={(p) => toggleActive("programs", p.id, p.is_active)}
            onDeleteProgram={(p) => deleteRecord("programs", p.id)}
            onAddAccommodation={() => selectedSchool && openAddAccom(selectedSchool.id)}
            onEditAccommodation={(a) => openEditAccom(a, !!selectedSchool)}
            onToggleAccommodation={(a) => toggleActive("accommodations", a.id, a.is_active)}
            onDeleteAccommodation={(a) => deleteRecord("accommodations", a.id)}
          />
        )}
      </div>

      <Separator />

      <InsuranceSection
        insurances={insurances}
        loading={loading}
        addTrigger={
          <Button size="sm" className="gap-2" onClick={() => setInsOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('admin.programs.addInsurance')}
          </Button>
        }
        onEdit={openEditIns}
        onToggle={(i) => toggleActive("insurances", i.id, i.is_active)}
        onDelete={(i) => deleteRecord("insurances", i.id)}
      />

      {/* Program dialog — school is inherited from the profile context when locked */}
      <Dialog
        open={progOpen}
        onOpenChange={(v) => {
          setProgOpen(v);
          if (!v) {
            setEditProgId(null);
            setProgForm(emptyProgForm);
            setProgTiers([]);
            setProgSchoolLocked(false);
          }
        }}
      >
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
            {!progSchoolLocked && (
              <div className="space-y-1">
                <Label>{t('admin.programs.labelLinkedSchool')}</Label>
                <Select
                  value={progForm.school_id || "none"}
                  onValueChange={(v) => setProgForm((f) => ({ ...f, school_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.programs.selectSchoolPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('admin.programs.noSchoolOption')}</SelectItem>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t('admin.programs.labelCefr')}</Label>
                <Input
                  value={progForm.cefr_range}
                  onChange={(e) => setProgForm((f) => ({ ...f, cefr_range: e.target.value }))}
                  placeholder="A1-C1"
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelHoursWeek')}</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={progForm.hours_per_week}
                  onChange={(e) => setProgForm((f) => ({ ...f, hours_per_week: e.target.value }))}
                  placeholder="15"
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelRegistrationFee')}</Label>
                <Input
                  type="number"
                  value={progForm.registration_fee}
                  onChange={(e) => setProgForm((f) => ({ ...f, registration_fee: e.target.value }))}
                  placeholder="60"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('admin.programs.labelStartRule')}</Label>
              <Select
                value={progForm.start_rule || "none"}
                onValueChange={(v) => setProgForm((f) => ({ ...f, start_rule: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('admin.programs.startRule.none')}</SelectItem>
                  <SelectItem value="every_monday">{t('admin.programs.startRule.every_monday')}</SelectItem>
                  <SelectItem value="every_monday_a1_first_monday">
                    {t('admin.programs.startRule.every_monday_a1_first_monday')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <PriceTiersEditor tiers={progTiers} onChange={setProgTiers} />
            <div className="space-y-1">
              <Label>{t('admin.programs.labelDescription')}</Label>
              <Input
                value={progForm.description}
                onChange={(e) => setProgForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <PhotoUploader
              photos={progForm.photos}
              onChange={(photos) => setProgForm((f) => ({ ...f, photos }))}
              folder="programs"
              label={t('admin.programs.labelPhotos')}
            />
            <Button className="w-full" onClick={saveProgram} disabled={saving}>
              {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accommodation dialog — school is inherited from the profile context when locked */}
      <Dialog
        open={accomOpen}
        onOpenChange={(v) => {
          setAccomOpen(v);
          if (!v) {
            setEditAccomId(null);
            setAccomForm(emptyAccomForm);
            setAccomTiers([]);
            setAccomSchoolLocked(false);
          }
        }}
      >
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
            {!accomSchoolLocked && (
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
            )}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('admin.programs.labelRoomType')}</Label>
                <Input
                  value={accomForm.room_type}
                  onChange={(e) => setAccomForm((f) => ({ ...f, room_type: e.target.value }))}
                  placeholder="Single / Shared"
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelMeals')}</Label>
                <Input
                  value={accomForm.meals}
                  onChange={(e) => setAccomForm((f) => ({ ...f, meals: e.target.value }))}
                  placeholder="Breakfast / None"
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelDeposit')}</Label>
                <Input
                  type="number"
                  value={accomForm.deposit}
                  onChange={(e) => setAccomForm((f) => ({ ...f, deposit: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelPlacementFee')}</Label>
                <Input
                  type="number"
                  value={accomForm.placement_fee}
                  onChange={(e) => setAccomForm((f) => ({ ...f, placement_fee: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('admin.programs.labelDistanceNote')}</Label>
              <Input
                value={accomForm.distance_note}
                onChange={(e) => setAccomForm((f) => ({ ...f, distance_note: e.target.value }))}
              />
            </div>
            <PriceTiersEditor tiers={accomTiers} onChange={setAccomTiers} />
            <PhotoUploader
              photos={accomForm.photos}
              onChange={(photos) => setAccomForm((f) => ({ ...f, photos }))}
              folder="accommodations"
              label={t('admin.programs.labelPhotos')}
            />
            <Button className="w-full" onClick={saveAccom} disabled={saving}>
              {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insurance dialog */}
      <Dialog
        open={insOpen}
        onOpenChange={(v) => {
          setInsOpen(v);
          if (!v) {
            setEditInsId(null);
            setInsForm(emptyInsForm);
            setInsRates([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
            <InsuranceRatesEditor
              tiers={insRates}
              currency={insForm.currency}
              onChange={setInsRates}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('admin.programs.labelProvider')}</Label>
                <Input
                  value={insForm.provider}
                  onChange={(e) => setInsForm((f) => ({ ...f, provider: e.target.value }))}
                  placeholder="MAWISTA"
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelCoverageScope')}</Label>
                <Select
                  value={insForm.coverage_scope}
                  onValueChange={(v) => setInsForm((f) => ({ ...f, coverage_scope: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COVERAGE_SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`admin.programs.coverage.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t('admin.programs.labelMinMonths')}</Label>
                <Input
                  type="number"
                  value={insForm.min_months}
                  onChange={(e) => setInsForm((f) => ({ ...f, min_months: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelMaxMonths')}</Label>
                <Input
                  type="number"
                  value={insForm.max_months}
                  onChange={(e) => setInsForm((f) => ({ ...f, max_months: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelMaxAge')}</Label>
                <Input
                  type="number"
                  value={insForm.max_age}
                  onChange={(e) => setInsForm((f) => ({ ...f, max_age: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('admin.programs.labelTermsUrl')}</Label>
              <Input
                value={insForm.terms_url}
                onChange={(e) => setInsForm((f) => ({ ...f, terms_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>{t('admin.programs.labelDescAr')}</Label>
                <textarea
                  dir="rtl"
                  rows={3}
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={insForm.description_ar}
                  onChange={(e) => setInsForm((f) => ({ ...f, description_ar: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('admin.programs.labelDescEn')}</Label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border bg-background p-2 text-sm"
                  value={insForm.description_en}
                  onChange={(e) => setInsForm((f) => ({ ...f, description_en: e.target.value }))}
                />
              </div>
            </div>
            <PhotoUploader
              photos={insForm.photos}
              onChange={(photos) => setInsForm((f) => ({ ...f, photos }))}
              folder="insurance"
              label={t('admin.programs.labelPhotos')}
            />
            <Button className="w-full" onClick={saveIns} disabled={saving}>
              {saving ? t('admin.programs.btnSaving') : t('admin.programs.btnSave')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProgramsPage;
