import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import type { AgePriceTier } from "@/lib/insurancePricing";

interface Props {
  tiers: AgePriceTier[];
  currency: string;
  onChange: (tiers: AgePriceTier[]) => void;
}

const InsuranceRatesEditor: React.FC<Props> = ({ tiers, currency, onChange }) => {
  const { t } = useTranslation("dashboard");

  const toNumber = (value: string): number | null => (value === "" ? null : Number(value));
  const update = (index: number, patch: Partial<AgePriceTier>) =>
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));

  return (
    <div className="space-y-2">
      <Label>{t("admin.programs.labelAgeRates")}</Label>
      <p className="text-xs text-muted-foreground">{t("admin.programs.ageRatesHint")}</p>
      {tiers.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("admin.programs.noAgeRates")}</p>
      )}
      <div className="space-y-2">
        {tiers.map((tier, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("admin.programs.labelAgeFrom")}</Label>
              <Input
                type="number"
                min="0"
                value={tier.from_age ?? ""}
                onChange={(e) => update(index, { from_age: toNumber(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("admin.programs.labelAgeTo")}</Label>
              <Input
                type="number"
                min="0"
                placeholder={t("admin.programs.tierOpenEnded")}
                value={tier.to_age ?? ""}
                onChange={(e) => update(index, { to_age: toNumber(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">
                {t("admin.programs.labelMonthlyRate", { currency })}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={tier.price ?? ""}
                onChange={(e) => update(index, { price: toNumber(e.target.value) })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("admin.programs.removeTier")}
              onClick={() => onChange(tiers.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onChange([...tiers, { from_age: null, to_age: null, price: null }])}
      >
        <Plus className="h-3 w-3" />
        {t("admin.programs.addTier")}
      </Button>
    </div>
  );
};

export default InsuranceRatesEditor;
