import React from "react";
import { CVData } from "./types";
import { designVars } from "./cvDesign";
import GermanStandardTemplate from "./templates/GermanStandardTemplate";
import AcademicTemplate from "./templates/AcademicTemplate";
import EuropassTemplate from "./templates/EuropassTemplate";
import ModernSidebarTemplate from "./templates/ModernSidebarTemplate";

interface Props {
  data: CVData;
}

const CVPreview: React.FC<Props> = ({ data }) => {
  const dir = data.contentLanguage === "ar" ? "rtl" : "ltr";
  const vars = designVars(data.design);

  return (
    <div
      id="cv-preview"
      dir={dir}
      className="cv-preview-container bg-white shadow-lg border rounded-lg overflow-hidden print:overflow-visible print:shadow-none print:border-0 print:rounded-none"
      style={{ ...vars } as React.CSSProperties}
    >
      {data.template === "academic" && <AcademicTemplate data={data} />}
      {data.template === "german-standard" && <GermanStandardTemplate data={data} />}
      {data.template === "europass" && <EuropassTemplate data={data} />}
      {data.template === "modern-sidebar" && <ModernSidebarTemplate data={data} />}
    </div>
  );
};

export default CVPreview;
