import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { formatILS } from "@/lib/money";
import {
  useServiceCatalog,
  caseServiceTotal,
  type CaseService,
  type CatalogService,
} from "@/hooks/useCaseServices";

interface Props {
  caseId: string;
  services: CaseService[];
  canManage: boolean;
  onChanged: () => void;
}

interface Selection {
  service_id: string;
  quantity: number;
}

/**
 * Team members pick services from the admin-managed catalog — they can never
 * invent a service or type a price. The backend RPC `set_case_services`
 * re-reads the catalog price server-side at selection time, so later admin
 * price edits never rewrite lines already frozen on a case.
 */
const CaseServices: React.FC<Props> = ({ caseId, services, canManage, onChanged }) => {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { catalog, isLoading, error } = useServiceCatalog();

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [context, setContext] = useState<{
    school_id: string | null;
    program_id: string | null;
    accommodation_id: string | null;
  } | null>(null);

  // The case's school / course / accommodation decide which services apply.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("case_submissions")
        .select("school_id, program_id, accommodation_id")
        .eq("case_id", caseId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (alive) {
        setContext({
          school_id: data?.school_id ?? null,
          program_id: data?.program_id ?? null,
          accommodation_id: data?.accommodation_id ?? null,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [caseId]);

  const label = (c: { name_ar: string; name_en: string }) => (isRtl ? c.name_ar : c.name_en);

  const applicable = useMemo(() => {
    if (!context) return [] as CatalogService[];
    return catalog.filter(
      (c) =>
        c.is_active &&
        (!c.school_id || c.school_id === context.school_id) &&
        (!c.program_id || c.program_id === context.program_id) &&
        (!c.accommodation_id || c.accommodation_id === context.accommodation_id),
    );
  }, [catalog, context]);

  const existing = useMemo<Selection[]>(
    () =>
      services
        .filter((s) => s.service_id)
        .map((s) => ({ service_id: s.service_id as string, quantity: Number(s.quantity || 1) })),
    [services],
  );
  const existingKey = existing.map((e) => `${e.service_id}:${e.quantity}`).sort().join("|");

  useEffect(() => {
    setSelected(existing);
  }, [existingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A selection that is no longer applicable (school/course changed) is dropped
  // so an invalid combination can never be saved.
  useEffect(() => {
    if (!context || applicable.length === 0) return;
    setSelected((prev) => prev.filter((s) => applicable.some((c) => c.id === s.service_id)));
  }, [applicable, context]);

  const isSelected = (id: string) => selected.some((s) => s.service_id === id);
  const qtyOf = (id: string) => selected.find((s) => s.service_id === id)?.quantity ?? 1;

  const toggle = (c: CatalogService, on: boolean) =>
    setSelected((prev) =>
      on
        ? prev.some((s) => s.service_id === c.id)
          ? prev
          : [...prev, { service_id: c.id, quantity: Number(c.default_quantity || 1) }]
        : prev.filter((s) => s.service_id !== c.id),
    );

  const setQty = (id: string, qty: number) =>
    setSelected((prev) =>
      prev.map((s) => (s.service_id === id ? { ...s, quantity: Math.max(1, qty || 1) } : s)),
    );

  const fullServiceItems = useMemo(
    () => applicable.filter((c) => c.in_full_service),
    [applicable],
  );
  const fullServiceOn =
    fullServiceItems.length > 0 && fullServiceItems.every((c) => isSelected(c.id));

  const toggleFullService = (on: boolean) =>
    setSelected((prev) =>
      on
        ? [
            ...prev.filter((s) => !fullServiceItems.some((c) => c.id === s.service_id)),
            ...fullServiceItems.map((c) => ({
              service_id: c.id,
              quantity: Number(c.default_quantity || 1),
            })),
          ]
        : prev.filter((s) => !fullServiceItems.some((c) => c.id === s.service_id)),
    );

  /** Saved lines keep their frozen price; unsaved options preview the catalog price. */
  const priceFor = (c: CatalogService) => {
    const saved = services.find((s) => s.service_id === c.id);
    if (saved) return Number(saved.unit_price || 0);
    return Number(c.default_price ?? 0);
  };

  const lineTotal = (c: CatalogService) => priceFor(c) * qtyOf(c.id);

  const selectionTotal = selected.reduce((sum, s) => {
    const c = applicable.find((x) => x.id === s.service_id);
    return c ? sum + priceFor(c) * s.quantity : sum;
  }, 0);
  const savedTotal = services.reduce((sum, s) => sum + caseServiceTotal(s), 0);

  const selectedKey = selected.map((s) => `${s.service_id}:${s.quantity}`).sort().join("|");
  const dirty = selectedKey !== existingKey;

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogService[]>();
    applicable.forEach((c) => {
      const key = c.category || "other";
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return Array.from(map.entries());
  }, [applicable]);

  const save = async () => {
    setBusy(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc("set_case_services", {
        p_case_id: caseId,
        p_items: selected,
      });
      if (rpcError) throw rpcError;
      toast({ description: t("finance.services.saved") });
      onChanged();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const categoryLabel = (key: string) =>
    t(`finance.services.categories.${key}`, { defaultValue: key });

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
                <p className="text-sm font-medium truncate">
                  {s.description}
                  {Number(s.quantity) > 1 ? ` × ${Number(s.quantity)}` : ""}
                </p>
                <span className="text-sm shrink-0">{formatILS(caseServiceTotal(s))}</span>
              </div>
            ))}
          </div>
        )
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t("finance.services.loadError")}</AlertDescription>
        </Alert>
      ) : isLoading || !context ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      ) : applicable.length === 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t("finance.services.noneApplicable")}</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("finance.services.pickHint")}</p>

          {fullServiceItems.length > 0 && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-2.5 space-y-1.5">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
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
                <span className="text-xs font-medium shrink-0">
                  {formatILS(fullServiceItems.reduce((s, c) => s + priceFor(c), 0))}
                </span>
              </label>
              <ul className="ps-6 space-y-0.5">
                {fullServiceItems.map((c) => (
                  <li key={c.id} className="text-xs text-muted-foreground">
                    ✓ {label(c)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {categoryLabel(category)}
              </p>
              {items.map((c) => {
                const checked = isSelected(c.id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                  >
                    <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggle(c, v === true)}
                        disabled={busy}
                      />
                      <span className="min-w-0">
                        <span className="text-sm block truncate">{label(c)}</span>
                        {c.pricing_model !== "fixed" && (
                          <span className="text-[11px] text-muted-foreground">
                            {t(`finance.services.models.${c.pricing_model}`, {
                              defaultValue: c.pricing_model,
                            })}
                          </span>
                        )}
                      </span>
                    </label>
                    <span className="flex items-center gap-2 shrink-0">
                      {checked && c.allows_quantity && (
                        <Input
                          type="number"
                          min={1}
                          value={qtyOf(c.id)}
                          onChange={(e) => setQty(c.id, Number(e.target.value))}
                          className="h-8 w-16 text-sm"
                          disabled={busy}
                        />
                      )}
                      <span className="text-sm">
                        {formatILS(checked ? lineTotal(c) : priceFor(c))}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-sm font-semibold">
              {t("finance.services.total")} {formatILS(selectionTotal)}
            </span>
            <Button size="sm" onClick={save} disabled={busy || !dirty} className="gap-1">
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseServices;
