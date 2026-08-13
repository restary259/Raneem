import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
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
  ChevronRight,
  ChevronLeft,
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

/**
 * Compact overview section for the student dashboard home.
 *
 * Laid out as a two-column grid (on lg) so the quick actions, tools,
 * WhatsApp direct line, and important-contacts preview sit side-by-side
 * instead of stacking vertically — minimising scroll. Styling matches the
 * rest of the student dashboard exactly: neutral shadcn Cards, text-primary
 * icons, no gradients/glows/animations.
 *
 * Data logic is unchanged: contacts come from
 * get_student_important_contacts(), tool routes reuse shared components, and
 * contact links come from contactConfig.ts (no hardcoded numbers).
 */
export default function StudentOverviewSection() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

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
    { icon: FileText, label: t("nav.documents", "Documents"), href: "/student/documents" },
    { icon: CreditCard, label: t("nav.fees", "Fees"), href: "/student/fees" },
    { icon: Globe, label: t("nav.visa", "Visa"), href: "/student/visa" },
    { icon: Users, label: t("nav.contacts", "Contacts"), href: "/student/contacts" },
    { icon: Heart, label: t("nav.refer", "Refer a friend"), href: "/student/refer" },
  ];

  const tools = [
    { icon: Calculator, label: t("nav.bagrut", "Bagrut Tool"), href: "/student/tools/bagrut" },
    { icon: FileText, label: t("nav.cvBuilder", "CV builder"), href: "/student/tools/cv" },
  ];

  const topContacts = contacts.slice(0, 3);
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Left column: quick actions + tools ─────────────────────────── */}
      <div className="space-y-4">
        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("student.overview.quickActions", "Quick actions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-2">
              {quickActions.map((a) => (
                <button
                  key={a.href}
                  onClick={() => navigate(a.href)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-2.5 text-center transition-colors hover:bg-accent"
                >
                  <a.icon className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-medium text-foreground leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tools */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("student.overview.tools", "Tools")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tools.map((tool) => (
              <button
                key={tool.href}
                onClick={() => navigate(tool.href)}
                className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-accent border-b border-border last:border-0"
              >
                <tool.icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1">{tool.label}</span>
                <Chevron className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Right column: WhatsApp + contacts ──────────────────────────── */}
      <div className="space-y-4">
        {/* WhatsApp direct line */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              {t("student.overview.whatsapp", "WhatsApp Support")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("student.overview.whatsappDesc", "Chat with us directly on WhatsApp")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="gap-2" size="sm">
                <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  {t("student.overview.whatsappCta", "Chat on WhatsApp")}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`}>
                  <Phone className="h-4 w-4" />
                  {t("student.overview.callUs", "Call us")}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={`mailto:${SUPPORT_EMAIL}`}>
                  <Mail className="h-4 w-4" />
                  {t("student.overview.emailUs", "Email us")}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Important contacts preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {t("student.overview.importantContacts", "Important contacts")}
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => navigate("/student/contacts")}>
              {t("student.overview.viewAll", "View all")}
              <Chevron className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {contactsLoading ? (
              <div className="py-6 flex items-center justify-center">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : topContacts.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">{t("contacts.noContacts", "No contacts available yet.")}</p>
              </div>
            ) : (
              <div className="divide-y">
                {topContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center gap-3 px-4 py-2.5">
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone.replace(/\s/g, "")}`}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border text-primary hover:bg-accent"
                          aria-label={t("student.overview.callUs", "Call us")}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border text-primary hover:bg-accent"
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
    </div>
  );
}
