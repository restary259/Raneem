import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ChevronLeft, ChevronRight, GraduationCap, Shield, Headphones } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDirection } from "@/hooks/useDirection";

const PASSPORT_TYPES = [
  { value: "israeli_blue", label: "جواز أزرق (إسرائيلي)", labelEn: "Israeli Blue Passport" },
  { value: "israeli_red", label: "جواز أحمر (لم الشمل)", labelEn: "Israeli Red Passport" },
  { value: "other", label: "أخرى", labelEn: "Other" },
];

const EDUCATION_LEVELS = [
  { value: "bagrut", label: "بجروت (תעודת בגרות)", labelEn: "Bagrut (תעודת בגרות)" },
  { value: "bachelor", label: "بكالوريوس (תואר ראשון)", labelEn: "Bachelor (תואר ראשון)" },
  { value: "master", label: "ماجستير (תואר שני)", labelEn: "Master (תואר שני)" },
  { value: "other", label: "أخرى", labelEn: "Other" },
];

const UNIT_OPTIONS = ["3", "4", "5"];

const APPLYING_WITH_OPTIONS = [
  { value: "alone", label: "لا", labelEn: "No" },
  { value: "one", label: "نعم، مع شخص واحد", labelEn: "Yes, with 1 person" },
  { value: "multiple", label: "نعم، مع أكثر من شخص", labelEn: "Yes, with 2+ people" },
];

const ApplyPage: React.FC = () => {
  const { t, i18n } = useTranslation("landing");
  const { dir, isRtl } = useDirection();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isAr = i18n.language === "ar";

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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

  // Step 4 — Companion
  const [applyingWith, setApplyingWith] = useState("alone");
  const [companions, setCompanions] = useState<
    Array<{
      name: string;
      phone: string;
      passportType: string;
      city: string;
      education: string;
      englishUnits: string;
      mathUnits: string;
      preferredMajor: string;
    }>
  >([
    {
      name: "",
      phone: "",
      passportType: "",
      city: "",
      education: "",
      englishUnits: "",
      mathUnits: "",
      preferredMajor: "",
    },
  ]);

  // Referral
  const [sourceType, setSourceType] = useState("organic");
  const [sourceId, setSourceId] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem("darb_ref", ref);
    }
    const savedRef = ref || localStorage.getItem("darb_ref");
    if (savedRef) {
      const validateRef = async () => {
        try {
          const { data } = await supabase.rpc("validate_influencer_ref", { ref_id: savedRef });
          if (data === true) {
            setSourceType("influencer");
            setSourceId(savedRef);
          }
        } catch (err) {
          console.error("validate_influencer_ref failed:", err);
        }
      };
      validateRef();
    }
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

  const canGoNext = () => {
    if (step === 1) return fullName.trim() && phone.trim() && isValidPhone(phone);
    return true;
  };

  const showBagrut = educationLevel === "bagrut";
  const showHigherEd = educationLevel === "bachelor" || educationLevel === "master";
  const hasCompanions = applyingWith !== "alone";

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Submit main lead
      const { error } = await supabase.rpc("insert_lead_from_apply", {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_passport_type: passportType || null,
        p_english_units: englishUnits ? parseInt(englishUnits) : null,
        p_math_units: mathUnits ? parseInt(mathUnits) : null,
        p_education_level: educationLevel || null,
        p_german_level: null,
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_preferred_major: preferredMajor || null,
      } as any);
      if (error) {
        console.error("[ApplyPage] insert_lead_from_apply error:", error);
        throw error;
      }
      console.log("[ApplyPage] Main lead created for:", phone.trim());

      // Create a case for the main applicant
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      try {
        const caseResp = await fetch(`https://${projectId}.supabase.co/functions/v1/create-case-from-apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey },
          body: JSON.stringify({
            full_name: fullName.trim(),
            phone_number: phone.trim(),
            source: "apply_page",
            partner_id: sourceType === "influencer" ? sourceId : null,
            city: city.trim() || null,
            education_level: educationLevel || null,
            bagrut_score: null,
            english_level: englishProficiency || null,
            math_units: mathUnits ? parseInt(mathUnits) : null,
            passport_type: passportType || null,
            degree_interest: fieldOfStudy || null,
          }),
        });
        if (caseResp.status === 409) {
          console.log("[ApplyPage] Duplicate phone detected — case already exists");
        }
      } catch (caseErr) {
        console.warn("[ApplyPage] case creation warning:", caseErr);
      }

      // Submit each companion as a full separate lead + case
      // FIX: previously companions only got a lead, not a case — so they never appeared in the pipeline
      if (hasCompanions) {
        for (const c of companions) {
          if (c.name.trim() && c.phone.trim()) {
            // Create companion lead
            const { error: cErr } = await supabase.rpc("insert_lead_from_apply", {
              p_full_name: c.name.trim(),
              p_phone: c.phone.trim(),
              p_passport_type: c.passportType || null,
              p_city: c.city.trim() || null,
              p_preferred_city: c.city.trim() || null,
              p_education_level: c.education || null,
              p_english_units: c.englishUnits ? parseInt(c.englishUnits) : null,
              p_math_units: c.mathUnits ? parseInt(c.mathUnits) : null,
              p_preferred_major: c.preferredMajor.trim() || null,
              p_german_level: null,
              p_source_type: sourceType,
              p_source_id: sourceId,
            } as any);
            if (cErr) console.error("[ApplyPage] Companion lead error:", cErr);
            else console.log("[ApplyPage] Companion lead created for:", c.phone.trim());

            // Create companion case so they appear in the pipeline
            try {
              const companionCaseResp = await fetch(
                `https://${projectId}.supabase.co/functions/v1/create-case-from-apply`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: anonKey },
                  body: JSON.stringify({
                    full_name: c.name.trim(),
                    phone_number: c.phone.trim(),
                    source: "apply_page",
                    partner_id: sourceType === "influencer" ? sourceId : null,
                    city: c.city.trim() || null,
                    education_level: c.education || null,
                    passport_type: c.passportType || null,
                    math_units: c.mathUnits ? parseInt(c.mathUnits) : null,
                    bagrut_score: null,
                    english_level: null,
                    degree_interest: c.preferredMajor.trim() || null,
                  }),
                },
              );
              if (companionCaseResp.status === 409) {
                console.log("[ApplyPage] Companion duplicate — case already exists:", c.phone.trim());
              } else {
                console.log("[ApplyPage] Companion case created for:", c.phone.trim());
              }
            } catch (companionCaseErr) {
              console.warn("[ApplyPage] Companion case creation warning:", companionCaseErr);
            }
          }
        }
      }

      setSubmitted(true);
      setTimeout(() => {
        window.open("https://chat.whatsapp.com/J2njR5IJZj9JxLxV7GqxNo", "_blank");
      }, 5000);
    } catch (err: any) {
      console.error("[ApplyPage] Submission failed:", err);
      toast({
        title: t("apply.error", "حدث خطأ، حاول مرة أخرى"),
        description: err?.message || "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const TOTAL_STEPS = 4;
  const progressValue = (step / TOTAL_STEPS) * 100;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" dir={dir}>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <ApplyTopBar />
          <main className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center space-y-6 animate-fade-in">
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-accent/20 animate-[ping_1.5s_ease-out_infinite]" />
                <span className="absolute inset-2 rounded-full bg-accent/15 animate-[ping_1.5s_ease-out_0.3s_infinite]" />
                <div className="relative w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center animate-scale-in">
                  <CheckCircle className="h-10 w-10 text-accent" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">{t("apply.successTitle", "تم استلام بياناتك ✅")}</h2>
              <p className="text-muted-foreground">
                {t("apply.successSubtitle", "سيتم التواصل معك عبر واتساب قريباً")}
              </p>
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {isAr
                    ? "📩 سنتواصل معك خلال 24 إلى 48 ساعة عبر واتساب"
                    : "📩 We will contact you within 24 to 48 hours via WhatsApp"}
                </p>
              </div>
              {sourceId && (
                <p className="text-xs text-muted-foreground/60">
                  {isAr ? `كود المصدر: ${sourceId.slice(0, 8)}...` : `Ref: ${sourceId.slice(0, 8)}...`}
                </p>
              )}
              <div className="flex flex-col gap-3">
                <a href="https://chat.whatsapp.com/J2njR5IJZj9JxLxV7GqxNo" target="_blank" rel="noopener noreferrer">
                  <Button className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground text-base font-semibold">
                    💬 {isAr ? "انضم لمجموعة واتساب" : "Join WhatsApp Group"}
                  </Button>
                </a>
                <a href="/">
                  <Button variant="outline" className="w-full h-12 rounded-xl text-base font-semibold">
                    {t("apply.exploreWebsite", "تصفّح موقعنا")}
                  </Button>
                </a>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const stepTitles = [
    isAr ? "المعلومات الشخصية" : "Personal Information",
    isAr ? "الخلفية التعليمية" : "Education Background",
    isAr ? "التخصص المفضل" : "Desired Major",
    isAr ? "التقديم مع شخص آخر؟" : "Applying with someone?",
  ];

  const EMPTY_COMPANION = {
    name: "",
    phone: "",
    passportType: "",
    city: "",
    education: "",
    englishUnits: "",
    mathUnits: "",
    preferredMajor: "",
  };

  const addCompanion = () => {
    setCompanions((prev) => [...prev, { ...EMPTY_COMPANION }]);
  };

  const updateCompanion = (index: number, field: string, value: string) => {
    setCompanions((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeCompanion = (index: number) => {
    setCompanions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <ApplyTopBar />
        <main className="flex-1 flex flex-col items-center px-4 py-6 md:py-10 gap-6 max-w-lg mx-auto w-full">
          {/* Hero */}
          <section className="text-center space-y-2 animate-fade-in">
            <h1 className="text-xl md:text-2xl font-bold leading-tight">{t("apply.heroTitle")}</h1>
            <p className="text-muted-foreground text-sm">{t("apply.heroSubtitle")}</p>
          </section>

          {/* Step Indicators */}
          <div className="w-full flex items-center gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    s < step
                      ? "bg-accent text-accent-foreground"
                      : s === step
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s < step ? <CheckCircle className="h-4 w-4" /> : s}
                </div>
                <span className="text-[9px] text-muted-foreground text-center leading-tight hidden sm:block">
                  {stepTitles[s - 1]}
                </span>
              </div>
            ))}
          </div>

          <Progress value={progressValue} className="h-1.5 w-full" />

          {/* Form */}
          <div className="w-full bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <h2 className="text-sm font-semibold">{stepTitles[step - 1]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("apply.step", "خطوة")} {step} / {TOTAL_STEPS}
              </p>
            </div>

            <div className="p-5 space-y-5">
              {/* Step 1 — Identity */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <FieldGroup label={isAr ? "الاسم الكامل *" : "Full Name *"}>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={isAr ? "أدخل اسمك الكامل" : "Enter your full name"}
                      dir={dir}
                      className="h-11"
                    />
                  </FieldGroup>
                  <FieldGroup label={isAr ? "رقم الهاتف / واتساب *" : "Phone / WhatsApp *"}>
                    <Input
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="05X-XXXXXXX"
                      dir="ltr"
                      type="tel"
                      className={`h-11 ${phoneError ? "border-destructive" : ""}`}
                    />
                    {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                  </FieldGroup>
                  <FieldGroup label={isAr ? "نوع جواز السفر" : "Passport Type"}>
                    <div className="grid grid-cols-1 gap-2">
                      {PASSPORT_TYPES.map((pt) => (
                        <button
                          key={pt.value}
                          type="button"
                          onClick={() => setPassportType(pt.value)}
                          className={`w-full text-start px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                            passportType === pt.value
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"
                          }`}
                        >
                          {isAr ? pt.label : pt.labelEn}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                  <FieldGroup label={isAr ? "المدينة (اختياري)" : "City (optional)"}>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={isAr ? "مثال: حيفا" : "e.g. Haifa"}
                      dir={dir}
                      className="h-11"
                    />
                  </FieldGroup>
                </div>
              )}

              {/* Step 2 — Education */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <FieldGroup label={isAr ? "المستوى التعليمي" : "Education Level"}>
                    <div className="grid grid-cols-2 gap-2">
                      {EDUCATION_LEVELS.map((lvl) => (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => setEducationLevel(lvl.value)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                            educationLevel === lvl.value
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"
                          }`}
                        >
                          {isAr ? lvl.label : lvl.labelEn}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>

                  {showBagrut && (
                    <>
                      <FieldGroup label={isAr ? "وحدات الإنجليزي" : "English Units"}>
                        <div className="flex gap-2">
                          {UNIT_OPTIONS.map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setEnglishUnits(u)}
                              className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                                englishUnits === u
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border hover:border-primary/40"
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </FieldGroup>
                      <FieldGroup label={isAr ? "وحدات الرياضيات" : "Math Units"}>
                        <div className="flex gap-2">
                          {UNIT_OPTIONS.map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setMathUnits(u)}
                              className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                                mathUnits === u
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border hover:border-primary/40"
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </FieldGroup>
                    </>
                  )}

                  {showHigherEd && (
                    <>
                      <FieldGroup label={isAr ? "مجال الدراسة" : "Field of Study"}>
                        <Input
                          value={fieldOfStudy}
                          onChange={(e) => setFieldOfStudy(e.target.value)}
                          placeholder={isAr ? "مثال: هندسة برمجيات" : "e.g. Software Engineering"}
                          dir={dir}
                          className="h-11"
                        />
                      </FieldGroup>
                      <FieldGroup label={isAr ? "مستوى الإنجليزية" : "English Proficiency"}>
                        <div className="flex gap-2">
                          {["beginner", "intermediate", "advanced"].map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setEnglishProficiency(lvl)}
                              className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                                englishProficiency === lvl
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border hover:border-primary/40"
                              }`}
                            >
                              {isAr
                                ? ({ beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" } as any)[lvl]
                                : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                            </button>
                          ))}
                        </div>
                      </FieldGroup>
                    </>
                  )}
                </div>
              )}

              {/* Step 3 — Desired Major */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <FieldGroup label={isAr ? "التخصص المفضل" : "Preferred Major"}>
                    <Input
                      value={preferredMajor}
                      onChange={(e) => setPreferredMajor(e.target.value)}
                      placeholder={isAr ? "اكتب التخصص الذي تريده..." : "Type your desired major..."}
                      dir={dir}
                      className="h-11"
                    />
                  </FieldGroup>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "يمكنك تخطي هذه الخطوة إذا لم تكن متأكدًا بعد"
                      : "You can skip this step if you're not sure yet"}
                  </p>
                </div>
              )}

              {/* Step 4 — Applying with someone? */}
              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <FieldGroup
                    label={
                      isAr
                        ? "هل تتقدم مع فرد من العائلة أو صديق؟"
                        : "Are you applying with a family member or a friend?"
                    }
                  >
                    <div className="grid grid-cols-1 gap-2">
                      {APPLYING_WITH_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setApplyingWith(opt.value);
                            if (opt.value === "alone") setCompanions([{ ...EMPTY_COMPANION }]);
                            if (opt.value === "multiple" && companions.length < 2)
                              setCompanions((prev) => [...prev, { ...EMPTY_COMPANION }]);
                          }}
                          className={`w-full text-start px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                            applyingWith === opt.value
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"
                          }`}
                        >
                          {isAr ? opt.label : opt.labelEn}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>

                  {hasCompanions && (
                    <div className="space-y-5 p-4 rounded-xl bg-muted/30 border border-border animate-fade-in">
                      {companions.map((c, idx) => (
                        <div key={idx} className="space-y-3">
                          {companions.length > 1 && (
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground/70">
                                {isAr ? `الشخص ${idx + 1}` : `Person ${idx + 1}`}
                              </p>
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => removeCompanion(idx)}
                                  className="text-xs text-destructive hover:underline"
                                >
                                  {isAr ? "حذف" : "Remove"}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Name */}
                          <FieldGroup label={isAr ? "الاسم الكامل *" : "Full Name *"}>
                            <Input
                              value={c.name}
                              onChange={(e) => updateCompanion(idx, "name", e.target.value)}
                              placeholder={isAr ? "الاسم الكامل" : "Full name"}
                              dir={dir}
                              className="h-11"
                            />
                          </FieldGroup>

                          {/* Phone */}
                          <FieldGroup label={isAr ? "رقم الهاتف / واتساب *" : "Phone / WhatsApp *"}>
                            <Input
                              value={c.phone}
                              onChange={(e) => updateCompanion(idx, "phone", e.target.value)}
                              placeholder="05X-XXXXXXX"
                              dir="ltr"
                              type="tel"
                              className="h-11"
                            />
                          </FieldGroup>

                          {/* Passport Type */}
                          <FieldGroup label={isAr ? "نوع جواز السفر" : "Passport Type"}>
                            <div className="grid grid-cols-1 gap-2">
                              {PASSPORT_TYPES.map((pt) => (
                                <button
                                  key={pt.value}
                                  type="button"
                                  onClick={() => updateCompanion(idx, "passportType", pt.value)}
                                  className={`w-full text-start px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                                    c.passportType === pt.value
                                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                      : "bg-card border-border hover:border-primary/40"
                                  }`}
                                >
                                  {isAr ? pt.label : pt.labelEn}
                                </button>
                              ))}
                            </div>
                          </FieldGroup>

                          {/* City */}
                          <FieldGroup label={isAr ? "المدينة (اختياري)" : "City (optional)"}>
                            <Input
                              value={c.city}
                              onChange={(e) => updateCompanion(idx, "city", e.target.value)}
                              placeholder={isAr ? "مثال: حيفا" : "e.g. Haifa"}
                              dir={dir}
                              className="h-11"
                            />
                          </FieldGroup>

                          {/* Education Level */}
                          <FieldGroup label={isAr ? "المستوى التعليمي" : "Education Level"}>
                            <div className="grid grid-cols-2 gap-2">
                              {EDUCATION_LEVELS.map((lvl) => (
                                <button
                                  key={lvl.value}
                                  type="button"
                                  onClick={() => updateCompanion(idx, "education", lvl.value)}
                                  className={`px-2 py-2 rounded-xl border text-[11px] font-medium transition-all ${
                                    c.education === lvl.value
                                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                      : "bg-card border-border hover:border-primary/40"
                                  }`}
                                >
                                  {isAr ? lvl.label : lvl.labelEn}
                                </button>
                              ))}
                            </div>
                          </FieldGroup>

                          {/* Bagrut Units */}
                          {c.education === "bagrut" && (
                            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-background/60 border border-border animate-fade-in">
                              <FieldGroup label={isAr ? "وحدات الإنجليزي" : "English Units"}>
                                <div className="flex gap-1.5">
                                  {UNIT_OPTIONS.map((u) => (
                                    <button
                                      key={u}
                                      type="button"
                                      onClick={() => updateCompanion(idx, "englishUnits", u)}
                                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                                        c.englishUnits === u
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "bg-card border-border hover:border-primary/40"
                                      }`}
                                    >
                                      {u}
                                    </button>
                                  ))}
                                </div>
                              </FieldGroup>
                              <FieldGroup label={isAr ? "وحدات الرياضيات" : "Math Units"}>
                                <div className="flex gap-1.5">
                                  {UNIT_OPTIONS.map((u) => (
                                    <button
                                      key={u}
                                      type="button"
                                      onClick={() => updateCompanion(idx, "mathUnits", u)}
                                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                                        c.mathUnits === u
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "bg-card border-border hover:border-primary/40"
                                      }`}
                                    >
                                      {u}
                                    </button>
                                  ))}
                                </div>
                              </FieldGroup>
                            </div>
                          )}

                          {/* Preferred Major */}
                          <FieldGroup label={isAr ? "التخصص المفضل (اختياري)" : "Preferred Major (optional)"}>
                            <Input
                              value={c.preferredMajor}
                              onChange={(e) => updateCompanion(idx, "preferredMajor", e.target.value)}
                              placeholder={isAr ? "مثال: هندسة، طب..." : "e.g. Engineering, Medicine..."}
                              dir={dir}
                              className="h-11"
                            />
                          </FieldGroup>

                          {idx < companions.length - 1 && <hr className="border-border" />}
                        </div>
                      ))}

                      {applyingWith === "multiple" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full rounded-xl"
                          onClick={addCompanion}
                        >
                          {isAr ? "+ إضافة شخص آخر" : "+ Add another person"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep((s) => s - 1)}>
                    <BackIcon className="h-4 w-4" />
                    {isAr ? "رجوع" : "Back"}
                  </Button>
                )}
                {step < TOTAL_STEPS ? (
                  <Button
                    className="flex-1 h-11 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!canGoNext()}
                  >
                    {isAr ? "التالي" : "Next"}
                    <NextIcon className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 h-11 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={handleSubmit}
                    disabled={loading || !canGoNext()}
                  >
                    {loading ? "..." : isAr ? "أرسل بياناتي" : "Submit"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-2.5 w-full">
            {[
              { icon: GraduationCap, label: t("apply.trustBadge1", "استشارة مجانية") },
              { icon: Shield, label: t("apply.trustBadge2", "مدارس معتمدة") },
              { icon: Headphones, label: t("apply.trustBadge3", "متابعة حتى التسجيل") },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 text-center p-3 rounded-xl border border-border bg-card text-xs text-muted-foreground"
              >
                <Icon className="h-5 w-5 text-accent" />
                <span className="leading-tight">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground/60 text-center pb-4">
            Darb Study International © {new Date().getFullYear()}
          </p>
        </main>
      </div>
    </div>
  );
};

/* --- Sub-components --- */

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground/80">{label}</label>
    {children}
  </div>
);

const ApplyTopBar = () => <header className="h-3 bg-gradient-to-r from-primary via-accent to-primary" />;

export default ApplyPage;
