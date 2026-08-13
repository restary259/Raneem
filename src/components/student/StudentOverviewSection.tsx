import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { cn } from "@/lib/utils";
import {
  FileText,
  CreditCard,
  Globe,
  Users,
  Heart,
  Phone,
  Mail,
  MessageCircle,
  Calculator,
  Wrench,
  Plane,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  WHATSAPP_SUPPORT_URL,
  SUPPORT_PHONE,
  SUPPORT_EMAIL,
} from "@/lib/contactConfig";

interface StudentContact {
  id: string;
  name_en: string;
  name_ar: string;
  role_en: string | null;
  role_ar: string | null;
  phone: string | null;
  email: string | null;
  link: string | null;
  category: string;
  match_scope: string;
}

/** True when the user has asked the OS to reduce motion. */
const prefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return !!mq?.matches;
};

/**
 * Overview "home" section rendered at the top of the student dashboard.
 *
 * Aesthetic direction: a refined editorial "journey" hero — the student is
 * embarking on a study-abroad journey to Germany. A warm hero frames that
 * journey (origin stamp → dashed route → plane → destination stamp),
 * followed by tactile quick-action tiles, a signature WhatsApp "direct line"
 * card, polished tool shortcuts, and a compact important-contacts preview.
 *
 * All data logic is unchanged: contacts come from
 * get_student_important_contacts(), tool routes reuse shared components, and
 * contact links come from contactConfig.ts (no hardcoded numbers). Styling
 * uses semantic tokens so light + dark both render correctly, and logical
 * properties / rtl: utilities for RTL (Arabic).
 */
export default function StudentOverviewSection() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const reduced = prefersReducedMotion();

  const [contacts, setContacts] = useState<StudentContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    const { data, error } = await (supabase as any).rpc("get_student_important_contacts");
    if (!error) setContacts((data as StudentContact[]) ?? []);
    else setContacts([]);
    setContactsLoading(false);
  }, []);

  const userId = useAuthedUserId(() => loadContacts());

  useEffect(() => {
    if (userId) loadContacts();
  }, [userId, loadContacts]);

  const quickActions = [
    { icon: FileText, label: t("nav.documents", "Documents"), href: "/student/documents", tint: "text-blue-600", chip: "bg-blue-500/10" },
    { icon: CreditCard, label: t("nav.fees", "Fees"), href: "/student/fees", tint: "text-emerald-600", chip: "bg-emerald-500/10" },
    { icon: Globe, label: t("nav.visa", "Visa"), href: "/student/visa", tint: "text-teal-600", chip: "bg-teal-500/10" },
    { icon: Users, label: t("nav.contacts", "Contacts"), href: "/student/contacts", tint: "text-brand", chip: "bg-brand/10" },
    { icon: Heart, label: t("nav.refer", "Refer a friend"), href: "/student/refer", tint: "text-pink-600", chip: "bg-pink-500/10" },
  ];

  const tools = [
    { icon: Calculator, label: t("nav.bagrut", "Bagrut Tool"), desc: t("student.overview.bagrutDesc", "Convert Bagrut scores to German grades"), href: "/student/tools/bagrut" },
    { icon: FileText, label: t("nav.cvBuilder", "CV builder"), desc: t("student.overview.cvBuilderDesc", "Draft a German CV (Lebenslauf)"), href: "/student/tools/cv" },
  ];

  const topContacts = contacts.slice(0, 3);
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-7">
      {/* ── Hero: welcome + journey route ─────────────────────────────── */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/[0.07] via-background to-background p-5 sm:p-7",
          !reduced && "animate-[fade-in_0.5s_ease-out]",
        )}
      >
        {/* decorative topographic dots */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:radial-gradient(circle_at_center,hsl(var(--brand)/0.18)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_end,black,transparent_75%)] rtl:[mask-image:linear-gradient(to_start,black,transparent_75%)]"
        />
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                {t("student.overview.welcome", "Welcome")}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
              DARB
            </span>
          </div>

          {/* journey route: origin → dashed track → plane → destination */}
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xs font-medium text-foreground">
              {t("student.overview.journeyStart", "Home")}
            </span>
            <div className="relative flex-1 h-px bg-border">
              <div
                aria-hidden
                className="absolute inset-0 [background-image:repeating-linear-gradient(90deg,hsl(var(--muted-foreground)/0.5)_0,hsl(var(--muted-foreground)/0.5)_3px,transparent_3px,transparent_7px)] rtl:[background-image:repeating-linear-gradient(270deg,hsl(var(--muted-foreground)/0.5)_0,hsl(var(--muted-foreground)/0.5)_3px,transparent_3px,transparent_7px)]"
              />
              <span className="absolute top-1/2 -translate-y-1/2 ltr:left-1/2 rtl:right-1/2">
                <Plane className="h-4 w-4 text-brand rtl:-scale-x-100" />
              </span>
            </div>
            <span className="shrink-0 text-xs font-semibold text-foreground">
              {t("student.overview.destinationDE", "Germany")}
            </span>
          </div>
        </div>
      </section>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t("student.overview.quickActions", "Quick actions")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map((a, i) => (
            <Card
              key={a.href}
              className={cn(
                "group cursor-pointer border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md",
                !reduced && "animate-[fade-in-up_0.5s_ease-out_forwards]",
              )}
              style={!reduced ? { animationDelay: `${i * 60}ms` } : undefined}
              onClick={() => navigate(a.href)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={cn("inline-flex p-2.5 rounded-xl transition-transform group-hover:scale-105", a.chip)}>
                  <a.icon className={cn("h-5 w-5", a.tint)} />
                </div>
                <p className="text-xs font-medium text-foreground leading-tight">{a.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── WhatsApp direct line ──────────────────────────────────────── */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-[#25D366]/30 bg-[#25D366]/[0.06] p-5 sm:p-6",
          !reduced && "animate-[fade-in-up_0.5s_ease-out_forwards]",
        )}
        style={!reduced ? { animationDelay: "120ms" } : undefined}
      >
        {/* subtle chat-bubble texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full bg-[#25D366]/10 blur-2xl"
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/15 shrink-0">
            <MessageCircle className="h-6 w-6 text-[#25D366]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              {t("student.overview.directLine", "Your direct line to the team")}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("student.overview.directLineDesc", "Questions about your case? Reach us instantly.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button asChild className="gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0">
              <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                {t("student.overview.whatsappCta", "Chat on WhatsApp")}
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label={t("student.overview.callUs", "Call us")}>
              <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label={t("student.overview.emailUs", "Email us")}>
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Tools ─────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Wrench className="h-4 w-4 text-brand" />
            {t("student.overview.tools", "Tools")}
          </h2>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {t("student.overview.toolsDesc", "Helpful tools for your study journey")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tools.map((tool, i) => (
            <Card
              key={tool.href}
              className={cn(
                "group cursor-pointer border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md",
                !reduced && "animate-[fade-in-up_0.5s_ease-out_forwards]",
              )}
              style={!reduced ? { animationDelay: `${180 + i * 60}ms` } : undefined}
              onClick={() => navigate(tool.href)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="inline-flex p-2.5 rounded-xl bg-brand/10 shrink-0 transition-transform group-hover:scale-105">
                  <tool.icon className="h-5 w-5 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tool.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{tool.desc}</p>
                </div>
                <Arrow className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Important contacts preview ────────────────────────────────── */}
      <Card className={cn(!reduced && "animate-[fade-in-up_0.5s_ease-out_forwards]")} style={!reduced ? { animationDelay: "300ms" } : undefined}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-brand" />
            {t("student.overview.importantContacts", "Important contacts")}
          </CardTitle>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/student/contacts")}>
            {t("student.overview.viewAll", "View all")}
            <Arrow className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {contactsLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : topContacts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("contacts.noContacts", "No contacts available yet.")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {topContacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {isAr ? contact.name_ar : contact.name_en}
                    </p>
                    {(isAr ? contact.role_ar : contact.role_en) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {isAr ? contact.role_ar : contact.role_en}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone.replace(/\s/g, "")}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border text-brand hover:bg-brand/10 hover:border-brand/40 transition-colors"
                        aria-label={t("student.overview.callUs", "Call us")}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border text-brand hover:bg-brand/10 hover:border-brand/40 transition-colors"
                        aria-label={t("student.overview.emailUs", "Email us")}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
