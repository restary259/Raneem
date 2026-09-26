import React, { useState, useEffect } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, ChevronLeft, ChevronRight, CalendarDays, Users, UserRound, GraduationCap, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDirection } from "@/hooks/useDirection";
import { captureReferralCode, getReferralCode, verifyReferralCode, shouldKeepReferralCode } from "@/lib/referral";
import FieldGroup from "@/components/common/FieldGroup";
import ConsentBlock from "@/components/common/ConsentBlock";
import PublicOfficeBooking from "./PublicOfficeBooking";
import { recordConsent } from "@/lib/consent";
import {
  PASSPORT_TYPES,
  EDUCATION_LEVELS,
  UNIT_OPTIONS,
  APPLYING_WITH_OPTIONS,
  EMPTY_COMPANION,
  APPLY_TOTAL_STEPS,
} from "./applyConstants";

const isDev = Boolean(import.meta.env.DEV);
const debug = (...args: unknown[]) => { if (isDev) console.log(...args); };
const debugError = (...args: unknown[]) => { if (isDev) console.error(...args); };

export interface ApplyFormProps {
  /** When true, renders only the form card (no full-screen chrome / hero /
   *  trust badges) for embedding inside a dashboard layout. */
  embedded?: boolean;
  /** When true, sends the caller's session access token so the edge function
   *  attributes the case to the logged-in partner server-side. Public apply
   *  uses the anon key instead. */
  useSessionAuth?: boolean;
  /** Called once after a successful submission (embedded mode navigates away;
   *  public mode shows its own success screen). */
  onSubmitted?: () => void;
}

type Companion = {
  name: string;
  phone: string;
  passportType: string;
  city: string;
  education: string;
  englishUnits: string;
  mathUnits: string;
  preferredMajor: string;
};

/**
 * The multi-step apply form, shared by the public /apply page and the
 * in-dashboard partner apply page. The form body is identical in both; only
 * the surrounding chrome and the auth header differ (see ApplyFormProps).
 */
const ApplyForm: React.FC<ApplyFormProps> = ({ embedded = false, useSessionAuth = false, onSubmitted }) => {
  const { t, i18n } = useTranslation("landing");
  const { dir, isRtl } = useDirection();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isAr = i18n.language === "ar";

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Step 1 — Identity
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [passportType, setPassportType] = useState("");
  const [city, setCity] = useState("");

  // Step 2 — Education
  const [educationLevel, setEducationLevel] = useState("");
  const [englishUnits, setEnglishUnits] = useState("");
  const [mathUnits, setMathUnits] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [englishProficiency, setEnglishProficiency] = useState("");

  // Step 3 — Major
  const [preferredMajor, setPreferredMajor] = useState("");

  // Step 3 — Companion (moved to the end, just before review)
  const [applyingWith, setApplyingWith] = useState("alone");
  const [companions, setCompanions] = useState<Companion[]>([{ ...EMPTY_COMPANION }]);

  const [refCode, setRefCode] = useState<string | null>(() => getReferralCode());
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [deferredBooking, setDeferredBooking] = useState(false);
  const [companionsFailedNotice, setCompanionsFailedNotice] = useState("");

  useEffect(() => {
    const code = captureReferralCode(searchParams.toString());
    setRefCode(code);
    if (!code) {
      return;
    }
    let active = true;
    verifyReferralCode(code).then((health) => {
      if (!active) return;
      if (shouldKeepReferralCode(health)) {
        // Valid OR unverified (transient lookup failure): keep the stored code
        // and submit it. The server resolves it again at submission, so a
        // momentary client-side lookup failure must never strip a partner's
        // attribution from the case (which would leave the case unattributed —
        // visible to Admin, invisible to the partner dashboard / KPI).
      } else {
        // Server confirmed the code is invalid/disabled — drop it.
        setRefCode(null);
      }
    });
    return () => { active = false; };
  }, [searchParams]);

  const isValidPhone = (p: string) => {
    const cleaned = p.replace(/[\s\-()]/g, "");
    return /^05\d{8}$/.test(cleaned) || /^\+9725\d{8}$/.test(cleaned) || /^\+?\d{7,15}$/.test(cleaned);
  };
  const [phoneError, setPhoneError] = useState("");

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (val.trim() && !isValidPhone(val)) {
      setPhoneError(
        isAr
          ? "رقم هاتف غير صالح (مثال: 0501234567 أو +491234567890)"
          : "Invalid phone number (e.g. 0501234567 or +491234567890)",
      );
    } else {
      setPhoneError("");
    }
  };

  const showBagrut = educationLevel === "bagrut";
  const showHigherEd = educationLevel === "bachelor" || educationLevel === "master";
  const hasCompanions = applyingWith !== "alone";

  const canGoNext = () => {
    if (step === 1) return Boolean(fullName.trim() && phone.trim() && isValidPhone(phone) && city.trim());
    if (step === 2) return !showBagrut || Boolean(englishUnits && mathUnits);
    if (step === 3) return applyingWith === "alone" || Boolean(companions[0]?.name.trim() && isValidPhone(companions[0]?.phone ?? ""));
    if (step === 4) return consentAgreed;
    return false;
  };

  const addCompanion = () => setCompanions((prev) => [...prev, { ...EMPTY_COMPANION }]);
  const updateCompanion = (index: number, field: string, value: string) =>
    setCompanions((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  const removeCompanion = (index: number) =>
    setCompanions((prev) => prev.filter((_, i) => i !== index));

  /** Resolve the auth header for the edge-function call. Public form uses the
   *  anon key; the in-dashboard partner form uses the caller's session token. */
  const buildHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (useSessionAuth) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const handleSubmit = async () => {
    if (loading) return;

    if (!consentAgreed) {
      toast({
        title: isAr ? "الموافقة مطلوبة" : "Consent required",
        description: isAr
          ? "يرجى الموافقة على معالجة بياناتك قبل الإرسال"
          : "Please agree to the processing of your data before submitting",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    void recordConsent({
      sourceForm: "apply_page",
      subjectName: fullName,
      phone,
      serviceContact: true,
      marketing: false,
      locale: i18n.language,
    });

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const caseUrl = `https://${projectId}.supabase.co/functions/v1/create-case-from-apply`;
    const headers = await buildHeaders();
    // The anon key is still required for the public form (the function is
    // invokable with anon); the partner form sends a session bearer instead.
    if (!useSessionAuth) headers["apikey"] = anonKey;

    const basePayload = {
      full_name: fullName.trim(),
      phone_number: phone.trim(),
      source: "apply_page",
      ref_code: refCode,
      city: city.trim() || null,
      education_level: educationLevel || null,
      bagrut_score: null,
      english_level: englishProficiency || null,
      english_units: englishUnits ? parseInt(englishUnits) : null,
      math_units: mathUnits ? parseInt(mathUnits) : null,
      passport_type: passportType || null,
      degree_interest: preferredMajor.trim() || fieldOfStudy.trim() || null,
    };

    try {
      const caseResp = await fetch(caseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(basePayload),
      });
       const caseResult = await caseResp.json();
       if (!caseResp.ok) {
        throw new Error(caseResult.error || "Failed to create case");
      }

       if (typeof caseResult.booking_token === "string") setBookingToken(caseResult.booking_token);
       let companionsCreated = 0;
      let companionsFailed = 0;
      if (hasCompanions) {
        for (const c of companions) {
          if (!c.name.trim() || !c.phone.trim()) continue;
          try {
            const compCaseResp = await fetch(caseUrl, {
              method: "POST",
              headers,
              body: JSON.stringify({
                full_name: c.name.trim(),
                phone_number: c.phone.trim(),
                source: "apply_page",
                ref_code: refCode,
                 city: null,
                 education_level: null,
                 passport_type: null,
                 math_units: null,
                 english_units: null,
                bagrut_score: null,
                english_level: null,
                 degree_interest: null,
              }),
            });
            if (compCaseResp.status === 409) {
              companionsCreated++;
            } else if (!compCaseResp.ok) {
              companionsFailed++;
            } else {
              companionsCreated++;
            }
          } catch {
            companionsFailed++;
          }
        }
      }

      if (hasCompanions && companionsFailed > 0) {
        setCompanionsFailedNotice(t("apply.companionFailure", { count: companionsFailed }));
        toast({
          title: isAr ? "تعذّر إنشاء بعض الرفاق" : "Some companions could not be added",
          description: isAr
            ? `تم إنشاء ${companionsCreated} رفيق، وفشل ${companionsFailed}.`
            : `${companionsCreated} companion(s) created, ${companionsFailed} failed.`,
          variant: "destructive",
        });
      }

      setSubmitted(true);
      onSubmitted?.();
    } catch (err: unknown) {
      debugError("[ApplyForm] Submission failed:", err);
      toast({
        title: t("apply.error", "حدث خطأ، حاول مرة أخرى"),
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const TOTAL_STEPS = APPLY_TOTAL_STEPS;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  const stepTitles = [
    t("apply.personalStep"),
    t("apply.educationStep"),
    t("apply.companionStep", { defaultValue: isAr ? "مع مين رح تقدّم؟" : "Who are you applying with?" }),
    t("apply.reviewStep", { defaultValue: isAr ? "مراجعة وإرسال" : "Review & submit" }),
  ];
  const stepIcons = [UserRound, GraduationCap, Users, ClipboardCheck];

  // ── Success screen ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex min-h-[65vh] items-start justify-center bg-background px-5 py-14 text-foreground" dir={dir}>
        <div className="w-full max-w-lg space-y-6 text-start">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-brand-strong"><CheckCircle className="size-6" aria-hidden="true" /></div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{t("apply.successTitle")}</h2>
            <p className="leading-7 text-muted-foreground">{t("apply.successSubtitle")}</p>
          </div>
          {companionsFailedNotice && <p role="status" className="text-sm text-destructive">{companionsFailedNotice}</p>}
          {bookingToken && !useSessionAuth && !showBooking && !deferredBooking && <div className="space-y-3 border-t border-border pt-6">
            <Button onClick={() => setShowBooking(true)} className="w-full"><CalendarDays aria-hidden="true" />{t("apply.bookVisit")}</Button>
            <Button variant="ghost" onClick={() => setDeferredBooking(true)} className="w-full">{t("apply.deferVisit")}</Button>
          </div>}
          {showBooking && bookingToken && <div className="border-t border-border pt-6"><PublicOfficeBooking token={bookingToken} autoOpen /></div>}
          {deferredBooking && <p role="status" className="text-sm text-muted-foreground">{t("apply.deferredNotice")}</p>}
          <p className="border-t border-border pt-5 text-sm leading-6 text-muted-foreground">{t("apply.officeNext")}</p>
        </div>
      </div>
    );
  }

  // ── Form card (shared) ─────────────────────────────────────────
  const formCard = (
    <div className="w-full" data-testid="apply-form" data-step={step}>
      <div className="space-y-1 pb-6">
        <p className="text-xs font-semibold text-brand-strong">{t("apply.step")} {step} / {TOTAL_STEPS}</p>
        <h2 className="text-2xl font-bold leading-tight text-foreground">{stepTitles[step - 1]}</h2>
      </div>
      <div className="space-y-6">

        {/* Step 3 — Alone or with a friend */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <FieldGroup label={isAr ? "كيف رح تقدّم؟" : "How are you applying?"}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {APPLYING_WITH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setApplyingWith(opt.value);
                      if (opt.value === "alone") setCompanions([{ ...EMPTY_COMPANION }]);
                    }}
                    className={`rounded-xl border p-4 text-start transition-all duration-200 ${applyingWith === opt.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"}`}
                    aria-pressed={applyingWith === opt.value}
                  >
                    {opt.value === "alone" ? <UserRound className="mb-3 size-5 text-brand-strong" /> : <Users className="mb-3 size-5 text-brand-strong" />}
                    <p className="font-semibold">{isAr ? opt.label : opt.labelEn}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {opt.value === "alone"
                        ? isAr ? "طلب واحد باسمك وبياناتك." : "One application using your details."
                        : isAr ? "بننسّق طلبك مع صديق أو قريب بنفس البداية." : "We can start the process together with a friend or relative."}
                    </p>
                  </button>
                ))}
              </div>
            </FieldGroup>

            {hasCompanions && (
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 animate-fade-in">
                <p className="text-sm font-semibold">{isAr ? "بيانات الشخص اللي معك" : "Your companion's details"}</p>
                <FieldGroup label={isAr ? "الاسم الكامل *" : "Full Name *"}>
                  <Input value={companions[0].name} onChange={(e) => updateCompanion(0, "name", e.target.value)} placeholder={isAr ? "الاسم الكامل" : "Full name"} dir={dir} className="h-11" />
                </FieldGroup>
                <FieldGroup label={isAr ? "رقم الهاتف / واتساب *" : "Phone / WhatsApp *"}>
                  <Input value={companions[0].phone} onChange={(e) => updateCompanion(0, "phone", e.target.value)} placeholder="050-1234567" dir="ltr" type="tel" className="h-11" />
                </FieldGroup>
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Personal details */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <FieldGroup label={isAr ? "الاسم الكامل *" : "Full Name *"}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={isAr ? "أدخل اسمك الكامل" : "Enter your full name"} dir={dir} className="h-11" />
            </FieldGroup>
            <FieldGroup label={isAr ? "رقم الهاتف / واتساب *" : "Phone / WhatsApp *"}>
              <Input value={phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="050-1234567" dir="ltr" type="tel" className={`h-11 ${phoneError ? "border-destructive" : ""}`} />
              {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
            </FieldGroup>
            <FieldGroup label={isAr ? "المدينة *" : "City *"}>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={isAr ? "مثال: حيفا" : "e.g. Haifa"} dir={dir} className="h-11" />
            </FieldGroup>
            <FieldGroup label={isAr ? "البريد الإلكتروني *" : "Email *"}>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isAr ? "name@example.com" : "name@example.com"} dir="ltr" type="email" className="h-11" />
            </FieldGroup>
            <details className="text-start text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium">{t("apply.extraDetails")}</summary>
              <div className="mt-3">
                <FieldGroup label={isAr ? "نوع جواز السفر" : "Passport Type"}>
                  <div className="grid grid-cols-1 gap-2">
                    {PASSPORT_TYPES.map((pt) => (
                      <button key={pt.value} type="button" onClick={() => setPassportType(pt.value)} className={`w-full rounded-md border px-4 py-2.5 text-start text-sm font-medium transition-all duration-200 ${passportType === pt.value ? "bg-primary text-primary-foreground border-primary shadow-xs" : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"}`}>
                        {isAr ? pt.label : pt.labelEn}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              </div>
            </details>
          </div>
        )}

        {/* Step 2 — Education */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <FieldGroup label={isAr ? "المستوى التعليمي" : "Education Level"}>
              <div className="grid grid-cols-2 gap-2">
                {EDUCATION_LEVELS.map((lvl) => (
                  <button key={lvl.value} type="button" onClick={() => setEducationLevel(lvl.value)} className={`rounded-md border px-3 py-3 text-xs font-medium transition-all duration-200 ${educationLevel === lvl.value ? "bg-primary text-primary-foreground border-primary shadow-xs" : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"}`}>
                    {isAr ? lvl.label : lvl.labelEn}
                  </button>
                ))}
              </div>
            </FieldGroup>

            {showBagrut && (
              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 animate-fade-in">
                <p className="text-sm font-semibold">{isAr ? "بالنسبة للبجروت، لازم نعرف الوحدات:" : "For Bagrut, we need your units:"}</p>
                <FieldGroup label={isAr ? "وحدات الإنجليزي *" : "English Units *"}>
                  <div className="flex gap-2">
                    {UNIT_OPTIONS.map((u) => (
                      <button key={u} type="button" onClick={() => setEnglishUnits(u)} className={`flex-1 rounded-md border py-2.5 text-sm font-bold transition-all ${englishUnits === u ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30" : "bg-card border-border hover:border-primary/40"}`}>{u}</button>
                    ))}
                  </div>
                </FieldGroup>
                <FieldGroup label={isAr ? "وحدات الرياضيات *" : "Math Units *"}>
                  <div className="flex gap-2">
                    {UNIT_OPTIONS.map((u) => (
                      <button key={u} type="button" onClick={() => setMathUnits(u)} className={`flex-1 rounded-md border py-2.5 text-sm font-bold transition-all ${mathUnits === u ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30" : "bg-card border-border hover:border-primary/40"}`}>{u}</button>
                    ))}
                  </div>
                </FieldGroup>
              </div>
            )}

            {showHigherEd && (
              <>
                <FieldGroup label={isAr ? "مجال الدراسة" : "Field of Study"}>
                  <Input value={fieldOfStudy} onChange={(e) => setFieldOfStudy(e.target.value)} placeholder={isAr ? "مثال: هندسة برمجيات" : "e.g. Software Engineering"} dir={dir} className="h-11" />
                </FieldGroup>
                <FieldGroup label={isAr ? "مستوى الإنجليزية" : "English Proficiency"}>
                  <div className="flex gap-2">
                    {["beginner", "intermediate", "advanced"].map((lvl) => (
                      <button key={lvl} type="button" onClick={() => setEnglishProficiency(lvl)} className={`flex-1 rounded-md border py-2.5 text-xs font-medium ${englishProficiency === lvl ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                        {isAr ? ({ beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" } as Record<string, string>)[lvl] : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              </>
            )}

            <FieldGroup label={isAr ? "التخصص المفضّل (اختياري)" : "Preferred major (optional)"}>
              <Input value={preferredMajor} onChange={(e) => setPreferredMajor(e.target.value)} placeholder={t("apply.studyWishPlaceholder")} dir={dir} className="h-11" />
            </FieldGroup>
          </div>
        )}

        {/* Step 4 — Review + consent */}
        {step === 4 && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold">{isAr ? "راجع بياناتك قبل الإرسال" : "Review your details before submitting"}</p>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">{isAr ? "الاسم:" : "Name:"}</span> {fullName}</p>
                <p><span className="font-medium text-foreground">{isAr ? "الهاتف:" : "Phone:"}</span> {phone}</p>
                <p><span className="font-medium text-foreground">{isAr ? "المدينة:" : "City:"}</span> {city}</p>
                {educationLevel && <p><span className="font-medium text-foreground">{isAr ? "التعليم:" : "Education:"}</span> {isAr ? EDUCATION_LEVELS.find((x) => x.value === educationLevel)?.label : EDUCATION_LEVELS.find((x) => x.value === educationLevel)?.labelEn}</p>}
                {showBagrut && <p><span className="font-medium text-foreground">{isAr ? "الوحدات:" : "Units:"}</span> {mathUnits} Math · {englishUnits} English</p>}
                {preferredMajor && <p><span className="font-medium text-foreground">{isAr ? "التخصص:" : "Major:"}</span> {preferredMajor}</p>}
                <p><span className="font-medium text-foreground">{isAr ? "التقديم:" : "Applying:"}</span> {applyingWith === "alone" ? (isAr ? "لوحدك" : "Alone") : (isAr ? "مع صديق / قريب" : "With a friend / relative")}</p>
              </div>
            </div>
            <ConsentBlock
              isAr={isAr}
              collected={t("apply.collectedData", { defaultValue: isAr ? "الاسم، رقم الهاتف، المدينة، نوع جواز السفر والمعلومات الدراسية" : "your name, phone number, city, passport type and education details" })}
              agreed={consentAgreed}
              onAgreedChange={setConsentAgreed}
              showMarketing={false}
              detailsLabel={t("apply.consentDetails", { defaultValue: isAr ? "كيف نستخدم بياناتك؟" : "How we use your data" })}
              agreeLabel={t("apply.consentAgree", { defaultValue: isAr ? "أوافق على معالجة بياناتي والتواصل معي بخصوص طلبي. *" : "I agree to the processing of my data and contact about my application. *" })}
            />
          </div>
        )}

        {step === TOTAL_STEPS && (
          <ConsentBlock
            isAr={isAr}
            collected={t("apply.collectedData")}
            agreed={consentAgreed}
            onAgreedChange={setConsentAgreed}
            showMarketing={false}
            detailsLabel={t("apply.consentDetails")}
            agreeLabel={t("apply.consentAgree")}
          />
        )}

        {/* Navigation */}
        <div className="flex gap-3 border-t border-border pt-6">
          {step > 1 && (
            <Button variant="outline" className="flex-1 h-11 rounded-md" onClick={() => setStep((s) => s - 1)}>
              <BackIcon className="h-4 w-4" />
              {isAr ? "رجوع" : "Back"}
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button className="flex-1 h-11 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => setStep((s) => s + 1)} disabled={!canGoNext()}>
              {isAr ? "التالي" : "Next"}
              <NextIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button data-testid="apply-submit" className="flex-1 h-11 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSubmit} disabled={loading || !canGoNext() || !consentAgreed}>
              {loading ? "..." : isAr ? "أرسل بياناتي" : "Submit"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // ── The same quiet shell works for the public and partner application. ──
  return (
    <div dir={dir} className={embedded ? "mx-auto w-full max-w-lg px-4 py-8" : "mx-auto w-full max-w-lg px-5 py-10 sm:py-16"}>
      {!embedded && <div className="mb-10 space-y-3 text-start">
        <p className="text-sm leading-7 text-muted-foreground">{t("apply.applicationIntro")}</p>
      </div>}
      <div className="mb-8 flex gap-1.5" role="progressbar" aria-label={t("apply.progressLabel")} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step}>
        {Array.from({ length: TOTAL_STEPS }, (_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < step ? "bg-brand-strong" : "bg-muted"}`} />)}
      </div>
      {formCard}
    </div>
  );
};

export default ApplyForm;
