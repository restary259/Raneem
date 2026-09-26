import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Instagram, Facebook, Mail, MessageCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useDirection } from "@/hooks/useDirection";
import { supabase } from "@/integrations/supabase/client";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { SUPPORT_EMAIL } from "@/lib/contactConfig";
import { DARB_CONTACT_ADVISOR_SRC } from "@/assets/darbContactAdvisor";
import { recordConsent } from "@/lib/consent";
import ConsentBlock from "@/components/common/ConsentBlock";
import FieldGroup from "@/components/common/FieldGroup";
import TikTokIcon from "../icons/TikTokIcon";
import Map from "./Map";
import OfficeLocations from "./OfficeLocations";

const TOPICS = ["admissions", "language_courses", "visa", "accommodation", "partnership", "general"] as const;

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().max(255).refine((value) => value === "" || z.string().email().safeParse(value).success),
  phone: z.string().trim().max(30),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(5).max(2000),
}).refine((value) => value.email.length > 0 || value.phone.length > 0, { path: ["contact"] });

type FieldErrors = Partial<Record<"fullName" | "email" | "phone" | "topic" | "message" | "contact" | "consent", string>>;

const isValidPhone = (phone: string) => /^\+?[\d\s()-]{7,30}$/.test(phone);

const Contact = () => {
  const { t, i18n } = useTranslation(["contact", "common"]);
  const { dir } = useDirection();
  const isAr = i18n.language === "ar";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number] | "">("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = () => {
    const parsed = contactSchema.safeParse({ fullName, email, phone, topic, message });
    const next: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!next[key]) next[key] = t(`contact.validation.${key}`);
      }
    }
    if (phone.trim() && !isValidPhone(phone.trim())) next.phone = t("contact.validation.phone");
    if (!consentAgreed) next.consent = t("contact.validation.consent");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error(t("contact.validation.review"));
      if (honeypot) return;

      const submissionId = crypto.randomUUID();
      const { error } = await supabase.from("contact_submissions").insert({
        id: submissionId,
        form_source: "contact_form",
        status: "new",
        data: {
          full_name: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          topic,
          message: message.trim(),
          locale: isAr ? "ar" : "en",
        },
      });
      if (error) throw error;

      void recordConsent({
        sourceForm: "contact_form",
        subjectName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        serviceContact: true,
        marketing: marketingConsent,
        marketingChannels: marketingConsent ? { email: Boolean(email.trim()), whatsapp: Boolean(phone.trim()), sms: false } : undefined,
        locale: isAr ? "ar" : "en",
      });
    },
    onSuccess: () => {
      toast({ title: t("contact.toast.successTitle"), description: t("contact.toast.successDescription") });
      setFullName("");
      setEmail("");
      setPhone("");
      setTopic("");
      setMessage("");
      setConsentAgreed(false);
      setMarketingConsent(false);
      setErrors({});
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: t("contact.toast.errorTitle"), description: error.message });
    },
  });

  return (
    <section id="contact" className="bg-editorial-paper py-10 md:py-16">
      <div className="container mx-auto px-4">
        <div className="mb-8 grid items-center gap-4 border-b border-border pb-8 sm:grid-cols-[auto_minmax(0,1fr)] md:mb-10 md:gap-7 md:pb-10">
          <div className="relative mx-auto size-24 shrink-0 sm:mx-0 md:size-32">
            <img src={DARB_CONTACT_ADVISOR_SRC} alt={t("contactHero.imageAlt")} className="size-full rounded-full border border-border object-cover shadow-surface" />
            <span aria-hidden="true" className="absolute inset-x-3 -bottom-1 h-1 rounded-full bg-brand" />
          </div>
          <div className="min-w-0 text-center sm:text-start">
            <p className="text-xs font-bold uppercase text-brand-strong">{t("contactHero.advisorEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-bold text-primary md:text-3xl">{t("contactHero.advisorTitle")}</h2>
            <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">{t("contactHero.advisorBody")}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:flex sm:justify-start">
              <Button asChild><a href={whatsappBusinessUrl(t("contactHero.whatsappMessage"))} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("support.whatsapp")}</a></Button>
              <Button asChild variant="outline"><a href={`mailto:${SUPPORT_EMAIL}`}><Mail />{SUPPORT_EMAIL}</a></Button>
            </div>
            <Link to="/ai-advisor" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary underline decoration-brand/50 underline-offset-4 hover:decoration-brand">
              <Sparkles className="size-4 text-brand-strong" />{t("contactHero.aiLink")}
            </Link>
          </div>
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:gap-12">
          <div id="contact-form" className={`${dir === "rtl" ? "text-right" : "text-left"} scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-surface sm:p-7 md:p-9`}>
            <div className={`mb-8 max-w-2xl text-center ${dir === "rtl" ? "md:text-right" : "md:text-left"}`}>
              <h2 className="text-3xl font-bold md:text-4xl">{t("contact.title")}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{t("contact.subtitle")}</p>
            </div>

            <div className="space-y-5" data-testid="contact-form">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup label={`${t("contact.form.fullName")} *`}>
                  <Input value={fullName} maxLength={100} onChange={(event) => setFullName(event.target.value)} placeholder={t("contact.form.namePlaceholder")} dir={dir} className="h-12 rounded-lg" aria-invalid={Boolean(errors.fullName)} />
                  {errors.fullName ? <p className="mt-1 text-xs text-destructive">{errors.fullName}</p> : null}
                </FieldGroup>
                <FieldGroup label={t("contact.form.email")}>
                  <Input value={email} maxLength={255} onChange={(event) => setEmail(event.target.value)} placeholder={t("contact.form.emailPlaceholder")} dir="ltr" type="email" className="h-12 rounded-lg" aria-invalid={Boolean(errors.email)} />
                  {errors.email ? <p className="mt-1 text-xs text-destructive">{errors.email}</p> : null}
                </FieldGroup>
              </div>

              <FieldGroup label={t("contact.form.whatsapp")}>
                <Input value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} placeholder={t("contact.form.whatsappPlaceholder")} dir="ltr" type="tel" className="h-12 rounded-lg" aria-invalid={Boolean(errors.phone || errors.contact)} />
                {errors.phone || errors.contact ? <p className="mt-1 text-xs text-destructive">{errors.phone || errors.contact}</p> : null}
              </FieldGroup>

              <FieldGroup label={`${t("contact.form.topic")} *`}>
                <Select value={topic || undefined} onValueChange={(value) => setTopic(value as typeof topic)}>
                  <SelectTrigger className="h-12 rounded-lg" aria-invalid={Boolean(errors.topic)}><SelectValue placeholder={t("contact.form.topicPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {TOPICS.map((value) => <SelectItem key={value} value={value}>{t(`contact.form.topicOptions.${value}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.topic ? <p className="mt-1 text-xs text-destructive">{errors.topic}</p> : null}
              </FieldGroup>

              <FieldGroup label={`${t("contact.form.message")} *`}>
                <Textarea value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder={t("contact.form.messagePlaceholder")} dir={dir} rows={7} className="min-h-40 resize-y rounded-lg" aria-invalid={Boolean(errors.message)} />
                <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                  {errors.message ? <span className="text-destructive">{errors.message}</span> : <span />}
                  <span>{message.length.toLocaleString("en-US")} / 2,000</span>
                </div>
              </FieldGroup>

              <input type="text" name="website" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} className="absolute -start-[9999px] h-0 w-0 opacity-0" tabIndex={-1} autoComplete="off" aria-hidden="true" />

              <ConsentBlock
                isAr={isAr}
                collected={t("contact.consent.collected")}
                purpose={t("contact.consent.purpose")}
                agreeLabel={t("contact.consent.agree")}
                agreed={consentAgreed}
                onAgreedChange={setConsentAgreed}
                marketing={marketingConsent}
                onMarketingChange={setMarketingConsent}
                error={errors.consent}
              />

              <Button type="button" data-testid="contact-submit" className="h-12 w-full font-bold" size="lg" disabled={isPending} onClick={() => mutate()}>
                {isPending ? t("contact.form.sending") : t("contact.form.submit")}
              </Button>
            </div>
          </div>

          <aside className="space-y-8 lg:sticky lg:top-32">
            <OfficeLocations />
            <div>
              <h3 className="text-2xl font-bold text-primary">{t("contact.mapTitle")}</h3>
              <p className="mt-2 text-muted-foreground">{t("contact.mapSubtitle")}</p>
              <div className="mt-5 h-[320px] overflow-hidden rounded-2xl border border-border shadow-surface md:h-[390px]"><Map /></div>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6">
              <h3 className="mb-4 text-center text-xl font-semibold">{t("contact.follow")}</h3>
              <div className="flex items-center justify-center gap-6">
                <a href="https://www.instagram.com/darb_studyingermany/" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-accent"><Instagram className="h-7 w-7" /></a>
                <a href="https://www.tiktok.com/@darb_studyingrmany" aria-label="TikTok" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-accent"><TikTokIcon className="h-7 w-7" /></a>
                <a href="https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/" aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-accent"><Facebook className="h-7 w-7" /></a>
                <a href={whatsappBusinessUrl("مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا.")} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-accent"><MessageCircle className="h-7 w-7" /></a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Contact;