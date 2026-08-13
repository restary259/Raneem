import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import CurrencyConverter from "@/components/calculator/CurrencyConverter";

const TeamCurrencyPage = () => {
  const { t } = useTranslation("dashboard");
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.currency", "Currency converter")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("team.currencyDesc", "Live FX rates to quote fees in your student's currency.")}
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <CurrencyConverter />
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamCurrencyPage;
