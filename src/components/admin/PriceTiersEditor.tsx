import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

export interface PriceTier {
  from_weeks: number | null;
  to_weeks: number | null;
  price: number | null;
}

export const parseTiers = (value: unknown): PriceTier[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t) => t && typeof t === "object")
    .map((t) => {
      const row = t as Record<string, unknown>;
      const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
      return {
        from_weeks: num(row.from_weeks),
        to_weeks: num(row.to_weeks),
        price: num(row.price),
      };
    });
};

/** Human readable ladder, e.g. "1-4 wk: 190 · 25+ wk: 165" */
export const formatTierLadder = (
  tiers: PriceTier[],
  currency: string,
  weeksLabel: string,
): string =>
  tiers
    .filter((t) => t.price != null)
    .map((t) => {
      const from = t.from_weeks ?? 1;
      const range = t.to_weeks ? `${from}-${t.to_weeks}` : `${from}+`;
      return `${range} ${weeksLabel}: ${Number(t.price).toLocaleString("en-US")} ${currency}`;
    })
    .join(" · ");

interface Props {
  tiers: PriceTier[];
  onChange: (tiers: PriceTier[]) => void;
}

const PriceTiersEditor: React.FC<Props> = ({ tiers, onChange }) => {
  const { t } = useTranslation("dashboard");

  const update = (index: number, patch: Partial<PriceTier>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };

  const toNumber = (value: string): number | null => (value === "" ? null : Number(value));

  return (
    <div className="space-y-2">
      <Label>{t("admin.programs.labelPriceTiers")}</Label>
      <p className="text-xs text-muted-foreground">{t("admin.programs.priceTiersHint")}</p>
      {tiers.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("admin.programs.noPriceTiers")}</p>
      )}
      <div className="space-y-2">
        {tiers.map((tier, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("admin.programs.labelTierFrom")}</Label>
              <Input
                type="number"
                min="1"
                value={tier.from_weeks ?? ""}
                onChange={(e) => update(index, { from_weeks: toNumber(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("admin.programs.labelTierTo")}</Label>
              <Input
                type="number"
                min="1"
                placeholder={t("admin.programs.tierOpenEnded")}
                value={tier.to_weeks ?? ""}
                onChange={(e) => update(index, { to_weeks: toNumber(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("admin.programs.labelTierPrice")}</Label>
              <Input
                type="number"
                min="0"
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
        onClick={() => onChange([...tiers, { from_weeks: null, to_weeks: null, price: null }])}
      >
        <Plus className="h-3 w-3" />
        {t("admin.programs.addTier")}
      </Button>
    </div>
  );
};

export default PriceTiersEditor;
