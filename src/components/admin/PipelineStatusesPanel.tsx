import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePipelineStatuses } from "@/hooks/usePipelineStatuses";
import { PIPELINE_STATUS_COLORS, PipelineStatus, statusColorClasses } from "@/lib/caseStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Loader2, Save } from "lucide-react";

type Row = PipelineStatus & { id: string };

export default function PipelineStatusesPanel() {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { statuses, refresh } = usePipelineStatuses();

  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(statuses.filter((s) => !!s.id) as Row[]);
  }, [statuses]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cases").select("status").is("deleted_at", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((c: { status: string }) => {
        map[c.status] = (map[c.status] ?? 0) + 1;
      });
      setCounts(map);
    })();
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(statuses.filter((s) => !!s.id)),
    [rows, statuses],
  );

  const patch = (id: string, changes: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next.map((r, i) => ({ ...r, sort_order: i + 1 })));
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        const { error } = await supabase
          .from("pipeline_statuses")
          .update({
            label_ar: row.label_ar,
            label_en: row.label_en,
            color: row.color,
            sort_order: row.sort_order,
            is_active: row.is_active,
          })
          .eq("id", row.id);
        if (error) throw error;
      }
      await refresh();
      toast({ description: t("admin.settings.pipeline.saved", "Pipeline stages saved") });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ variant: "destructive", description: message });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>{t("admin.settings.pipeline.title", "Pipeline stages")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "admin.settings.pipeline.hint",
              "Rename, recolor and reorder the stages of the case pipeline. A stage that still holds cases cannot be switched off.",
            )}
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ms-2">{t("common.save", "Save")}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusColorClasses(row.color)}`}>
                {isRtl ? row.label_ar : row.label_en}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("admin.settings.pipeline.caseCount", "Cases")}:{" "}
                  {(counts[row.key] ?? 0).toLocaleString("en-US")}
                </span>
                <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">{t("admin.settings.pipeline.labelAr", "Arabic name")}</Label>
                <Input dir="rtl" value={row.label_ar} onChange={(e) => patch(row.id, { label_ar: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t("admin.settings.pipeline.labelEn", "English name")}</Label>
                <Input value={row.label_en} onChange={(e) => patch(row.id, { label_en: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t("admin.settings.pipeline.color", "Color")}</Label>
                <Select value={row.color} onValueChange={(v) => patch(row.id, { color: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STATUS_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className={`inline-block px-2 py-0.5 rounded ${statusColorClasses(c)}`}>{c}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch
                  checked={row.is_active}
                  onCheckedChange={(v) => patch(row.id, { is_active: v })}
                  id={`active-${row.id}`}
                />
                <Label htmlFor={`active-${row.id}`} className="text-xs">
                  {t("admin.settings.pipeline.active", "Active")}
                </Label>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground font-mono">{row.key}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
