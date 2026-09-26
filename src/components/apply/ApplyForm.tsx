import React, { useState, useEffect } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, ChevronLeft, ChevronRight, Users, UserRound, Loader2, ArrowUpRight, Sparkles, HeartHandshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDirection } from "@/hooks/useDirection";
import { captureReferralCode, getReferralCode, verifyReferralCode, shouldKeepReferralCode } from "@/lib/referral";
import FieldGroup from "@/components/common/FieldGroup";
import ConsentBlock from "@/components/common/ConsentBlock";
import PublicOfficeBooking from "./PublicOfficeBooking";
import MajorAutocomplete, { type MajorValue } from "./MajorAutocomplete";
import { recordConsent } from "@/lib/consent";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";
import {
  PASSPORT_TYPES,
  EDUCATION_LEVELS,
  UNIT_OPTIONS,
  APPLYING_WITH_OPTIONS,
  EMPTY_COMPANION,
  APPLY_TOTAL_STEPS,
  GROUP_VALUE_AMOUNT_ILS,
  type ApplyingWith,
} from "./applyConstants";

const isDev = Boolean(import.meta.env.DEV);
const debugError = (...args: unknown[]) => { if (isDev) console.error(...args); };

export interface ApplyFormProps {
  /** When true, renders only the form (no public chrome) for dashboards. */
  embedded?: boolean;
  /** When true, sends the caller's session token so the case is attributed
   *  to the logged-in partner server-side. Public apply uses the anon key. */
  useSessionAuth?: boolean;
  /** Called once after a successful submission. */
  onSubmitted?: () => void;
}

type Applicant = typeof EMPTY_COMPANION;

const isValidPhone = (p: string) => {
  const cleaned = p.replace(/[\s\-()]/g, "");
  return /^05\d{8}$/.test(cleaned) || /^\+9725\d{8}$/.test(cleaned) || /^\+?\d{7,15}$/.test(cleaned);
};

const applicantComplete = (a: Applicant) =>
  Boolean(a.name.trim() && isValidPhone(a.phone) && a.city.trim()) &&
  (a.education !== "bagrut" || Boolean(a.englishUnits && a.mathUnits));

/** One applicant's fields. Used for the primary applicant and the companion so
 *  both collect the same information with the same checks. */
function ApplicantFields({ value, onChange, part, dir }: {
  value: Applicant;
  onChange: (patch: Partial<Applicant>) => void;
  part: "personal" | "education" | "all";
  dir: string;
}) {
  const { t, i18n } = useTranslation("landing");
  const lang = i18n.language;
  const edLabel = (l: (typeof EDUCATION_LEVELS)[number]) => (lang.startsWith("ar") ? l.label : l.labelEn);
  const phoneError = value.phone.trim() && !isValidPhone(value.phone) ? t("apply.phoneInvalid") : "";
  const major: MajorValue = { text: value.preferredMajor, majorId: value.preferredMajorId };
  const chip = (on: boolean) => `rounded-md border px-3 py-2.5 text-sm font-medium transition-all ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"}`;

  return (
    <div className="space-y-4">
      {part !== "education" && (
        <>
          <FieldGroup label={`${t("apply.fullName")} *`}>
            <Input value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={t("apply.fullNamePlaceholder")} dir={dir} className="h-11" autoComplete="name" />
          </FieldGroup>
          <FieldGroup label={`${t("apply.phone")} *`}>
            <Input value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="050-1234567" dir="ltr" type="tel" className={`h-11 ${phoneError ? "border-destructive" : ""}`} aria-invalid={Boolean(phoneError)} autoComplete="tel" />
            {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
          </FieldGroup>
          <FieldGroup label={`${t("apply.city")} *`}>
            <Input value={value.city} onChange={(e) => onChange({ city: e.target.value })} placeholder={t("apply.cityPlaceholder")} dir={dir} className="h-11" />
          </FieldGroup>
          <details className="text-start text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium">{t("apply.extraDetails")}</summary>
            <div className="mt-3 grid gap-2">
              {PASSPORT_TYPES.map((pt) => (
                <button key={pt.value} type="button" aria-pressed={value.passportType === pt.value} onClick={() => onChange({ passportType: pt.value })} className={`${chip(value.passportType === pt.value)} text-start`}>
                  {lang.startsWith("ar") ? pt.label : pt.labelEn}
                </button>
              ))}
            </div>
          </details>
        </>
      )}
      {part !== "personal" && (
        <>
          <FieldGroup label={t("apply.educationLevel")}>
            <div className="grid grid-cols-2 gap-2">
              {EDUCATION_LEVELS.map((lvl) => (
                <button key={lvl.value} type="button" aria-pressed={value.education === lvl.value} onClick={() => onChange({ education: lvl.value })} className={`${chip(value.education === lvl.value)} text-xs`}>{edLabel(lvl)}</button>
              ))}
            </div>
          </FieldGroup>
          {value.education === "bagrut" && (
            <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold">{t("apply.bagrutUnitsIntro")}</p>
              {(["englishUnits", "mathUnits"] as const).map((key) => (
                <FieldGroup key={key} label={`${t(key === "englishUnits" ? "apply.englishUnits" : "apply.mathUnits")} *`}>
                  <div className="flex gap-2">
                    {UNIT_OPTIONS.map((u) => (
                      <button key={u} type="button" aria-pressed={value[key] === u} onClick={() => onChange({ [key]: u })} className={`flex-1 font-bold ${chip(value[key] === u)}`}>{u}</button>
                    ))}
                  </div>
                </FieldGroup>
              ))}
            </div>
          )}
          <FieldGroup label={t("apply.preferredMajor")}>
            <MajorAutocomplete value={major} onChange={(v) => onChange({ preferredMajor: v.text, preferredMajorId: v.majorId })} dir={dir} />
          </FieldGroup>
        </>
      )}
    </div>
  );
}

/** Review rows for one applicant. */
function ApplicantSummary({ a, applyingWith }: { a: Applicant; applyingWith?: ApplyingWith }) {
  const { t, i18n } = useTranslation("landing");
  const ed = EDUCATION_LEVELS.find((x) => x.value === a.education);
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-3 py-1.5"><dt className="w-24 shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 font-medium text-foreground">{children}</dd></div>
  );
  return (
    <dl className="divide-y divide-border/60 text-sm">
      <Row label={t("apply.reviewName")}>{a.name}</Row>
      <Row label={t("apply.reviewPhone")}><span dir="ltr">{a.phone}</span></Row>
      <Row label={t("apply.reviewCity")}>{a.city}</Row>
      {ed && <Row label={t("apply.reviewEducation")}>{i18n.language.startsWith("ar") ? ed.label : ed.labelEn}</Row>}
      {a.education === "bagrut" && <Row label={t("apply.reviewUnits")}><span dir="ltr">{a.mathUnits} Math · {a.englishUnits} English</span></Row>}
      {a.preferredMajor && <Row label={t("apply.reviewMajor")}>{a.preferredMajor}{a.preferredMajorId ? "" : ` (${t("apply.majorNotMatchedShort")})`}</Row>}
      {applyingWith && <Row label={t("apply.reviewApplying")}>{t(`apply.with_${applyingWith}`)}</Row>}
    </dl>
  );
}

/**
 * The multi-step apply form, shared by the public /apply page and the
 * in-dashboard partner apply page.
 *
 * Flow: details -> education + major -> review (+ consent, once) -> who are you
 * applying with -> (public) booking -> short processing -> application received.
 */
const ApplyForm: React.FC<ApplyFormProps> = ({ embedded = false, useSessionAuth = false, onSubmitted }) => {
  const { t, i18n } = useTranslation("landing");
  const { dir, isRtl } = useDirection();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<"form" | "booking" | "processing" | "done">("form");
  const [loading, setLoading] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [me, setMe] = useState<Applicant>({ ...EMPTY_COMPANION });
  const [englishProficiency, setEnglishProficiency] = useState("");
  const [applyingWith, setApplyingWith] = useState<ApplyingWith>("alone");
  const [companion, setCompanion] = useState<Applicant>({ ...EMPTY_COMPANION });
  const [refCode, setRefCode] = useState<string | null>(() => getReferralCode());
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [companionFailed, setCompanionFailed] = useState(false);

  useEffect(() => {
    const code = captureReferralCode(searchParams.toString());
    setRefCode(code);
    if (!code) return;
    let active = true;
    verifyReferralCode(code).then((health) => {
      // Keep valid OR unverified codes: the server resolves again at submit, so
      // a transient lookup failure must never strip a partner's attribution.
      if (active && !shouldKeepReferralCode(health)) setRefCode(null);
    });
    return () => { active = false; };
  }, [searchParams]);

  // Brief processing moment before the final confirmation.
  useEffect(() => {
    if (phase !== "processing") return;
    const id = setTimeout(() => setPhase("done"), 1500);
    return () => clearTimeout(id);
  }, [phase]);

  const hasCompanion = applyingWith !== "alone";
  const showHigherEd = me.education === "bachelor" || me.education === "master";

  const canGoNext = () => {
    if (step === 1) return Boolean(me.name.trim() && isValidPhone(me.phone) && me.city.trim());
    if (step === 2) return me.education !== "bagrut" || Boolean(me.englishUnits && me.mathUnits);
    if (step === 3) return consentAgreed;
    if (step === 4) return !hasCompanion || applicantComplete(companion);
    return false;
  };

  const buildHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (useSessionAuth) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } else {
      headers["apikey"] = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    }
    return headers;
  };

  const payloadFor = (a: Applicant, extra: Record<string, unknown> = {}) => ({
    full_name: a.name.trim(),
    phone_number: a.phone.trim(),
    source: "apply_page",
    ref_code: refCode,
    city: a.city.trim() || null,
    education_level: a.education || null,
    bagrut_score: null,
    english_units: a.englishUnits ? parseInt(a.englishUnits) : null,
    math_units: a.mathUnits ? parseInt(a.mathUnits) : null,
    passport_type: a.passportType || null,
    degree_interest: a.preferredMajor.trim() || null,
    preferred_major_id: a.preferredMajorId,
    ...extra,
  });

  const handleSubmit = async () => {
    if (loading || !consentAgreed) return;
    setLoading(true);
    void recordConsent({ sourceForm: "apply_page", subjectName: me.name, phone: me.phone, serviceContact: true, marketing: false, locale: i18n.language });

    const caseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/create-case-from-apply`;
    const headers = await buildHeaders();
    try {
      const resp = await fetch(caseUrl, { method: "POST", headers, body: JSON.stringify(payloadFor(me, { english_level: englishProficiency || null })) });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to create case");
      const token = typeof result.booking_token === "string" ? result.booking_token : null;
      setBookingToken(token);

      // The companion is filed as their own case — it never overwrites the
      // primary applicant's record.
      if (hasCompanion) {
        try {
          const c = await fetch(caseUrl, { method: "POST", headers, body: JSON.stringify(payloadFor(companion)) });
          if (!c.ok && c.status !== 409) setCompanionFailed(true);
        } catch { setCompanionFailed(true); }
      }

      onSubmitted?.();
      setPhase(token && !useSessionAuth ? "booking" : "processing");
    } catch (err: unknown) {
      debugError("[ApplyForm] Submission failed:", err);
      toast({ title: t("apply.error"), description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const stepTitles = [t("apply.personalStep"), t("apply.educationStep"), t("apply.reviewStep"), t("apply.companionStep")];

  // ── Booking (strongly encouraged, skippable) ─────────────────────
  if (phase === "booking" && bookingToken) {
    return (
      <div dir={dir} className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-14">
        <div className="mb-6 space-y-2 text-start">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-brand-strong"><Sparkles className="size-3.5" aria-hidden="true" />{t("apply.bookEarlyEyebrow")}</p>
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{t("apply.bookEarlyTitle")}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{t("apply.bookEarlyBody")}</p>
        </div>
        <PublicOfficeBooking token={bookingToken} autoOpen onBooked={() => setPhase("processing")} />
        <div className="mt-6 text-center">
          <button type="button" onClick={() => setPhase("processing")} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{t("apply.skipForNow")}</button>
        </div>
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div dir={dir} className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5" role="status" aria-live="polite">
        <Loader2 className="size-10 animate-spin text-brand-strong motion-reduce:animate-none" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("apply.processing")}</p>
      </div>
    );
  }

  // ── Application received — the final moment ──────────────────────
  if (phase === "done") {
    const majorHref = me.preferredMajorId
      ? `/educational-programs?major=${encodeURIComponent(me.preferredMajorId)}`
      : me.preferredMajor.trim() ? `/educational-programs?q=${encodeURIComponent(me.preferredMajor.trim())}` : null;
    return (
      <div dir={dir} className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-16">
        <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 text-start" role="status" aria-live="polite">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md animate-scale-in motion-reduce:animate-none">
              <CheckCircle className="size-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{t("apply.receivedTitle")}</h2>
              <p className="leading-7 text-muted-foreground">{t("apply.receivedBody")}</p>
            </div>
            {companionFailed && <p className="text-sm text-destructive">{t("apply.companionFailure", { count: 1 })}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              {majorHref && (
                <a href={majorHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t("apply.viewMyMajor")}<ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </a>
              )}
              <a href="/educational-programs" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-6 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t("apply.browsePrograms")}
              </a>
            </div>
          </div>
          {/* Homepage-style blue arch with student photography */}
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
            <div className="absolute inset-0 rounded-t-full bg-primary" aria-hidden="true" />
            <div className="absolute -bottom-3 -end-3 size-20 rounded-full bg-brand" aria-hidden="true" />
            <img src={DARB_PUBLIC_HERO_IMAGES.programs} alt={t("apply.receivedImageAlt")} className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rounded-t-full object-cover" loading="lazy" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────
  const formCard = (
    <div className="w-full" data-testid="apply-form" data-step={step}>
      <div className="space-y-1 pb-6">
        <p className="text-xs font-semibold text-brand-strong">{t("apply.step")} {step} / {APPLY_TOTAL_STEPS}</p>
        <h2 className="text-2xl font-bold leading-tight text-foreground">{stepTitles[step - 1]}</h2>
      </div>
      <div className="space-y-6">
        {step === 1 && <div className="animate-fade-in"><ApplicantFields value={me} onChange={(p) => setMe((s) => ({ ...s, ...p }))} part="personal" dir={dir} /></div>}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <ApplicantFields value={me} onChange={(p) => setMe((s) => ({ ...s, ...p }))} part="education" dir={dir} />
            {showHigherEd && (
              <FieldGroup label={t("apply.englishProficiency")}>
                <div className="flex gap-2">
                  {(["beginner", "intermediate", "advanced"] as const).map((lvl) => (
                    <button key={lvl} type="button" aria-pressed={englishProficiency === lvl} onClick={() => setEnglishProficiency(lvl)} className={`flex-1 rounded-md border py-2.5 text-xs font-medium ${englishProficiency === lvl ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>{t(`apply.level_${lvl}`)}</button>
                  ))}
                </div>
              </FieldGroup>
            )}
          </div>
        )}

        {/* Review + the single consent block */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="mb-2 text-sm font-semibold">{t("apply.reviewTitle")}</p>
              <ApplicantSummary a={me} />
            </div>
            <ConsentBlock
              isAr={i18n.language.startsWith("ar")}
              collected={t("apply.collectedData")}
              agreed={consentAgreed}
              onAgreedChange={setConsentAgreed}
              showMarketing={false}
              detailsLabel={t("apply.consentDetails")}
              agreeLabel={t("apply.consentAgree")}
            />
          </div>
        )}

        {/* Who are you applying with — last step before booking */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {APPLYING_WITH_OPTIONS.map((opt) => {
                const Icon = opt === "alone" ? UserRound : opt === "friend" ? Users : HeartHandshake;
                return (
                  <button key={opt} type="button" aria-pressed={applyingWith === opt} onClick={() => setApplyingWith(opt)} className={`rounded-xl border p-4 text-start transition-all ${applyingWith === opt ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"}`}>
                    <Icon className="mb-3 size-5 text-brand-strong" aria-hidden="true" />
                    <p className="font-semibold">{t(`apply.with_${opt}`)}</p>
                  </button>
                );
              })}
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
              <Sparkles className="mt-1 size-4 shrink-0 text-brand-strong" aria-hidden="true" />
              {t("apply.groupValue", { amount: GROUP_VALUE_AMOUNT_ILS })}
            </p>
            {hasCompanion && (
              <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4 animate-fade-in">
                <p className="text-sm font-semibold">{t(applyingWith === "friend" ? "apply.secondApplicantFriend" : "apply.secondApplicantRelative")}</p>
                <ApplicantFields value={companion} onChange={(p) => setCompanion((s) => ({ ...s, ...p }))} part="all" dir={dir} />
              </div>
            )}
            {hasCompanion && applicantComplete(companion) && (
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-sm font-semibold">{t("apply.applicant1")}</p>
                <ApplicantSummary a={me} applyingWith={applyingWith} />
                <p className="mb-2 mt-4 text-sm font-semibold">{t("apply.applicant2")}</p>
                <ApplicantSummary a={companion} />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 border-t border-border pt-6">
          {step > 1 && (
            <Button variant="outline" className="h-11 flex-1 rounded-md" onClick={() => setStep((s) => s - 1)}>
              <BackIcon className="h-4 w-4" />{t("apply.back")}
            </Button>
          )}
          {step < APPLY_TOTAL_STEPS ? (
            <Button className="h-11 flex-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setStep((s) => s + 1)} disabled={!canGoNext()}>
              {t("apply.next")}<NextIcon className="h-4 w-4" />
            </Button>
          ) : (
            <Button data-testid="apply-submit" className="h-11 flex-1 rounded-md bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSubmit} disabled={loading || !canGoNext() || !consentAgreed}>
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{t("apply.submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div dir={dir} className={embedded ? "mx-auto w-full max-w-lg px-4 py-8" : "mx-auto w-full max-w-lg px-5 py-10 sm:py-16"}>
      {!embedded && <p className="mb-10 text-start md:hidden text-sm leading-7 text-muted-foreground">{t("apply.applicationIntro")}</p>}
      <div className="mb-8 flex gap-1.5" role="progressbar" aria-label={t("apply.progressLabel")} aria-valuemin={1} aria-valuemax={APPLY_TOTAL_STEPS} aria-valuenow={step}>
        {Array.from({ length: APPLY_TOTAL_STEPS }, (_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < step ? "bg-brand-strong" : "bg-muted"}`} />)}
      </div>
      {formCard}
    </div>
  );
};

export default ApplyForm;
