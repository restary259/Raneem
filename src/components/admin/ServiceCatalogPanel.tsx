import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Plus } from "lucide-react";
import { formatILS } from "@/lib/money";
import {
  PRICING_MODELS,
  SERVICE_CATEGORIES,
  useServiceCatalog,
  type CatalogService,
} from "@/hooks/useCaseServices";

type Draft = Partial<CatalogService> & { id?: string };

const emptyDraft: Draft = {
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  category: "other",
  default_price: 0,
  currency: "ILS",
  pricing_model: "fixed",
  default_quantity: 1,
  allows_quantity: false,
  commissionable: true,
  is_optional: true,
  in_full_service: false,
  is_active: true,
  school_id: null,
  program_id: null,
  accommodation_id: null,
  sort_order: 0,
};

/**
 * The single place service pricing is configured. Everything downstream —
 * team selection, case finance, invoices, commissions and exports — reads the
 * price from here through the backend, never from a hand-typed field.
 */
export default function ServiceCatalogPanel() {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { catalog, refetch } = useServiceCatalog();

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [schools, setSchools] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [accommodations, setAccommodations] = useState<any[]>([]);
  const [courseWeeks, setCourseWeeks] = useState<number>(40);

  useEffect(() => {
    (async () => {
      const [s, p, a, settings] = await Promise.all([
        (supabase as any).from("schools").select("id, name_ar, name_en").order("name_en"),
        (supabase as any).from("programs").select("id, name_ar, name_en").order("name_en"),
        (supabase as any).from("accommodations").select("id, name_ar, name_en").order("name_en"),
        (supabase as any)
          .from("platform_settings")
          .select("id, default_course_weeks")
          .limit(1)
          .maybeSingle(),
      ]);
      setSchools(s.data ?? []);
      setPrograms(p.data ?? []);
      setAccommodations(a.data ?? []);
      if (settings.data?.default_course_weeks) setCourseWeeks(Number(settings.data.default_course_weeks));
    })();
  }, []);

  const name = (r: any) => (isRtl ? r?.name_ar || r?.name_en : r?.name_en || r?.name_ar) ?? "";

  const fullServiceItems = useMemo(
    () => catalog.filter((c) => c.is_active && c.in_full_service),
    [catalog],
  );
  const fullServiceTotal = fullServiceItems.reduce(
    (sum, c) => sum + Number(c.default_price || 0),
    0,
  );

  const openNew = () => {
    setDraft({ ...emptyDraft, sort_order: catalog.length + 1 });
    setOpen(true);
  };
  const openEdit = (row: CatalogService) => {
    setDraft({ ...row });
    setOpen(true);
  };

  const set = (changes: Draft) => setDraft((prev) => ({ ...prev, ...changes }));

  const saveDraft = async () => {
    if (!draft.name_ar?.trim() || !draft.name_en?.trim()) {
      toast({ variant: "destructive", description: t("admin.settings.catalog.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name_ar: draft.name_ar!.trim(),
        name_en: draft.name_en!.trim(),
        description_ar: draft.description_ar || null,
        description_en: draft.description_en || null,
        category: draft.category || "other",
        default_price: Number(draft.default_price || 0),
        currency: draft.currency || "ILS",
        pricing_model: draft.pricing_model || "fixed",
        default_quantity: Number(draft.default_quantity || 1),
        allows_quantity: !!draft.allows_quantity,
        commissionable: !!draft.commissionable,
        is_optional: !!draft.is_optional,
        in_full_service: !!draft.in_full_service,
        is_active: draft.is_active !== false,
        school_id: draft.school_id || null,
        program_id: draft.program_id || null,
        accommodation_id: draft.accommodation_id || null,
        sort_order: Number(draft.sort_order || 0),
      };
      const q = draft.id
        ? (supabase as any).from("service_catalog").update(payload).eq("id", draft.id)
        : (supabase as any).from("service_catalog").insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast({ description: t("admin.settings.catalog.saved") });
      setOpen(false);
      refetch();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const saveCourseWeeks = async (value: number) => {
    setCourseWeeks(value);
    const { data } = await (supabase as any)
      .from("platform_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!data?.id) return;
    const { error } = await (supabase as any)
      .from("platform_settings")
      .update({ default_course_weeks: value })
      .eq("id", data.id);
    if (error) toast({ variant: "destructive", description: error.message });
  };

  const applicabilitySelect = (
    list: any[],
    value: string | null | undefined,
    onChange: (v: string | null) => void,
  ) => (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("admin.settings.catalog.appliesToAll")}</SelectItem>
        {list.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {name(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">{t("admin.settings.catalog.title")}</CardTitle>
        <Button size="sm" onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" />
          {t("admin.settings.catalog.add")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("admin.settings.catalog.hint")}</p>

        <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.settings.catalog.courseWeeks")}</Label>
            <Input
              type="number"
              min={1}
              className="h-9 w-24"
              value={courseWeeks}
              onChange={(e) => saveCourseWeeks(Number(e.target.value) || 1)}
            />
          </div>
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            {t("admin.settings.catalog.courseWeeksHint")}
          </p>
        </div>

        <div className="space-y-2">
          {catalog.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {isRtl ? row.name_ar : row.name_en}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t(`finance.services.categories.${row.category}`, { defaultValue: row.category })}
                  {" · "}
                  {t(`finance.services.models.${row.pricing_model}`, {
                    defaultValue: row.pricing_model,
                  })}
                  {" · v"}
                  {row.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.in_full_service && (
                  <Badge variant="secondary">{t("finance.services.fullService")}</Badge>
                )}
                {!row.commissionable && (
                  <Badge variant="outline">{t("admin.settings.catalog.noCommission")}</Badge>
                )}
                {!row.is_active && (
                  <Badge variant="outline">{t("admin.settings.catalog.inactive")}</Badge>
                )}
                <span className="text-sm font-medium">
                  {row.currency === "ILS"
                    ? formatILS(Number(row.default_price || 0))
                    : `${Number(row.default_price || 0).toLocaleString("en-US")} ${row.currency}`}
                </span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-semibold">{t("finance.services.fullService")}</p>
          <ul className="mt-1 space-y-0.5">
            {fullServiceItems.map((c) => (
              <li key={c.id} className="text-xs text-muted-foreground">
                ✓ {isRtl ? c.name_ar : c.name_en}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-semibold">
            {t("finance.services.total")} {formatILS(fullServiceTotal)}
          </p>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft.id ? t("admin.settings.catalog.edit") : t("admin.settings.catalog.add")}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.nameAr")}</Label>
                <Input value={draft.name_ar ?? ""} onChange={(e) => set({ name_ar: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.nameEn")}</Label>
                <Input value={draft.name_en ?? ""} onChange={(e) => set({ name_en: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.catalog.description")}</Label>
              <Textarea
                rows={2}
                value={(isRtl ? draft.description_ar : draft.description_en) ?? ""}
                onChange={(e) =>
                  set(isRtl ? { description_ar: e.target.value } : { description_en: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.category")}</Label>
                <Select
                  value={draft.category ?? "other"}
                  onValueChange={(v) => set({ category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`finance.services.categories.${c}`, { defaultValue: c })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.pricingModel")}</Label>
                <Select
                  value={draft.pricing_model ?? "fixed"}
                  onValueChange={(v) => set({ pricing_model: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`finance.services.models.${m}`, { defaultValue: m })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.price")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.default_price ?? 0}
                  onChange={(e) => set({ default_price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.currency")}</Label>
                <Select value={draft.currency ?? "ILS"} onValueChange={(v) => set({ currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ILS">ILS</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.sortOrder")}</Label>
                <Input
                  type="number"
                  value={draft.sort_order ?? 0}
                  onChange={(e) => set({ sort_order: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.catalog.school")}</Label>
              {applicabilitySelect(schools, draft.school_id, (v) => set({ school_id: v }))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.catalog.program")}</Label>
              {applicabilitySelect(programs, draft.program_id, (v) => set({ program_id: v }))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.catalog.accommodation")}</Label>
              {applicabilitySelect(accommodations, draft.accommodation_id, (v) =>
                set({ accommodation_id: v }),
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["is_active", t("admin.settings.catalog.active")],
                ["in_full_service", t("admin.settings.catalog.inFullService")],
                ["commissionable", t("admin.settings.catalog.commissionable")],
                ["allows_quantity", t("admin.settings.catalog.allowsQuantity")],
                ["is_optional", t("admin.settings.catalog.optional")],
              ].map(([key, labelText]) => (
                <div key={key as string} className="flex items-center justify-between gap-2">
                  <Label className="text-xs">{labelText as string}</Label>
                  <Switch
                    checked={!!(draft as any)[key as string]}
                    onCheckedChange={(v) => set({ [key as string]: v } as Draft)}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={saveDraft} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
