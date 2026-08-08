import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
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

const CaseServices: React.FC<Props> = ({ caseId, services, canManage, onChanged }) => {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";
  const { toast } = useToast();
  const { catalog } = useServiceCatalog();

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<string>("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [discount, setDiscount] = useState("0");

  const active = useMemo(() => catalog.filter((c) => c.is_active), [catalog]);
  const label = (c: { name_ar: string; name_en: string }) => (isRtl ? c.name_ar : c.name_en);

  const reset = () => {
    setPick("");
    setPrice("");
    setQty("1");
    setDiscount("0");
    setAdding(false);
  };

  const choose = (id: string) => {
    setPick(id);
    const svc = active.find((c) => c.id === id);
    if (svc) setPrice(String(svc.default_price));
  };

  const add = async () => {
    const svc = active.find((c) => c.id === pick);
    if (!svc) {
      toast({ variant: "destructive", description: t("finance.services.pickFirst") });
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("case_services").insert({
        case_id: caseId,
        service_id: svc.id,
        description: label(svc),
        category: svc.category,
        unit_price: Number(price || 0),
        quantity: Number(qty || 1),
        discount: Number(discount || 0),
      });
      if (error) throw error;
      toast({ description: t("finance.services.added") });
      reset();
      onChanged();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("case_services").delete().eq("id", id);
      if (error) throw error;
      toast({ description: t("finance.services.removed") });
      onChanged();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const total = services.reduce((s, x) => s + caseServiceTotal(x), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("finance.services.title")}</h3>
        {canManage && !adding && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t("finance.services.add")}
          </Button>
        )}
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t("finance.services.empty")}</p>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border p-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatILS(s.unit_price)} × {Number(s.quantity).toLocaleString("en-US")}
                  {Number(s.discount) > 0 && (
                    <> · {t("finance.services.discount")} {formatILS(s.discount)}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="whitespace-nowrap">
                  {formatILS(caseServiceTotal(s))}
                </Badge>
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    disabled={busy}
                    onClick={() => remove(s.id)}
                    aria-label={t("finance.services.remove")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-between text-sm font-semibold pt-1">
            <span>{t("finance.services.total")}</span>
            <span>{formatILS(total)}</span>
          </div>
        </div>
      )}

      {canManage && adding && (
        <>
          <Separator />
          <div className="space-y-3 rounded-md border p-3 bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.services.service")}</Label>
              <Select value={pick} onValueChange={choose}>
                <SelectTrigger>
                  <SelectValue placeholder={t("finance.services.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {active.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {label(c)} — {formatILS(c.default_price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("finance.services.price")}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("finance.services.qty")}</Label>
                <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("finance.services.discount")}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={add} disabled={busy} className="gap-1">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("finance.services.save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CaseServices;
