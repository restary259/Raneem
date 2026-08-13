import { useTranslation } from "react-i18next";
import LebenslaufBuilder from "@/components/lebenslauf/LebenslaufBuilder";

const TeamCvBuilderPage = () => {
  const { t } = useTranslation("dashboard");
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.cvBuilder", "CV builder")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("team.cvBuilderDesc", "Draft a German CV (Lebenslauf). Drafts are saved to this device only.")}
        </p>
      </div>
      <LebenslaufBuilder />
    </div>
  );
};

export default TeamCvBuilderPage;
