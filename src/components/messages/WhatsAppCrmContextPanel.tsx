import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Link2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@/lib/router-compat";
import {
  getWhatsAppCrmContext,
  type WhatsAppCrmContext,
  type WhatsAppLead,
} from "@/services/WhatsAppService";

export default function WhatsAppCrmContextPanel({ lead, compact = false }: { lead: WhatsAppLead; compact?: boolean }) {
  const { t } = useTranslation("whatsapp");
  const { role } = useAuth();
  const navigate = useNavigate();
  const [context, setContext] = useState<WhatsAppCrmContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!lead.linked_case_id && !lead.linked_lead_id && !lead.linked_profile_id) {
      setContext(null);
      setLoadError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);
    void getWhatsAppCrmContext(lead.id)
      .then((next) => {
        if (!cancelled) setContext(next);
      })
      .catch(() => {
        if (!cancelled) {
          setContext(null);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lead]);

  const openCase = () => {
    if (!context?.caseRecord?.id) return;
    navigate((role === "admin" ? "/admin" : "/team") + "/cases/" + context.caseRecord.id);
  };

  const openStudent = () => {
    if (!context?.profile?.id) return;
    navigate(role === "admin" ? "/admin/students?student=" + context.profile.id : "/team/students/" + context.profile.id);
  };

  const linked = Boolean(lead.linked_case_id || lead.linked_lead_id || lead.linked_profile_id);
  const staffConfirmed = Boolean(lead.identity_confirmed_by);

  if (compact) {
    if (!linked) {
      return <div className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{t("crm.pending")}</div>;
    }
    return (
      <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2 text-xs">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{t("crm.title")}</span>
        <Badge variant="outline">{lead.linked_case_id ? t("crm.case") : lead.linked_profile_id ? t("crm.studentAccount") : t("crm.lead")}</Badge>
        <Badge variant="secondary">{staffConfirmed ? t("crm.staffConfirmed") : t("crm.autoLinked")}</Badge>
        {loading && <Loader2 className="ms-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="border-b p-4"
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{t("crm.title")}</h4>
        </div>
        {linked && (
          <Badge variant="outline" className="shrink-0">
            {staffConfirmed ? t("crm.staffConfirmed") : t("crm.autoLinked")}
          </Badge>
        )}
      </div>

      {!linked ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("crm.pending")}</p>
      ) : loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("crm.loading")}
        </div>
      ) : loadError ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("crm.loadError")}</p>
      ) : !context?.caseRecord && !context?.leadRecord && !context?.profile ? (
        <p className="mt-2 text-xs text-muted-foreground">{t("crm.noCoreRecord")}</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          {context.caseRecord && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{t("crm.case")}</p>
                  <p className="mt-1 truncate font-semibold">
                    {context.caseRecord.case_reference || context.caseRecord.full_name || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("crm.status")}: {context.caseRecord.status || "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={openCase}>
                  <ArrowUpRight className="me-1.5 h-3.5 w-3.5" />
                  {t("crm.open")}
                </Button>
              </div>
            </div>
          )}

          {context.profile && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">{t("crm.studentAccount")}</p>
              <p className="mt-1 font-semibold">{context.profile.full_name || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("crm.status")}: {context.profile.student_status || "—"}
              </p>
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={openStudent}>
                <ArrowUpRight className="me-1.5 h-3.5 w-3.5" />
                {t("crm.open")}
              </Button>
            </div>
          )}

          {context.leadRecord && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">{t("crm.lead")}</p>
              <p className="mt-1 font-semibold">{context.leadRecord.full_name || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("crm.status")}: {context.leadRecord.status || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("crm.source")}: {context.leadRecord.source_type || "—"}
              </p>
            </div>
          )}

          {(context.caseRecord || context.profile || context.leadRecord) && <Separator />}
        </div>
      )}
    </div>
  );
}
