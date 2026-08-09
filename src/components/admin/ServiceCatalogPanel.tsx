import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useServiceCatalog, type CatalogService } from "@/hooks/useCaseServices";

export default function ServiceCatalogPanel() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { catalog, refetch } = useServiceCatalog();

  const [rows, setRows] = useState<CatalogService[]>([]);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name_ar: "", name_en: "", default_price: "" });

  useEffect(() => setRows(catalog), [catalog]);

  const patch = (id: string, changes: Partial<CatalogService>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const r of rows) {
        const { error } = await (supabase as any)
          .from("service_catalog")
          .update({
            name_ar: r.name_ar,
            name_en: r.name_en,
            default_price: Number(r.default_price || 0),
            is_active: r.is_active,
          })
          .eq("id", r.id);
        if (error) throw error;
      }
      toast({ description: t("admin.settings.catalog.saved") });
      refetch();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!draft.name_ar.trim() || !draft.name_en.trim()) {
      toast({ variant: "destructive", description: t("admin.settings.catalog.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("service_catalog").insert({
        name_ar: draft.name_ar.trim(),
        name_en: draft.name_en.trim(),
        default_price: Number(draft.default_price || 0),
        sort_order: rows.length + 1,
      });
      if (error) throw error;
      setDraft({ name_ar: "", name_en: "", default_price: "" });
      refetch();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("service_catalog").delete().eq("id", id);
      if (error) throw error;
      refetch();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("admin.settings.catalog.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("admin.settings.catalog.hint")}</p>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_130px_auto_auto_auto] items-end rounded-md border p-2.5">
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.nameAr")}</Label>
                <Input value={r.name_ar} onChange={(e) => patch(r.id, { name_ar: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.nameEn")}</Label>
                <Input value={r.name_en} onChange={(e) => patch(r.id, { name_en: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("admin.settings.catalog.price")}</Label>
                <Input
                  type="number"
                  value={r.default_price}
                  onChange={(e) => patch(r.id, { default_price: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={r.is_active}
                  onCheckedChange={(v) => patch(r.id, { is_active: v })}
                  aria-label={t("admin.settings.catalog.active")}
                />
                <span className="text-xs text-muted-foreground">
                  {t("admin.settings.catalog.active")}
                </span>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={r.in_full_service}
                  onCheckedChange={(v) => patch(r.id, { in_full_service: v })}
                  aria-label={t("admin.settings.catalog.inFullService")}
                />
                <span className="text-xs text-muted-foreground">
                  {t("admin.settings.catalog.inFullService")}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                disabled={saving}
                onClick={() => remove(r.id)}
                aria-label={t("admin.settings.catalog.remove")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={saveAll} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("common.save")}
        </Button>

        <Separator />

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_130px_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.settings.catalog.nameAr")}</Label>
            <Input
              value={draft.name_ar}
              onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.settings.catalog.nameEn")}</Label>
            <Input
              value={draft.name_en}
              onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.settings.catalog.price")}</Label>
            <Input
              type="number"
              value={draft.default_price}
              onChange={(e) => setDraft({ ...draft, default_price: e.target.value })}
            />
          </div>
          <Button variant="outline" onClick={add} disabled={saving} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("admin.settings.catalog.add")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
