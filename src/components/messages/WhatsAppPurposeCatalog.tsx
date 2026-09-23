import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type PurposeRow = {
  purpose: string;
  automated: boolean;
  template_name: string | null;
  approval_status: string | null;
  category: string | null;
  is_active: boolean | null;
};

const STATUS_TONE: Record<string, string> = {
  APPROVED: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  PENDING: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  REJECTED: "border-destructive/40 text-destructive",
};

export function WhatsAppPurposeCatalog({ refreshKey }: { refreshKey?: unknown }) {
  const { t } = useTranslation("whatsapp");
  const [rows, setRows] = useState<PurposeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RPC is admin-gated server-side; not yet in generated types.
      const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: PurposeRow[] | null; error: Error | null }>)("get_whatsapp_purpose_catalog");
      if (error) { console.warn("purpose catalog", error); return; }
      if (!cancelled) setRows(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const missing = rows.filter((r) => r.automated && r.approval_status !== "APPROVED").length;

  return (
    <Card className="rounded-xl shadow-none">
      <div className="border-b p-5">
        <div className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-brand" /><h2 className="font-semibold">{t("templates.catalog.title")}</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">{t("templates.catalog.help")}</p>
        {missing > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />{t("templates.catalog.missingCount", { count: missing })}
          </p>
        )}
      </div>
      <div className="divide-y">
        {rows.map((r) => {
          const blocked = r.automated && r.approval_status !== "APPROVED";
          return (
            <div key={r.purpose} className="grid gap-2 p-4 text-sm sm:grid-cols-4 sm:items-center">
              <strong>{t(`templates.purpose.${r.purpose}`, r.purpose)}</strong>
              <span className="text-muted-foreground">{r.automated ? t("templates.catalog.automated") : t("templates.catalog.manual")}</span>
              <span className="truncate font-mono text-xs" dir="ltr">{r.template_name ?? t("templates.catalog.none")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={STATUS_TONE[r.approval_status ?? ""] ?? ""}>{r.approval_status ?? "—"}</Badge>
                {blocked && <span className="text-xs text-amber-700 dark:text-amber-400">{t("templates.catalog.needsApproval")}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
