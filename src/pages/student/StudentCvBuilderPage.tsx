import { useTranslation } from "react-i18next";
import LebenslaufBuilder from "@/components/lebenslauf/LebenslaufBuilder";

const StudentCvBuilderPage = () => {
  const { t } = useTranslation("dashboard");
  return (
    <div className="flex flex-col lg:h-[calc(100vh-3.5rem)] p-4 sm:p-6 max-w-7xl mx-auto w-full">
      <div className="shrink-0 mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.cvBuilder", "CV builder")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("team.cvBuilderDesc", "Draft a German CV (Lebenslauf). Drafts are saved to this device only.")}
        </p>
      </div>
      {/* embedded: only the form + preview panes scroll under the h-14 header;
          the FAQ/toolbar stay put. stickyTopClassName is calibrated for the
          dashboard's short header (not the tall public marketing header). */}
      <div className="lg:flex-1 lg:min-h-0">
        <LebenslaufBuilder embedded stickyTopClassName="lg:top-4" />
      </div>
    </div>
  );
};

export default StudentCvBuilderPage;
