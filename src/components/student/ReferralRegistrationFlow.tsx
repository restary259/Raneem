import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BedDouble, Check, ChevronLeft, ChevronRight, CreditCard, ExternalLink, GraduationCap, Heart, Info, Loader2, Mail, Phone, ReceiptText, Send, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readFunctionError } from "@/lib/functionError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/hooks/useLang";
import { generateIntakeMonths } from "@/utils/intakeMonths";
import { calculateRegistrationQuote, buildFullName, primaryRegistrationPhoto, validateRegistrationForm, type RegistrationAccommodation, type RegistrationFormData, type RegistrationInsurance, type RegistrationProgram } from "@/lib/referralRegistration";

interface RegistrationSchool {
  id: string;
  name_en: string;
  name_ar: string;
  city: string | null;
  country: string | null;
  description_en: string | null;
  description_ar: string | null;
  photos: string[] | null;
}

interface RegistrationResult {
  case_id: string;
  case_reference: string;
  referral_id: string;
  invoice_id: string;
  invoice_number: string;
  public_token: string;
  student_name: string;
  student_email: string;
  referrer_name: string;
  referral_type: "friend" | "family";
  total_amount: number;
  currency: string;
  email_status: string;
  invoice_url?: string;
}

interface ReferralRegistrationFlowProps {
  userId: string;
}

const STEPS = ["person", "study", "accommodation", "review"] as const;
type Step = (typeof STEPS)[number];

const emptyForm: RegistrationFormData = {
  referral_type: "friend",
  first_name: "",
  middle_name: "",
  last_name: "",
  full_name: "",
  date_of_birth: "",
  gender: "",
  city_of_birth: "",
  nationality: "",
  passport_type: "",
  email: "",
  phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  street: "",
  house_number: "",
  postcode: "",
  city: "",
  education_level: "",
  english_units: "",
  math_units: "",
  english_level: "",
  degree_interest: "",
  preferred_major_id: "",
  school_id: "",
  program_id: "",
  program_weeks: "4",
  start_month: generateIntakeMonths(1)[0]?.value ?? "",
  accommodation_id: "",
  accommodation_weeks: "4",
  insurance_id: "",
  locale: "en",
};

function money(value: number | null | undefined, currency: string | null | undefined = "EUR") {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0)) + " " + (currency ?? "EUR");
}

function localizedName(row: { name_en: string; name_ar: string }, lang: string) {
  return lang === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar;
}

function localizedDescription(row: { description_en?: string | null; description_ar?: string | null; description?: string | null }, lang: string) {
  return lang === "ar"
    ? row.description_ar || row.description_en || row.description || null
    : row.description_en || row.description || row.description_ar || null;
}

export default function ReferralRegistrationFlow({ userId }: ReferralRegistrationFlowProps) {
  const { t, i18n } = useTranslation("dashboard");
  const lang = useLang();
  const isRtl = i18n.language === "ar" || i18n.language === "he";
  const { toast } = useToast();
  const [form, setForm] = useState<RegistrationFormData>({ ...emptyForm, locale: (i18n.language.startsWith("ar") ? "ar" : i18n.language.startsWith("he") ? "he" : "en") });
  const [step, setStep] = useState<Step>("person");
  const [schools, setSchools] = useState<RegistrationSchool[]>([]);
  const [programs, setPrograms] = useState<RegistrationProgram[]>([]);
  const [accommodations, setAccommodations] = useState<RegistrationAccommodation[]>([]);
  const [insurances, setInsurances] = useState<RegistrationInsurance[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [schoolCatalogLoading, setSchoolCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [selectedAccommodation, setSelectedAccommodation] = useState<RegistrationAccommodation | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentStarting, setPaymentStarting] = useState<"card" | null>(null);

  const update = (key: keyof RegistrationFormData, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "first_name" || key === "middle_name" || key === "last_name"
        ? { full_name: buildFullName({
            first_name: key === "first_name" ? value : current.first_name,
            middle_name: key === "middle_name" ? value : current.middle_name,
            last_name: key === "last_name" ? value : current.last_name,
          }) }
        : {}),
    }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    Promise.all([
      (supabase as any).from("schools").select("id,name_en,name_ar,city,country,description_en,description_ar,photos").eq("is_active", true).order("name_en"),
      (supabase as any).from("insurances").select("id,name,price,currency,billing_period,age_price_tiers").eq("is_active", true).order("name"),
    ]).then(([schoolRes, insuranceRes]) => {
      if (cancelled) return;
      if (schoolRes.error || insuranceRes.error) {
        toast({ variant: "destructive", title: t("referralRegistration.errors.catalog") });
      }
      setSchools((schoolRes.data ?? []) as RegistrationSchool[]);
      setInsurances((insuranceRes.data ?? []) as RegistrationInsurance[]);
    }).catch((error) => {
      if (!cancelled) toast({ variant: "destructive", title: t("referralRegistration.errors.catalog"), description: error?.message });
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [t, toast]);

  useEffect(() => {
    if (!form.school_id) {
      setPrograms([]);
      setAccommodations([]);
      return;
    }
    let cancelled = false;
    setSchoolCatalogLoading(true);
    // `programs` / `accommodations` are team/admin-readable only, so the catalog
    // is fetched through the SECURITY DEFINER get_registration_catalog RPC
    // (scoped to one school, active rows only) instead of a direct table read.
    (supabase as any).rpc("get_registration_catalog", { p_school_id: form.school_id })
      .then(({ data, error }: { data: any; error: any }) => {
        if (cancelled) return;
        if (error) {
          toast({ variant: "destructive", title: t("referralRegistration.errors.catalog") });
        }
        setPrograms((data?.programs ?? []) as RegistrationProgram[]);
        setAccommodations((data?.accommodations ?? []) as RegistrationAccommodation[]);
      })
      .finally(() => {
        if (!cancelled) setSchoolCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, [form.school_id, t, toast]);

  useEffect(() => {
    if (!form.accommodation_id) {
      update("accommodation_weeks", form.program_weeks || "4");
      return;
    }
    if (!form.accommodation_weeks) update("accommodation_weeks", form.program_weeks || "4");
    // Only seed accommodation weeks; users can override afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.accommodation_id]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    Promise.all([
      (supabase as any).from("referrals").select("id,referred_name,referred_phone,referral_type,status,referred_case_id,created_at").eq("referrer_user_id", userId).order("created_at", { ascending: false }).limit(30),
      (supabase as any).from("case_registration_invoices").select("id,case_id,invoice_number,public_token,student_name,school_id,program_id,accommodation_id,program_weeks,accommodation_weeks,total_amount,currency,payment_status,status,issued_at,referrer_name,referral_type").eq("referrer_user_id", userId).order("created_at", { ascending: false }).limit(30),
    ]).then(async ([referralsRes, invoicesRes]) => {
      if (cancelled) return;
      const invoices = invoicesRes.data ?? [];
      const refs = referralsRes.data ?? [];
      const caseIds = invoices.map((inv: any) => inv.case_id).filter(Boolean);
      const rewardsRes = caseIds.length
        ? await (supabase as any).from("rewards")
            .select("id,case_id,amount,currency,status,reward_type,unlock_at,payout_requested_at,paid_at,payment_reference")
            .in("case_id", caseIds)
            .eq("reward_type", "student_referral")
        : { data: [], error: null };
      if (rewardsRes.error) console.error("[referral-history] reward lookup failed", rewardsRes.error);
      const rewardsByCase = new Map<string, any>();
      for (const reward of rewardsRes.data ?? []) rewardsByCase.set(reward.case_id, reward);
      const merged = refs.map((ref: any) => ({
        ...ref,
        invoice: invoices.find((inv: any) => inv.case_id === ref.referred_case_id) ?? null,
        reward: rewardsByCase.get(ref.referred_case_id) ?? null,
      }));
      setHistory(merged);
    }).finally(() => {
      if (!cancelled) setHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId, result]);

  const selectedSchool = schools.find((school) => school.id === form.school_id) ?? null;
  const selectedProgram = programs.find((program) => program.id === form.program_id) ?? null;
  const selectedInsurance = insurances.find((insurance) => insurance.id === form.insurance_id) ?? null;
  const selectedAccom = accommodations.find((accommodation) => accommodation.id === form.accommodation_id) ?? null;

  // Preview only. The invoice total is recomputed server-side by
  // create_student_referral_registration_internal from the catalog snapshot, so
  // this estimate can never become the charged amount. It reuses the canonical
  // programPricing / insurancePricing helpers to stay in step with the server.
  const quote = useMemo(() => calculateRegistrationQuote(
    selectedProgram,
    Number(form.program_weeks) || 0,
    selectedAccom,
    Number(form.accommodation_weeks) || 0,
    selectedInsurance,
    form.date_of_birth,
  ), [selectedProgram, form.program_weeks, selectedAccom, form.accommodation_weeks, selectedInsurance, form.date_of_birth]);

  const goNext = () => {
    const currentIndex = STEPS.indexOf(step);
    const nextStep = STEPS[currentIndex + 1];
    const stepErrors: Record<string, string> = {};

    if (step === "person") {
      if (!form.first_name.trim()) stepErrors.first_name = t("referralRegistration.errors.required");
      if (!form.last_name.trim()) stepErrors.last_name = t("referralRegistration.errors.required");
      if (!form.email.trim()) stepErrors.email = t("referralRegistration.errors.required");
      if (!form.phone.trim()) stepErrors.phone = t("referralRegistration.errors.required");
      if (!form.date_of_birth) stepErrors.date_of_birth = t("referralRegistration.errors.required");
    }
    if (step === "study") {
      if (!form.school_id) stepErrors.school_id = t("referralRegistration.errors.required");
      if (!form.program_id) stepErrors.program_id = t("referralRegistration.errors.required");
      if (!form.program_weeks || Number(form.program_weeks) < 1) stepErrors.program_weeks = t("referralRegistration.errors.required");
      if (!form.start_month) stepErrors.start_month = t("referralRegistration.errors.required");
    }
    if (step === "accommodation" && form.accommodation_id && Number(form.accommodation_weeks) < 1) {
      stepErrors.accommodation_weeks = t("referralRegistration.errors.required");
    }

    setErrors(stepErrors);
    if (Object.keys(stepErrors).length || !nextStep) return;
    setStep(nextStep);
  };

  const goBack = () => {
    const currentIndex = STEPS.indexOf(step);
    const previous = STEPS[currentIndex - 1];
    if (previous) setStep(previous);
  };

  const handleSubmit = async () => {
    const nextData: RegistrationFormData = {
      ...form,
      full_name: buildFullName(form),
      locale: i18n.language.startsWith("ar") ? "ar" : i18n.language.startsWith("he") ? "he" : "en",
    };
    const validation = validateRegistrationForm(nextData);
    if (Object.keys(validation).length || !termsAccepted) {
      setErrors(validation);
      if (!termsAccepted) toast({ variant: "destructive", title: t("referralRegistration.errors.terms") });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-student-referral-registration", { body: nextData });
      if (error) {
        const message = await readFunctionError(error);
        throw new Error(
          message.includes("already has a DARB case")
            ? t("referralRegistration.errors.duplicate")
            : message,
        );
      }
      if (!data || !data.public_token) throw new Error(t("referralRegistration.errors.submit"));
      setResult(data as RegistrationResult);
      toast({ title: t("referralRegistration.success.title") });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("referralRegistration.errors.submit"),
        description: error?.message || "",
      });
    } finally {
      setSaving(false);
    }
  };

  const startCardPayment = async () => {
    if (!result?.public_token) return;
    setPaymentStarting("card");
    try {
      const { data, error } = await supabase.functions.invoke("stripe-student-referral-checkout", {
        body: { token: result.public_token },
      });
      if (error) throw new Error(await readFunctionError(error));
      if (data?.paid) {
        window.location.href = result.invoice_url ?? `https://darb.agency/invoice/${encodeURIComponent(result.public_token)}`;
        return;
      }
      if (!data?.checkout_url) throw new Error(t("referralRegistration.payment.cardUnavailable"));
      window.location.href = data.checkout_url;
    } catch (error: any) {
      toast({ variant: "destructive", title: t("referralRegistration.payment.cardUnavailable"), description: error?.message || "" });
    } finally {
      setPaymentStarting(null);
    }
  };

  if (result) {
    const invoiceUrl = `https://darb.agency/invoice/${encodeURIComponent(result.public_token)}`;
    return (
      <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="size-8" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("referralRegistration.success.eyebrow")}</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t("referralRegistration.success.title")}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("referralRegistration.success.description")}</p>
              <div className="mt-6 grid w-full gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t("referralRegistration.success.reference")}</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold" dir="ltr">{result.case_reference}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t("referralRegistration.success.invoice")}</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold" dir="ltr">{result.invoice_number}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t("referralRegistration.success.amount")}</p>
                  <p className="mt-1 text-sm font-semibold" dir="ltr">{money(result.total_amount, result.currency)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4" />{t("referralRegistration.payment.card")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">{t("referralRegistration.payment.cardDesc")}</p>
              <Button className="w-full" onClick={startCardPayment} disabled={paymentStarting === "card"}>
                {paymentStarting === "card" ? <Loader2 className="me-2 size-4 animate-spin" /> : <CreditCard className="me-2 size-4" />}
                {t("referralRegistration.payment.payCard")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="size-4" />{t("referralRegistration.payment.bank")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">{t("referralRegistration.payment.bankDesc")}</p>
              <a href={invoiceUrl + "?payment=bank"} className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">
                <WalletCards className="me-2 size-4" />{t("referralRegistration.payment.bankAction")}
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Phone className="size-4" />{t("referralRegistration.payment.contact")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">{t("referralRegistration.payment.contactDesc")}</p>
              <a href="tel:+4917623790623" className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">
                <Phone className="me-2 size-4" />+49 176 23790623
              </a>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a href={invoiceUrl} target="_self" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <ReceiptText className="size-4" />{t("referralRegistration.payment.viewInvoice")}
          </a>
        </div>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const BackIcon = lang === "ar" ? ChevronRight : ChevronLeft;
  const NextIcon = lang === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-3xl border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge variant="secondary">{form.referral_type === "friend" ? t("referralRegistration.friend") : t("referralRegistration.family")}</Badge>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{t("referralRegistration.title")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("referralRegistration.description")}</p>
          </div>
          <div className="min-w-0 rounded-2xl bg-primary/5 px-4 py-3 text-start sm:min-w-[220px]">
            <p className="text-xs font-semibold text-primary">{t("referralRegistration.masterRecord")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("referralRegistration.masterRecordDesc")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-1.5">
          {STEPS.map((item, index) => (
            <button key={item} type="button" onClick={() => index <= stepIndex && setStep(item)} className="min-w-0 text-start" aria-current={item === step ? "step" : undefined}>
              <div className={`h-1 rounded-full ${index <= stepIndex ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-2 truncate text-[11px] font-medium ${index === stepIndex ? "text-foreground" : "text-muted-foreground"}`}>
                {t(`referralRegistration.steps.${item}`)}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-7">
          {step === "person" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {(["friend", "family"] as const).map((type) => (
                  <button key={type} type="button" onClick={() => update("referral_type", type)} className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition ${form.referral_type === type ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:border-primary/40"}`}>
                    {type === "friend" ? <Users className="size-5 text-primary" /> : <Heart className="size-5 text-primary" />}
                    <span className="font-semibold">{type === "friend" ? t("referralRegistration.friend") : t("referralRegistration.family")}</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("referralRegistration.fields.firstName")} error={errors.first_name}><Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} /></Field>
                <Field label={t("referralRegistration.fields.middleName")}><Input value={form.middle_name} onChange={(e) => update("middle_name", e.target.value)} /></Field>
                <Field label={t("referralRegistration.fields.lastName")} error={errors.last_name}><Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} /></Field>
                <Field label={t("referralRegistration.fields.dateOfBirth")} error={errors.date_of_birth}><Input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} /></Field>
                <Field label={t("referralRegistration.fields.gender")}><Select value={form.gender} onValueChange={(value) => update("gender", value)}><SelectTrigger><SelectValue placeholder={t("referralRegistration.placeholders.gender")} /></SelectTrigger><SelectContent><SelectItem value="male">{t("referralRegistration.gender.male")}</SelectItem><SelectItem value="female">{t("referralRegistration.gender.female")}</SelectItem></SelectContent></Select></Field>
                <Field label={t("referralRegistration.fields.cityOfBirth")}><Input value={form.city_of_birth} onChange={(e) => update("city_of_birth", e.target.value)} /></Field>
                <Field label={t("referralRegistration.fields.nationality")}><Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} /></Field>
                <Field label={t("referralRegistration.fields.passportType")}><Select value={form.passport_type} onValueChange={(value) => update("passport_type", value)}><SelectTrigger><SelectValue placeholder={t("referralRegistration.placeholders.passport")} /></SelectTrigger><SelectContent><SelectItem value="israeli_blue">{t("referralRegistration.passport.israeliBlue")}</SelectItem><SelectItem value="israeli_red">{t("referralRegistration.passport.israeliRed")}</SelectItem><SelectItem value="other">{t("referralRegistration.passport.other")}</SelectItem></SelectContent></Select></Field>
                <Field label={t("referralRegistration.fields.email")} error={errors.email}><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} dir="ltr" /></Field>
                <Field label={t("referralRegistration.fields.phone")} error={errors.phone}><Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} dir="ltr" /></Field>
                <Field label={t("referralRegistration.fields.emergencyName")}><Input value={form.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} /></Field>
                <Field label={t("referralRegistration.fields.emergencyPhone")}><Input type="tel" value={form.emergency_contact_phone} onChange={(e) => update("emergency_contact_phone", e.target.value)} dir="ltr" /></Field>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Mail className="size-4" />{t("referralRegistration.fields.addressTitle")}</div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label={t("referralRegistration.fields.street")}><Input value={form.street} onChange={(e) => update("street", e.target.value)} /></Field>
                  <Field label={t("referralRegistration.fields.houseNumber")}><Input value={form.house_number} onChange={(e) => update("house_number", e.target.value)} /></Field>
                  <Field label={t("referralRegistration.fields.postcode")}><Input value={form.postcode} onChange={(e) => update("postcode", e.target.value)} /></Field>
                  <Field label={t("referralRegistration.fields.city")}><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></Field>
                </div>
              </div>
            </div>
          )}

          {step === "study" && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("referralRegistration.fields.educationLevel")}><Select value={form.education_level} onValueChange={(value) => update("education_level", value)}><SelectTrigger><SelectValue placeholder={t("referralRegistration.placeholders.select")} /></SelectTrigger><SelectContent><SelectItem value="bagrut">{t("referralRegistration.education.bagrut", "Bagrut")}</SelectItem><SelectItem value="bachelor">{t("referralRegistration.education.bachelor", "Bachelor")}</SelectItem><SelectItem value="master">{t("referralRegistration.education.master", "Master")}</SelectItem><SelectItem value="other">{t("referralRegistration.education.other", "Other")}</SelectItem></SelectContent></Select></Field>
                <Field label={t("referralRegistration.fields.englishLevel")}><Select value={form.english_level} onValueChange={(value) => update("english_level", value)}><SelectTrigger><SelectValue placeholder={t("referralRegistration.placeholders.select")} /></SelectTrigger><SelectContent><SelectItem value="beginner">{t("referralRegistration.english.beginner", "Beginner")}</SelectItem><SelectItem value="intermediate">{t("referralRegistration.english.intermediate", "Intermediate")}</SelectItem><SelectItem value="advanced">{t("referralRegistration.english.advanced", "Advanced")}</SelectItem></SelectContent></Select></Field>
                {form.education_level === "bagrut" && <><Field label={t("referralRegistration.fields.englishUnits")}><Select value={form.english_units} onValueChange={(value) => update("english_units", value)}><SelectTrigger><SelectValue placeholder={t("referralRegistration.placeholders.select")} /></SelectTrigger><SelectContent>{["3","4","5"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label={t("referralRegistration.fields.mathUnits")}><Select value={form.math_units} onValueChange={(value) => update("math_units", value)}><SelectTrigger><SelectValue placeholder={t("referralRegistration.placeholders.select")} /></SelectTrigger><SelectContent>{["3","4","5"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field></>}
                <Field label={t("referralRegistration.fields.degreeInterest")}><Input value={form.degree_interest} onChange={(e) => update("degree_interest", e.target.value)} /></Field>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2"><GraduationCap className="size-4 text-primary" /><h3 className="font-semibold">{t("referralRegistration.school.title")}</h3></div>
                {catalogLoading ? <CatalogSkeleton count={3} /> : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {schools.map((school) => (
                      <button key={school.id} type="button" onClick={() => { update("school_id", school.id); update("program_id", ""); update("accommodation_id", ""); }} className={`text-start rounded-2xl border overflow-hidden transition ${form.school_id === school.id ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/40"}`}>
                        {primaryRegistrationPhoto(school.photos) ? <img src={primaryRegistrationPhoto(school.photos)!} alt={localizedName(school, lang)} className="h-28 w-full object-cover" /> : <div className="flex h-28 items-center justify-center bg-muted"><GraduationCap className="size-8 text-muted-foreground" /></div>}
                        <div className="p-4">
                          <p className="font-semibold">{localizedName(school, lang)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{[school.city, school.country].filter(Boolean).join(", ")}</p>
                          {localizedDescription(school, lang) ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{localizedDescription(school, lang)}</p> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {errors.school_id && <p className="mt-2 text-xs text-destructive">{errors.school_id}</p>}
              </div>

              {form.school_id && (
                <div>
                  <div className="mb-3 flex items-center gap-2"><GraduationCap className="size-4 text-primary" /><h3 className="font-semibold">{t("referralRegistration.course.title")}</h3></div>
                  {schoolCatalogLoading ? <CatalogSkeleton count={2} /> : programs.length ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {programs.map((program) => (
                        <button key={program.id} type="button" onClick={() => update("program_id", program.id)} className={`rounded-2xl border p-5 text-start transition ${form.program_id === program.id ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:border-primary/40"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="font-semibold">{localizedName(program, lang)}</p><p className="mt-1 text-xs text-muted-foreground">{program.cefr_range || ""}</p></div>
                            <Badge variant="secondary">{money(Number(program.price ?? 0), program.currency || "EUR")}/{t("referralRegistration.pricing.week")}</Badge>
                          </div>
                          {localizedDescription(program, lang) ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{localizedDescription(program, lang)}</p> : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {program.lessons_per_week ? <span>{program.lessons_per_week} {t("referralRegistration.pricing.lessons")}</span> : null}
                            {program.hours_per_week ? <span>{program.hours_per_week} {t("referralRegistration.pricing.hours")}</span> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : <EmptyMessage text={t("referralRegistration.course.none")} />}
                  {errors.program_id && <p className="mt-2 text-xs text-destructive">{errors.program_id}</p>}
                </div>
              )}

              {selectedProgram && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("referralRegistration.fields.courseWeeks")} error={errors.program_weeks}><Input type="number" min={1} max={104} value={form.program_weeks} onChange={(e) => update("program_weeks", e.target.value)} /></Field>
                  <Field label={t("referralRegistration.fields.startMonth")} error={errors.start_month}><Select value={form.start_month} onValueChange={(value) => update("start_month", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{generateIntakeMonths(18).map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}</SelectContent></Select></Field>
                  <div className="rounded-2xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{t("referralRegistration.pricing.courseEstimate")}</p><p className="mt-1 text-lg font-bold" dir="ltr">{money(quote.program.total, quote.currency)}</p>{quote.program.weeklyRate != null ? <p className="text-xs text-muted-foreground" dir="ltr">{money(quote.program.weeklyRate, quote.currency)}/{t("referralRegistration.pricing.week")}</p> : null}</div>
                </div>
              )}
            </div>
          )}

          {step === "accommodation" && (
            <div className="space-y-6">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <BedDouble className="mt-0.5 size-5 text-primary" />
                  <div><p className="font-semibold">{t("referralRegistration.accommodation.title")}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t("referralRegistration.accommodation.description")}</p></div>
                </div>
              </div>

              {selectedSchool && (
                <div>
                  {schoolCatalogLoading ? <CatalogSkeleton count={3} /> : accommodations.length ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <button type="button" onClick={() => { update("accommodation_id", ""); }} className={`rounded-2xl border p-5 text-start transition ${!form.accommodation_id ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:border-primary/40"}`}>
                        <div className="flex items-center gap-2 text-primary"><Info className="size-4" /><span className="font-semibold">{t("referralRegistration.accommodation.none")}</span></div>
                        <p className="mt-2 text-sm text-muted-foreground">{t("referralRegistration.accommodation.noneDesc")}</p>
                      </button>
                      {accommodations.map((accommodation) => {
                        const weekly = calculateRegistrationQuote(selectedProgram, Number(form.program_weeks), accommodation, Number(form.accommodation_weeks), null, form.date_of_birth).accommodation.weeklyRate;
                        return (
                          <div key={accommodation.id} className={`overflow-hidden rounded-2xl border transition ${form.accommodation_id === accommodation.id ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/40"}`}>
                            {primaryRegistrationPhoto(accommodation.photos) ? <img src={primaryRegistrationPhoto(accommodation.photos)!} alt={localizedName(accommodation, lang)} className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center bg-muted"><BedDouble className="size-10 text-muted-foreground" /></div>}
                            <div className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0"><p className="font-semibold">{localizedName(accommodation, lang)}</p><p className="mt-1 text-xs text-muted-foreground">{[accommodation.room_type, accommodation.meals].filter(Boolean).join(" · ")}</p></div>
                                <Badge variant="secondary">{weekly != null ? money(weekly, accommodation.currency || "EUR") : t("referralRegistration.pricing.notSet")}/{t("referralRegistration.pricing.week")}</Badge>
                              </div>
                              {localizedDescription(accommodation, lang) ? <p className="text-sm leading-6 text-muted-foreground line-clamp-3">{localizedDescription(accommodation, lang)}</p> : null}
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {accommodation.distance_note ? <span>{accommodation.distance_note}</span> : null}
                                {accommodation.placement_fee ? <span>{t("referralRegistration.pricing.placementFee")}: {money(accommodation.placement_fee, accommodation.currency || "EUR")}</span> : null}
                                {accommodation.deposit ? <span>{t("referralRegistration.pricing.deposit")}: {money(accommodation.deposit, accommodation.currency || "EUR")}</span> : null}
                              </div>
                              <div className="flex gap-2">
                                <Button type="button" className="flex-1" onClick={() => { update("accommodation_id", accommodation.id); update("accommodation_weeks", form.program_weeks || "4"); }}>{form.accommodation_id === accommodation.id ? <><Check className="me-2 size-4" />{t("referralRegistration.accommodation.selected")}</> : t("referralRegistration.accommodation.select")}</Button>
                                <Button type="button" variant="outline" onClick={() => setSelectedAccommodation(accommodation)}>{t("referralRegistration.accommodation.details")}</Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyMessage text={t("referralRegistration.accommodation.noneAvailable")} />}
                </div>
              )}

              {form.accommodation_id && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("referralRegistration.fields.accommodationWeeks")} error={errors.accommodation_weeks}><Input type="number" min={1} max={104} value={form.accommodation_weeks} onChange={(e) => update("accommodation_weeks", e.target.value)} /></Field>
                  <div className="rounded-2xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{t("referralRegistration.pricing.accommodationEstimate")}</p><p className="mt-1 text-lg font-bold" dir="ltr">{money(quote.accommodation.total, quote.currency)}</p>{quote.accommodation.weeklyRate != null ? <p className="text-xs text-muted-foreground" dir="ltr">{money(quote.accommodation.weeklyRate, quote.currency)}/{t("referralRegistration.pricing.week")}</p> : null}</div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("referralRegistration.fields.insurance")}><Select value={form.insurance_id} onValueChange={(value) => update("insurance_id", value)}><SelectTrigger><SelectValue placeholder={t("referralRegistration.placeholders.noInsurance")} /></SelectTrigger><SelectContent><SelectItem value="none">{t("referralRegistration.insurance.none")}</SelectItem>{insurances.map((insurance) => <SelectItem key={insurance.id} value={insurance.id}>{insurance.name}</SelectItem>)}</SelectContent></Select></Field>
                <div className="rounded-2xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{t("referralRegistration.pricing.insuranceEstimate")}</p><p className="mt-1 text-lg font-bold" dir="ltr">{quote.insurance.total != null ? money(quote.insurance.total, quote.currency) : t("referralRegistration.pricing.notSelected")}</p></div>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <Card>
                  <CardHeader><CardTitle className="text-base">{t("referralRegistration.review.title")}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <ReviewSection title={t("referralRegistration.review.applicant")}>
                      <ReviewRow label={t("referralRegistration.fields.firstName")} value={form.full_name || "—"} />
                      <ReviewRow label={t("referralRegistration.fields.email")} value={form.email || "—"} dir="ltr" />
                      <ReviewRow label={t("referralRegistration.fields.phone")} value={form.phone || "—"} dir="ltr" />
                      <ReviewRow label={t("referralRegistration.fields.dateOfBirth")} value={form.date_of_birth || "—"} dir="ltr" />
                    </ReviewSection>
                    <ReviewSection title={t("referralRegistration.review.study")}>
                      <ReviewRow label={t("referralRegistration.fields.school")} value={selectedSchool ? localizedName(selectedSchool, lang) : "—"} />
                      <ReviewRow label={t("referralRegistration.fields.course")} value={selectedProgram ? localizedName(selectedProgram, lang) : "—"} />
                      <ReviewRow label={t("referralRegistration.fields.courseWeeks")} value={form.program_weeks || "—"} dir="ltr" />
                      <ReviewRow label={t("referralRegistration.fields.startMonth")} value={form.start_month || "—"} dir="ltr" />
                    </ReviewSection>
                    <ReviewSection title={t("referralRegistration.review.accommodation")}>
                      <ReviewRow label={t("referralRegistration.fields.accommodation")} value={selectedAccom ? localizedName(selectedAccom, lang) : t("referralRegistration.accommodation.none")} />
                      <ReviewRow label={t("referralRegistration.fields.accommodationWeeks")} value={form.accommodation_id ? form.accommodation_weeks : "—"} dir="ltr" />
                      <ReviewRow label={t("referralRegistration.fields.insurance")} value={selectedInsurance?.name || t("referralRegistration.insurance.none")} />
                    </ReviewSection>
                  </CardContent>
                </Card>

                <Card className="h-fit border-primary/20">
                  <CardHeader><CardTitle className="text-base">{t("referralRegistration.review.financialSummary")}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <MoneyRow label={t("referralRegistration.review.course")} value={money(quote.program.total, quote.currency)} />
                    {quote.registrationFee > 0 && <MoneyRow label={t("referralRegistration.review.registrationFee")} value={money(quote.registrationFee, quote.currency)} />}
                    {form.accommodation_id && <MoneyRow label={t("referralRegistration.review.accommodation")} value={money(quote.accommodation.total, quote.currency)} />}
                    {quote.accommodationPlacementFee > 0 && <MoneyRow label={t("referralRegistration.review.placementFee")} value={money(quote.accommodationPlacementFee, quote.currency)} />}
                    {quote.insurance.total != null && <MoneyRow label={t("referralRegistration.review.insurance")} value={money(quote.insurance.total, quote.currency)} />}
                    <div className="border-t pt-3"><MoneyRow label={t("referralRegistration.review.total")} value={money(quote.subtotal, quote.currency)} strong /></div>
                    <div className="rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{t("referralRegistration.review.priceNote")}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="referral-registration-terms" checked={termsAccepted} onCheckedChange={(value) => setTermsAccepted(value === true)} />
                  <Label htmlFor="referral-registration-terms" className="cursor-pointer text-sm leading-6">{t("referralRegistration.review.terms")}</Label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-7 flex gap-3 border-t pt-5">
          {step !== "person" && <Button variant="outline" className="flex-1 sm:flex-none" onClick={goBack}><BackIcon className="me-1.5 size-4" />{t("referralRegistration.navigation.back")}</Button>}
          {step !== "review" ? (
            <Button className="flex-1 sm:flex-none sm:min-w-44" onClick={goNext}><span>{t("referralRegistration.navigation.next")}</span><NextIcon className="ms-1.5 size-4" /></Button>
          ) : (
            <Button className="flex-1 sm:min-w-52" onClick={handleSubmit} disabled={saving || !termsAccepted}>
              {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : <Send className="me-2 size-4" />}
              {t("referralRegistration.navigation.submit")}
            </Button>
          )}
        </div>
      </div>

      <ReferralHistory history={history} loading={historyLoading} lang={lang} t={t} />

      <Dialog open={!!selectedAccommodation} onOpenChange={(open) => !open && setSelectedAccommodation(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAccommodation ? localizedName(selectedAccommodation, lang) : ""}</DialogTitle>
            <DialogDescription>{selectedAccommodation ? localizedDescription(selectedAccommodation, lang) : ""}</DialogDescription>
          </DialogHeader>
          {selectedAccommodation && (
            <div className="space-y-4">
              {primaryRegistrationPhoto(selectedAccommodation.photos) ? <img src={primaryRegistrationPhoto(selectedAccommodation.photos)!} alt={localizedName(selectedAccommodation, lang)} className="max-h-72 w-full rounded-2xl object-cover" /> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label={t("referralRegistration.pricing.roomType")} value={selectedAccommodation.room_type} />
                <Detail label={t("referralRegistration.pricing.meals")} value={selectedAccommodation.meals} />
                <Detail label={t("referralRegistration.pricing.distance")} value={selectedAccommodation.distance_note} />
                <Detail label={t("referralRegistration.pricing.deposit")} value={selectedAccommodation.deposit ? money(selectedAccommodation.deposit, selectedAccommodation.currency) : null} />
                <Detail label={t("referralRegistration.pricing.placementFee")} value={selectedAccommodation.placement_fee ? money(selectedAccommodation.placement_fee, selectedAccommodation.currency) : null} />
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-sm font-semibold">{t("referralRegistration.pricing.tiers")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("referralRegistration.pricing.tiersDesc")}</p>
                <div className="mt-3 space-y-2">
                  {(() => {
                    const tiers = Array.isArray(selectedAccommodation.price_tiers) ? selectedAccommodation.price_tiers as any[] : [];
                    return tiers.length
                      ? tiers.map((tier, index) => <div key={index} className="flex items-center justify-between gap-3 text-sm"><span>{tier.from_weeks ?? 1}{tier.to_weeks ? `–${tier.to_weeks}` : "+"} {t("referralRegistration.pricing.weeks")}</span><span dir="ltr" className="font-semibold">{money(Number(tier.price), selectedAccommodation.currency || "EUR")}</span></div>)
                      : <p className="text-sm text-muted-foreground">{money(Number(selectedAccommodation.price ?? 0), selectedAccommodation.currency || "EUR")} / {t("referralRegistration.pricing.week")}</p>;
                  })()}
                </div>
              </div>
              <Button className="w-full" onClick={() => { update("accommodation_id", selectedAccommodation.id); setSelectedAccommodation(null); }}>{t("referralRegistration.accommodation.select")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={error ? "text-destructive" : ""}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function CatalogSkeleton({ count }: { count: number }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: count }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>;
}

function EmptyMessage({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border p-4"><h3 className="mb-3 text-sm font-semibold">{title}</h3><div className="divide-y divide-border/60">{children}</div></section>;
}

function ReviewRow({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return <div className="flex items-start justify-between gap-4 py-2 text-sm"><span className="shrink-0 text-muted-foreground">{label}</span><span dir={dir} className="min-w-0 text-end font-medium break-words">{value}</span></div>;
}

function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 text-sm ${strong ? "text-base font-bold" : ""}`}><span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span><span dir="ltr">{value}</span></div>;
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function ReferralHistory({ history, loading, lang, t }: { history: any[]; loading: boolean; lang: string; t: any }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="size-4" />{t("referralRegistration.history.title")}</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="space-y-2">{[1,2,3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div> : history.length ? (
          <div className="divide-y divide-border">
            {history.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{item.referred_name}</p>
                  <p className="text-xs text-muted-foreground">{item.referral_type === "family" ? t("referralRegistration.family") : t("referralRegistration.friend")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {item.invoice ? <Badge variant={item.invoice.payment_status === "paid" ? "success" : "secondary"}>{item.invoice.payment_status}</Badge> : <Badge variant="outline">{item.status || "pending"}</Badge>}
                  {item.invoice ? <span className="text-muted-foreground" dir="ltr">{item.invoice.total_amount} {item.invoice.currency || "EUR"}</span> : null}
                  {item.invoice ? <a href={"https://darb.agency/invoice/" + encodeURIComponent(item.invoice.public_token)} className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="size-3" />{item.invoice.invoice_number}</a> : null}
                  {item.reward ? <Badge variant={item.reward.status === "paid" ? "success" : "outline"}>{t("referralRegistration.history.reward", "Reward")}: {Number(item.reward.amount).toLocaleString("en-US")} {item.reward.currency || "ILS"}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyMessage text={t("referralRegistration.history.empty")} />}
      </CardContent>
    </Card>
  );
}
