import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { formatILS } from "@/lib/money";
import { useServiceCatalog, caseServiceTotal, type CaseService, type CatalogService } from "@/hooks/useCaseServices";

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

interface CaseContext {
  school_id: string | null;
  program_id: string | null;
  accommodation_id: string | null;
}

/**
 * Finance service selector.
 *
 * Important rules:
 * 1. Existing case_services are ALWAYS rendered.
 * 2. Catalog filtering only controls services that can be newly selected.
 * 3. A missing case_submissions row must NOT hide existing services.
 * 4. Prices for saved services come from the frozen case_services snapshot.
 * 5. New services use the current admin catalog price.
 */
const CaseServices: React.FC<Props> = ({ caseId, services, canManage, onChanged }) => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();

  const isArabic = i18n.language?.startsWith("ar");

  const { catalog, isLoading: catalogLoading, error: catalogError } = useServiceCatalog();

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [context, setContext] = useState<CaseContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  /**
   * Load case context.
   *
   * This is ONLY needed for determining which catalog options are applicable.
   * It is deliberately not required for displaying existing case services.
   */
  useEffect(() => {
    let alive = true;

    const loadContext = async () => {
      setContextLoading(true);

      try {
        const { data, error } = await (supabase as any)
          .from("case_submissions")
          .select("school_id, program_id, accommodation_id")
          .eq("case_id", caseId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.warn("Unable to load case service context:", error);
          setContext(null);
          return;
        }

        setContext({
          school_id: data?.school_id ?? null,
          program_id: data?.program_id ?? null,
          accommodation_id: data?.accommodation_id ?? null,
        });
      } finally {
        if (alive) {
          setContextLoading(false);
        }
      }
    };

    if (caseId) {
      loadContext();
    } else {
      setContext(null);
      setContextLoading(false);
    }

    return () => {
      alive = false;
    };
  }, [caseId]);

  const label = (service: { name_ar: string; name_en: string }) => {
    return isArabic ? service.name_ar || service.name_en : service.name_en || service.name_ar;
  };

  /**
   * Existing selections.
   *
   * These come directly from case_services and must remain visible even if
   * their catalog entry is no longer active or no longer matches the case.
   */
  const existing = useMemo<Selection[]>(() => {
    return services
      .filter((service) => service.service_id)
      .map((service) => ({
        service_id: service.service_id as string,
        quantity: Math.max(1, Number(service.quantity || 1)),
      }));
  }, [services]);

  const existingKey = useMemo(
    () =>
      existing
        .map((item) => `${item.service_id}:${item.quantity}`)
        .sort()
        .join("|"),
    [existing],
  );

  /**
   * Keep local selection synchronized with saved case services.
   */
  useEffect(() => {
    setSelected(existing);
  }, [existingKey]);

  /**
   * Catalog options.
   *
   * If case context is unavailable, do NOT hide the entire catalog.
   * We fall back to active catalog services so the Team can still manage
   * services instead of getting an empty Finance section.
   */
  const applicable = useMemo(() => {
    const activeCatalog = catalog.filter((service) => service.is_active);

    if (!context) {
      return activeCatalog;
    }

    return activeCatalog.filter(
      (service) =>
        (!service.school_id || service.school_id === context.school_id) &&
        (!service.program_id || service.program_id === context.program_id) &&
        (!service.accommodation_id || service.accommodation_id === context.accommodation_id),
    );
  }, [catalog, context]);

  /**
   * A saved service can exist even if:
   *
   * - it was deactivated in the catalog
   * - its school/program/accommodation changed
   * - its catalog row was removed
   *
   * Such a service must still be displayed.
   */
  const savedServiceIds = useMemo(
    () => new Set(services.filter((service) => service.service_id).map((service) => service.service_id as string)),
    [services],
  );

  /**
   * Catalog items available for editing.
   *
   * Include saved items even if they are no longer applicable so their
   * checkbox remains stable and the Team doesn't accidentally lose them.
   */
  const selectableCatalog = useMemo(() => {
    const map = new Map<string, CatalogService>();

    for (const service of applicable) {
      map.set(service.id, service);
    }

    for (const saved of services) {
      if (!saved.service_id) continue;

      if (!map.has(saved.service_id)) {
        const catalogMatch = catalog.find((catalogService) => catalogService.id === saved.service_id);

        if (catalogMatch) {
          map.set(catalogMatch.id, catalogMatch);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }, [applicable, services, catalog]);

  const isSelected = (id: string) => selected.some((item) => item.service_id === id);

  const qtyOf = (id: string) => selected.find((item) => item.service_id === id)?.quantity ?? 1;

  const toggle = (service: CatalogService, checked: boolean) => {
    setSelected((previous) => {
      if (checked) {
        if (previous.some((item) => item.service_id === service.id)) {
          return previous;
        }

        return [
          ...previous,
          {
            service_id: service.id,
            quantity: Math.max(1, Number(service.default_quantity || 1)),
          },
        ];
      }

      return previous.filter((item) => item.service_id !== service.id);
    });
  };

  const setQty = (id: string, quantity: number) => {
    setSelected((previous) =>
      previous.map((item) =>
        item.service_id === id
          ? {
              ...item,
              quantity: Math.max(1, quantity || 1),
            }
          : item,
      ),
    );
  };

  /**
   * Full Service bundle.
   */
  const fullServiceItems = useMemo(
    () => selectableCatalog.filter((service) => service.in_full_service),
    [selectableCatalog],
  );

  const fullServiceOn = fullServiceItems.length > 0 && fullServiceItems.every((service) => isSelected(service.id));

  const toggleFullService = (checked: boolean) => {
    setSelected((previous) => {
      if (checked) {
        const withoutBundle = previous.filter(
          (item) => !fullServiceItems.some((service) => service.id === item.service_id),
        );

        return [
          ...withoutBundle,
          ...fullServiceItems.map((service) => ({
            service_id: service.id,
            quantity: Math.max(1, Number(service.default_quantity || 1)),
          })),
        ];
      }

      return previous.filter((item) => !fullServiceItems.some((service) => service.id === item.service_id));
    });
  };

  /**
   * Saved services use their frozen price.
   *
   * New services preview the current catalog price.
   */
  const priceFor = (service: CatalogService) => {
    const saved = services.find((item) => item.service_id === service.id);

    if (saved) {
      return Number(saved.unit_price || 0);
    }

    return Number(service.default_price || 0);
  };

  const lineTotal = (service: CatalogService) => {
    return priceFor(service) * qtyOf(service.id);
  };

  /**
   * Authoritative saved total shown in Finance.
   */
  const savedTotal = useMemo(() => services.reduce((sum, service) => sum + caseServiceTotal(service), 0), [services]);

  const selectionTotal = useMemo(
    () =>
      selected.reduce((sum, selection) => {
        const service = selectableCatalog.find((item) => item.id === selection.service_id);

        if (!service) return sum;

        return sum + priceFor(service) * Number(selection.quantity || 1);
      }, 0),
    [selected, selectableCatalog, services],
  );

  const selectedKey = useMemo(
    () =>
      selected
        .map((item) => `${item.service_id}:${item.quantity}`)
        .sort()
        .join("|"),
    [selected],
  );

  const dirty = selectedKey !== existingKey;

  /**
   * Group selectable services by category.
   */
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogService[]>();

    selectableCatalog.forEach((service) => {
      const category = service.category || "other";

      map.set(category, [...(map.get(category) ?? []), service]);
    });

    return Array.from(map.entries());
  }, [selectableCatalog]);

  const save = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const { error } = await (supabase as any).rpc("set_case_services", {
        p_case_id: caseId,
        p_items: selected,
      });

      if (error) {
        throw error;
      }

      toast({
        description: t("finance.services.saved"),
      });

      onChanged();
    } catch (error: any) {
      console.error("Failed to save case services:", error);

      toast({
        variant: "destructive",
        description: error?.message || t("finance.services.loadError"),
      });
    } finally {
      setBusy(false);
    }
  };

  const categoryLabel = (key: string) =>
    t(`finance.services.categories.${key}`, {
      defaultValue: key,
    });

  /**
   * ============================================================
   * READ-ONLY VIEW
   * ============================================================
   *
   * This intentionally does NOT depend on catalog/context.
   * Existing case_services are the source of truth for the case.
   */
  if (!canManage) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{t("finance.services.title")}</p>

          <span className="text-sm font-semibold">{formatILS(savedTotal)}</span>
        </div>

        {services.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t("finance.services.empty")}</p>
        ) : (
          <div className="space-y-2">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {service.description || service.category || t("finance.services.unknown")}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {Number(service.quantity || 1) > 1 ? `× ${Number(service.quantity)}` : ""}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-medium">{formatILS(caseServiceTotal(service))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /**
   * ============================================================
   * MANAGE VIEW
   * ============================================================
   */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{t("finance.services.title")}</p>

        <span className="text-sm font-semibold">{formatILS(savedTotal)}</span>
      </div>

      {/* Existing saved services ALWAYS render first. */}
      {services.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("finance.services.selected", {
              defaultValue: "Selected services",
            })}
          </p>

          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {service.description || service.category || t("finance.services.unknown")}
                </p>

                <p className="text-xs text-muted-foreground">
                  {Number(service.quantity || 1) > 1 ? `× ${Number(service.quantity)}` : ""}

                  {service.currency ? ` · ${service.currency}` : ""}
                </p>
              </div>

              <span className="shrink-0 text-sm font-semibold">{formatILS(caseServiceTotal(service))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4">
        <p className="mb-3 text-xs text-muted-foreground">{t("finance.services.pickHint")}</p>

        {catalogError && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />

            <AlertDescription>{catalogError}</AlertDescription>
          </Alert>
        )}

        {catalogLoading || contextLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />

            {t("common.loading")}
          </div>
        ) : selectableCatalog.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />

            <AlertDescription>{t("finance.services.noneApplicable")}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {fullServiceItems.length > 0 && (
              <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      checked={fullServiceOn}
                      onCheckedChange={(value) => toggleFullService(value === true)}
                      disabled={busy}
                    />

                    <span className="truncate text-sm font-semibold">{t("finance.services.fullService")}</span>
                  </span>

                  <span className="shrink-0 text-xs font-medium">
                    {formatILS(fullServiceItems.reduce((sum, service) => sum + priceFor(service), 0))}
                  </span>
                </label>

                <ul className="space-y-0.5 ps-6">
                  {fullServiceItems.map((service) => (
                    <li key={service.id} className="text-xs text-muted-foreground">
                      ✓ {label(service)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {grouped.map(([category, items]) => (
              <div key={category} className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">{categoryLabel(category)}</p>

                {items.map((service) => {
                  const checked = isSelected(service.id);

                  const saved = savedServiceIds.has(service.id);

                  return (
                    <div key={service.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                      <label className="flex min-w-0 cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggle(service, value === true)}
                          disabled={busy}
                        />

                        <span className="min-w-0">
                          <span className="block truncate text-sm">{label(service)}</span>

                          {service.pricing_model !== "fixed" && (
                            <span className="text-[11px] text-muted-foreground">
                              {t(`finance.services.models.${service.pricing_model}`, {
                                defaultValue: service.pricing_model,
                              })}
                            </span>
                          )}

                          {saved && (
                            <span className="block text-[10px] text-muted-foreground">
                              {t("finance.services.savedPrice", {
                                defaultValue: "Saved price",
                              })}
                            </span>
                          )}
                        </span>
                      </label>

                      <span className="flex shrink-0 items-center gap-2">
                        {checked && service.allows_quantity && (
                          <Input
                            type="number"
                            min={1}
                            value={qtyOf(service.id)}
                            onChange={(event) => setQty(service.id, Number(event.target.value))}
                            className="h-8 w-16 text-sm"
                            disabled={busy}
                          />
                        )}

                        <span className="text-sm">{formatILS(checked ? lineTotal(service) : priceFor(service))}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <div>
                <p className="text-sm font-semibold">{t("finance.services.total")}</p>

                <p className="text-xs text-muted-foreground">{formatILS(selectionTotal)}</p>
              </div>

              <Button size="sm" onClick={save} disabled={busy || !dirty} className="gap-1">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}

                {t("common.save")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseServices;
