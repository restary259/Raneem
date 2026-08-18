import React from "react";
import { CVData } from "./types";
import { designVars } from "./cvDesign";
import { A4_H_PX, A4_W_PX } from "./cvLayout";
import GermanStandardTemplate from "./templates/GermanStandardTemplate";
import AcademicTemplate from "./templates/AcademicTemplate";
import EuropassTemplate from "./templates/EuropassTemplate";
import ModernSidebarTemplate from "./templates/ModernSidebarTemplate";

/**
 * The template-selection switch, rendered once and shared by the on-screen
 * preview ({@link CVPreview}) and the PDF capture copy ({@link CvCaptureSheet}).
 * Sharing this element is what guarantees the two copies can never diverge —
 * a new template added here appears in both, so the PDF can never silently
 * render a different template than the on-screen preview.
 */
export const CvSheetBody: React.FC<{ data: CVData }> = ({ data }) => (
  <>
    {data.template === "academic" && <AcademicTemplate data={data} />}
    {data.template === "german-standard" && <GermanStandardTemplate data={data} />}
    {data.template === "europass" && <EuropassTemplate data={data} />}
    {data.template === "modern-sidebar" && <ModernSidebarTemplate data={data} />}
  </>
);

/** The fixed-A4-width sheet style (width + min-height + design vars), shared
 *  by both copies so they reflow identically. */
export const sheetStyleFor = (design: CVData["design"]): React.CSSProperties => ({
  width: A4_W_PX,
  minHeight: A4_H_PX,
  ...designVars(design),
});

/**
 * Unscaled, native-A4-width sheet — the only render path the PDF capture
 * copy uses. html2canvas rasterizes this at 794px, so jsPDF slices align to
 * real A4 page boundaries. It is NOT used on screen; the on-screen preview
 * is {@link CVPreview}, which scales the same {@link CvSheetBody} to fit the
 * column.
 */
export interface CvCaptureSheetProps {
  data: CVData;
  /** id of the capture root (html2canvas targets this). */
  id?: string;
}

export const CvCaptureSheet: React.FC<CvCaptureSheetProps> = ({ data, id = "cv-capture" }) => {
  const dir = data.contentLanguage === "ar" ? "rtl" : "ltr";
  return (
    <div className="cv-scale-wrapper" style={{ width: A4_W_PX }}>
      <div
        id={id}
        dir={dir}
        className="cv-preview-container cv-scale-container relative bg-white shadow-lg border rounded-lg overflow-hidden"
        style={sheetStyleFor(data.design)}
      >
        <CvSheetBody data={data} />
      </div>
    </div>
  );
};
