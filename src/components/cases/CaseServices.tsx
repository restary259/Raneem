import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatILS } from "@/lib/money";
import { useServiceCatalog, type CaseService, type CatalogService } from "@/hooks/useCaseServices";
import { useCaseFinancials } from "@/hooks/useCaseFinancials";

interface Props {
  caseId: string;
  services: CaseService[];
  canManage: boolean;
  onChanged: () => void;
  /**
   * Fires whenever the local selection changes (including unsaved edits) so the
   * parent can reflect the live total/count in its summary before save.
   */
  onSelectionChange?: (count: number, total: number) => void;
  /**
   * Current case status. Once the case has moved past the editable finance stage
   * (submitted/payment_confirmed/enrollment_paid/enrolled), services are frozen
   * server-side; the UI reflects that by rendering read-only and making save()
   * a no-op so the single "Confirm & Save" button never hits the locked RPC.
   */
  caseStatus?: string;
}

/**
 * Imperative handle exposed to the parent (CaseFinance) so the single
 * "Confirm & Save" button can save the service selection and read its state
 * without duplicating the catalog/selection logic.
 */
export interface CaseServicesHandle {
  save: () => Promise<boolean>;
  isDirty: () => boolean;
  selectedCount: () => number;
  liveTotal: () => number;
}

type PackageMode = "full_service" | "custom" | "";

/**
 * Resolves the effective package mode for rendering.
 *
 * Before the user explicitly picks a mode (`packageMode` is empty), derive it
 * from the saved selection so the correct view (full-service list or custom
 * checkboxes) renders immediately on load instead of waiting for the user to
 * re-pick a mode.
 */
export function resolvePackageMode(
  packageMode: PackageMode,
  isFullServiceSelection: boolean,
  selectedCount: number,
): PackageMode {
  if (packageMode) return packageMode;
  if (isFullServiceSelection) return "full_service";
  return selectedCount > 0 ? "custom" : "";
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
const CaseServices = forwardRef<CaseServicesHandle, Props>(
  ({ caseId, services, canManage, onChanged, onSelectionChange, caseStatus }, ref) => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();

  const isArabic = i18n.language?.startsWith("ar");

  const { catalog, isLoading: catalogLoading, error: catalogError } = useServiceCatalog();
  const { financials } = useCaseFinancials(caseId);

  /**
   * Services are server-locked once the case has been submitted (the
   * `set_case_services` RPC rejects writes for submitted/payment_confirmed/
   * enrollment_paid/enrolled cases). Collapse to the read-only view and make
   * save() a no-op so the single "Confirm & Save" button never hits the locked
   * RPC and surfaces a "fields are controlled" error.
   */
  const servicesLocked =
    canManage &&
    ["submitted", "payment_confirmed", "enrollment_paid", "enrolled"].includes(caseStatus ?? "");
  const effectiveCanManage = canManage && !servicesLocked;

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Selection[]>([]);
  const [context, setContext] = useState<CaseContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  /** "full_service" | "custom" — drives the single service-package selector. */
  const [packageMode, setPackageMode] = useState<PackageMode>("");

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

  /**
   * Authoritative saved total shown in Finance.
   */

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
   * Notify the parent of the live (unsaved) selection so the summary and
   * checklist can reflect pending changes before "Confirm & Save" persists.
   */
  useEffect(() => {
    if (!onSelectionChange) return;
    const total = selected.reduce((sum, item) => {
      const service = selectableCatalog.find((s) => s.id === item.service_id);
      return sum + (service ? priceFor(service) * Math.max(1, item.quantity) : 0);
    }, 0);
    onSelectionChange(selected.length, total);
  }, [selected, selectableCatalog, onSelectionChange]);

  /**
   * The Full Service bundle = every catalog item flagged in_full_service.
   * Used by the single service-package selector to lock the list.
   */
  const fullServiceIds = useMemo(
    () => new Set(fullServiceItems.map((service) => service.id)),
    [fullServiceItems],
  );

  /**
   * The selection matches the Full Service bundle exactly when every bundle
   * item is selected and nothing outside the bundle is.
   */
  const isFullServiceSelection = useMemo(() => {
    if (selected.length === 0 || fullServiceIds.size === 0) return false;
    const allBundle = fullServiceItems.every((service) =>
      selected.some((item) => item.service_id === service.id),
    );
    const onlyBundle = selected.every((item) => fullServiceIds.has(item.service_id));
    return allBundle && onlyBundle;
  }, [selected, fullServiceItems, fullServiceIds]);

  /**
   * The effective package mode. Before the user explicitly picks a mode, derive
   * it from the saved selection so the matching view (full-service list or
   * custom checkboxes) renders immediately on load instead of waiting for the
   * user to re-pick a mode.
   */
  const effectivePackageMode: PackageMode = resolvePackageMode(
    packageMode,
    isFullServiceSelection,
    selected.length,
  );

  const applyPackageMode = (mode: PackageMode) => {
    setPackageMode(mode);
    if (mode === "full_service") {
      toggleFullService(true);
    }
    // "custom" keeps the current selection; the per-service checkboxes
    // become editable so the Team can adjust individual services.
  };

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

  const save = async (): Promise<boolean> => {
    if (busy) return false;
    // Services are frozen server-side once the case has been submitted; never
    // call the locked set_case_services RPC from here.
    if (servicesLocked) return true;
    if (!dirty) return true;

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
      return true;
    } catch (error: any) {
      console.error("Failed to save case services:", error);

      toast({
        variant: "destructive",
        description: t("common.actionFailed"),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Let the parent's single "Confirm & Save" button drive saving and read
   * the selection state without lifting the whole catalog/selection model.
   */
  const computeLiveTotal = () =>
    selected.reduce((sum, item) => {
      const service = selectableCatalog.find((s) => s.id === item.service_id);
      return sum + (service ? priceFor(service) * Math.max(1, item.quantity) : 0);
    }, 0);

  useImperativeHandle(ref, () => ({
    save,
    isDirty: () => dirty,
    selectedCount: () => selected.length,
    liveTotal: computeLiveTotal,
  }));

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
  if (!effectiveCanManage) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{t("finance.services.title")}</p>

          <span className="text-sm font-semibold">{formatILS(Number(financials?.service_total ?? 0))}</span>
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

                <span className="shrink-0 text-sm font-medium">{formatILS(Number(service.unit_price || 0))}</span>
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
   *
   * One service-selection mechanism: a single dropdown choosing between
   * "Full Service" (locked, auto-populated bundle) and "Custom Services"
   * (editable per-service checkboxes). There is no separate Save button
   * here — the parent's "Confirm & Save" persists the selection.
   */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{t("finance.services.title")}</p>
        <span className="text-sm font-semibold">{formatILS(Number(financials?.service_total ?? 0))}</span>
      </div>

      {catalogError && (
        <Alert variant="destructive">
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
        <div className="space-y-4">
          {/* Service package selector — the single entry point. */}
          {fullServiceItems.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {t("finance.services.packageLabel", "Service package")}
              </label>
              <Select
                value={effectivePackageMode}
                onValueChange={(value) => applyPackageMode(value as PackageMode)}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("finance.services.packagePlaceholder", "Choose a service package")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_service">
                    {t("finance.services.fullService", "Full Service")}
                  </SelectItem>
                  <SelectItem value="custom">
                    {t("finance.services.customServices", "Custom Services")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Full Service: locked, auto-populated list. */}
          {fullServiceItems.length > 0 && effectivePackageMode === "full_service" && (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("finance.services.fullService", "Full Service")}
                </span>
                <span className="shrink-0 text-xs font-medium">
                  {formatILS(fullServiceItems.reduce((sum, service) => sum + priceFor(service), 0))}
                </span>
              </div>
              <ul className="space-y-0.5">
                {fullServiceItems.map((service) => (
                  <li key={service.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CheckCircle2 className={`h-3 w-3 ${toneClasses("enrolled").text}`} />
                      <span className="truncate">{label(service)}</span>
                    </span>
                    <span className="shrink-0">{formatILS(priceFor(service))}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "finance.services.fullServiceLocked",
                  "Full Service includes every bundled service. Switch to Custom Services to adjust individual items.",
                )}
              </p>
            </div>
          )}

          {/* Custom Services: editable per-service checkboxes. */}
          {effectivePackageMode === "custom" && grouped.map(([category, items]) => (
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
                            {t(`finance.services.models.${service.pricing_model}`, { defaultValue: service.pricing_model })}
                          </span>
                        )}
                        {saved && (
                          <span className="block text-[10px] text-muted-foreground">
                            {t("finance.services.savedPrice", { defaultValue: "Saved price" })}
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
                      <span className="text-sm">{formatILS(priceFor(service))}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Selection summary + authoritative total. */}
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <div>
              <p className="text-sm font-semibold">{t("finance.services.total", "Services total")}</p>
              <p className="text-xs text-muted-foreground">
                {t("finance.services.selectedCount", { count: selected.length, defaultValue: `Selected services: ${selected.length}` })}
              </p>
            </div>
            <span className="text-sm font-semibold">
              {formatILS(selected.reduce((sum, item) => {
                const service = selectableCatalog.find((s) => s.id === item.service_id);
                return sum + (service ? priceFor(service) * Math.max(1, item.quantity) : 0);
              }, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default CaseServices;
