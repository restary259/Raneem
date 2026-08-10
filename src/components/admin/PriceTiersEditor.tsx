import React from "react";
import { useTranslation } from "react-i18next";
import RangeTierEditor from "@/components/admin/RangeTierEditor";

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

  return (
    <RangeTierEditor<keyof PriceTier>
      label={t("admin.programs.labelPriceTiers")}
      hint={t("admin.programs.priceTiersHint")}
      emptyLabel={t("admin.programs.noPriceTiers")}
      tiers={tiers}
      onChange={onChange}
      blankTier={{ from_weeks: null, to_weeks: null, price: null }}
      fields={[
        { key: "from_weeks", label: t("admin.programs.labelTierFrom"), min: "1" },
        {
          key: "to_weeks",
          label: t("admin.programs.labelTierTo"),
          min: "1",
          placeholder: t("admin.programs.tierOpenEnded"),
        },
        { key: "price", label: t("admin.programs.labelTierPrice"), min: "0" },
      ]}
    />
  );
};

export default PriceTiersEditor;
