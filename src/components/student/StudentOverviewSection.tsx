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
  Wrench,
  ChevronLeft,
  ChevronRight,
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
 * Overview section rendered at the top of the student dashboard home.
 * Mirrors the admin/team "overview" pattern: quick-action tiles, an official
 * WhatsApp CTA, a compact important-contacts preview (same RPC as the
 * Contacts page), and tool shortcuts (Bagrut / CV builder). No data logic is
 * duplicated — contacts come from get_student_important_contacts(), tool
 * routes reuse the shared components, and contact links come from
 * contactConfig.ts.
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
    { icon: FileText, label: t("nav.documents", "Documents"), href: "/student/documents", color: "text-blue-600", bg: "bg-blue-500/10" },
    { icon: CreditCard, label: t("nav.fees", "Fees"), href: "/student/fees", color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { icon: Globe, label: t("nav.visa", "Visa"), href: "/student/visa", color: "text-teal-600", bg: "bg-teal-500/10" },
    { icon: Users, label: t("nav.contacts", "Contacts"), href: "/student/contacts", color: "text-primary", bg: "bg-primary/10" },
    { icon: Heart, label: t("nav.refer", "Refer a friend"), href: "/student/refer", color: "text-pink-600", bg: "bg-pink-500/10" },
  ];

  const tools = [
    { icon: Calculator, label: t("nav.bagrut", "Bagrut Tool"), desc: t("student.overview.bagrutDesc", "Convert Bagrut scores to German grades"), href: "/student/tools/bagrut" },
    { icon: FileText, label: t("nav.cvBuilder", "CV builder"), desc: t("student.overview.cvBuilderDesc", "Draft a German CV (Lebenslauf)"), href: "/student/tools/cv" },
  ];

  const topContacts = contacts.slice(0, 3);
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t("student.overview.quickActions", "Quick actions")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map((a) => (
            <Card
              key={a.href}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(a.href)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`inline-flex p-2 rounded-lg ${a.bg}`}>
                  <a.icon className={`h-5 w-5 ${a.color}`} />
                </div>
                <p className="text-xs font-medium text-foreground leading-tight">{a.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* WhatsApp + direct contact */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="inline-flex p-3 rounded-full bg-[#25D366]/15 shrink-0">
            <MessageCircle className="h-6 w-6 text-[#25D366]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{t("student.overview.whatsapp", "WhatsApp Support")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{t("student.overview.whatsappDesc", "Chat with us directly on WhatsApp")}</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button asChild className="gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white">
              <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                {t("student.overview.whatsapp", "WhatsApp Support")}
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
        </CardContent>
      </Card>

      {/* Tools */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          {t("student.overview.tools", "Tools")}
        </h2>
        <p className="text-xs text-muted-foreground mb-3">{t("student.overview.toolsDesc", "Helpful tools for your study journey")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tools.map((tool) => (
            <Card
              key={tool.href}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(tool.href)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="inline-flex p-2 rounded-lg bg-primary/10 shrink-0">
                  <tool.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tool.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{tool.desc}</p>
                </div>
                <Chevron className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Important contacts preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {t("student.overview.importantContacts", "Important contacts")}
          </CardTitle>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/student/contacts")}>
            {t("student.overview.viewAll", "View all")}
            <Chevron className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {contactsLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border text-primary hover:bg-accent"
                        aria-label={t("student.overview.callUs", "Call us")}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border text-primary hover:bg-accent"
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
