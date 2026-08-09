import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save } from "lucide-react";
import { formatILS } from "@/lib/money";
import {
  useServiceCatalog,
  caseServiceTotal,
  type CaseService,
} from "@/hooks/useCaseServices";

interface Props {
  caseId: string;
  services: CaseService[];
  canManage: boolean;
  onChanged: () => void;
}

/**
 * Team members pick services from the admin-managed catalog — they can never
 * invent a service or type a price. The backend RPC `set_case_services` copies
 * the catalog price at selection time, so later price edits never rewrite
 * lines already on a case.
 */
const CaseServices: React.FC<Props> = ({ caseId, services, canManage, onChanged }) => {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { catalog } = useServiceCatalog();

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const active = useMemo(() => catalog.filter((c) => c.is_active), [catalog]);
  const label = (c: { name_ar: string; name_en: string }) => (isRtl ? c.name_ar : c.name_en);

  const existingIds = useMemo(
    () => services.map((s) => s.service_id).filter((id): id is string => !!id),
    [services],
  );

  useEffect(() => {
    setSelected(existingIds);
  }, [existingIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullServiceIds = useMemo(
    () => active.filter((c) => c.in_full_service).map((c) => c.id),
    [active],
  );
  const fullServiceOn =
    fullServiceIds.length > 0 && fullServiceIds.every((id) => selected.includes(id));

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));

  const toggleFullService = (on: boolean) =>
    setSelected((prev) =>
      on
        ? [...new Set([...prev, ...fullServiceIds])]
        : prev.filter((x) => !fullServiceIds.includes(x)),
    );

  /** Price shown next to an unsaved option = catalog price; saved lines keep their frozen price. */
  const priceFor = (id: string) => {
    const saved = services.find((s) => s.service_id === id);
    if (saved) return caseServiceTotal(saved);
    return Number(active.find((c) => c.id === id)?.default_price ?? 0);
  };

  const selectionTotal = selected.reduce((sum, id) => sum + priceFor(id), 0);
  const savedTotal = services.reduce((sum, s) => sum + caseServiceTotal(s), 0);
  const dirty =
    selected.length !== existingIds.length || selected.some((id) => !existingIds.includes(id));

  const save = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("set_case_services", {
        p_case_id: caseId,
        p_service_ids: selected,
      });
      if (error) throw error;
      toast({ description: t("finance.services.saved") });
      onChanged();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const manualLines = services.filter((s) => !s.service_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("finance.services.title")}</h3>
        <Badge variant="secondary" className="whitespace-nowrap">
          {formatILS(savedTotal)}
        </Badge>
      </div>

      {!canManage ? (
        services.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t("finance.services.empty")}</p>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2.5"
              >
                <p className="text-sm font-medium truncate">{s.description}</p>
                <span className="text-sm shrink-0">{formatILS(caseServiceTotal(s))}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("finance.services.pickHint")}</p>

          {fullServiceIds.length > 0 && (
            <label className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 p-2.5 cursor-pointer">
              <span className="flex items-center gap-2 min-w-0">
                <Checkbox
                  checked={fullServiceOn}
                  onCheckedChange={(v) => toggleFullService(v === true)}
                  disabled={busy}
                />
                <span className="text-sm font-semibold truncate">
                  {t("finance.services.fullService")}
                </span>
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatILS(fullServiceIds.reduce((s, id) => s + priceFor(id), 0))}
              </span>
            </label>
          )}

          {active.map((c) => {
            const checked = selected.includes(c.id);
            const frozen = services.find((s) => s.service_id === c.id);
            return (
              <label
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2.5 cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(c.id, v === true)}
                    disabled={busy}
                  />
                  <span className="text-sm truncate">{label(c)}</span>
                </span>
                <span className="text-sm shrink-0">
                  {formatILS(frozen ? caseServiceTotal(frozen) : Number(c.default_price || 0))}
                </span>
              </label>
            );
          })}

          {manualLines.length > 0 && (
            <>
              <Separator />
              {manualLines.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-dashed p-2.5"
                >
                  <p className="text-sm truncate">{s.description}</p>
                  <span className="text-sm shrink-0">{formatILS(caseServiceTotal(s))}</span>
                </div>
              ))}
            </>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-sm font-semibold">
              {t("finance.services.total")} {formatILS(selectionTotal)}
            </span>
            <Button size="sm" onClick={save} disabled={busy || !dirty} className="gap-1">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseServices;
