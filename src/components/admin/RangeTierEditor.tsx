import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

export interface TierField<K extends string> {
  key: K;
  label: string;
  min?: string;
  step?: string;
  placeholder?: string;
}

type Tier<K extends string> = Record<K, number | null>;

interface Props<K extends string> {
  label: string;
  hint: string;
  emptyLabel: string;
  fields: TierField<K>[];
  tiers: Tier<K>[];
  /** Row appended by the add button, e.g. `{ from_weeks: null, to_weeks: null, price: null }`. */
  blankTier: Tier<K>;
  onChange: (tiers: Tier<K>[]) => void;
}

/**
 * Editor for a ladder of `from`/`to`/`price` rows — used for both program price
 * tiers (by weeks) and insurance rates (by age).
 */
function RangeTierEditor<K extends string>({
  label,
  hint,
  emptyLabel,
  fields,
  tiers,
  blankTier,
  onChange,
}: Props<K>) {
  const { t } = useTranslation("dashboard");

  const toNumber = (value: string): number | null => (value === "" ? null : Number(value));
  const update = (index: number, key: K, value: string) =>
    onChange(
      tiers.map((tier, i) => (i === index ? { ...tier, [key]: toNumber(value) } : tier)),
    );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {tiers.length === 0 && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
      <div className="space-y-2">
        {tiers.map((tier, index) => (
          <div key={index} className="flex items-end gap-2">
            {fields.map((field) => (
              <div key={field.key} className="flex-1 space-y-1">
                <Label className="text-xs">{field.label}</Label>
                <Input
                  type="number"
                  min={field.min}
                  step={field.step}
                  placeholder={field.placeholder}
                  value={tier[field.key] ?? ""}
                  onChange={(e) => update(index, field.key, e.target.value)}
                />
              </div>
            ))}
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
        onClick={() => onChange([...tiers, blankTier])}
      >
        <Plus className="h-3 w-3" />
        {t("admin.programs.addTier")}
      </Button>
    </div>
  );
}

export default RangeTierEditor;
