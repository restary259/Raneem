import React from "react";
import { useTranslation } from "react-i18next";
import RangeTierEditor from "@/components/admin/RangeTierEditor";
import type { AgePriceTier } from "@/lib/insurancePricing";

interface Props {
  tiers: AgePriceTier[];
  currency: string;
  onChange: (tiers: AgePriceTier[]) => void;
}

const InsuranceRatesEditor: React.FC<Props> = ({ tiers, currency, onChange }) => {
  const { t } = useTranslation("dashboard");

  return (
    <RangeTierEditor<keyof AgePriceTier>
      label={t("admin.programs.labelAgeRates")}
      hint={t("admin.programs.ageRatesHint")}
      emptyLabel={t("admin.programs.noAgeRates")}
      tiers={tiers}
      onChange={onChange}
      blankTier={{ from_age: null, to_age: null, price: null }}
      fields={[
        { key: "from_age", label: t("admin.programs.labelAgeFrom"), min: "0" },
        {
          key: "to_age",
          label: t("admin.programs.labelAgeTo"),
          min: "0",
          placeholder: t("admin.programs.tierOpenEnded"),
        },
        {
          key: "price",
          label: t("admin.programs.labelMonthlyRate", { currency }),
          min: "0",
          step: "0.01",
        },
      ]}
    />
  );
};

export default InsuranceRatesEditor;
