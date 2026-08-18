import React, { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CVData } from "./types";
import { designVars } from "./cvDesign";
import { A4_H_PX, A4_W_PX, computeScale, pageCount } from "./cvLayout";
import GermanStandardTemplate from "./templates/GermanStandardTemplate";
import AcademicTemplate from "./templates/AcademicTemplate";
import EuropassTemplate from "./templates/EuropassTemplate";
import ModernSidebarTemplate from "./templates/ModernSidebarTemplate";

interface Props {
  data: CVData;
  /** id of the preview root. Defaults to "cv-preview" (the on-screen preview).
   *  The PDF capture path renders a second, off-screen copy with id
   *  "cv-capture" so it is always laid out at full A4 width regardless of the
   *  mobile edit/preview toggle (html2canvas cannot capture display:none). */
  id?: string;
  /** When true (default), the A4 sheet is scaled with a CSS transform to fit
   *  the available column width and the wrapper reserves the measured scaled
   *  height so layout flow is correct. When false, the sheet renders at native
   *  794px with no transform — used by the off-screen capture copy so
   *  html2canvas rasterizes the unscaled A4 sheet. */
  scaled?: boolean;
}

const CVPreview: React.FC<Props> = ({ data, id = "cv-preview", scaled = true }) => {
  const { t } = useTranslation("resources");
  const dir = data.contentLanguage === "ar" ? "rtl" : "ltr";
  const vars = designVars(data.design);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [measuredHeight, setMeasuredHeight] = useState(A4_H_PX);

  // The sheet body is rendered once and shared by both branches so the
  // on-screen and capture copies can never diverge (e.g. a new template
  // added to one but not the other would silently make the PDF wrong).
  const sheetBody = (
    <>
      {data.template === "academic" && <AcademicTemplate data={data} />}
      {data.template === "german-standard" && <GermanStandardTemplate data={data} />}
      {data.template === "europass" && <EuropassTemplate data={data} />}
      {data.template === "modern-sidebar" && <ModernSidebarTemplate data={data} />}
    </>
  );
  const sheetStyle: React.CSSProperties = {
    width: A4_W_PX,
    minHeight: A4_H_PX,
    ...vars,
  };

  // The observer both recomputes scale on column resize and reads the latest
  // content height when the sheet's own height changes (edits), so `data` is
  // intentionally NOT a dependency — the observer is the change signal, not a
  // render-counted reconnect. Gated on `scaled` (no-op for the capture copy).
  useLayoutEffect(() => {
    if (!scaled) return;
    const wrapper = wrapperRef.current;
    const sheet = sheetRef.current;
    if (!wrapper || !sheet) return;

    const recompute = () => {
      setScale(computeScale(wrapper.clientWidth));
      setMeasuredHeight(sheet.scrollHeight);
    };
    recompute();

    const ro = new ResizeObserver(recompute);
    ro.observe(wrapper);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, [scaled]);

  // Off-screen capture copy: native 794px, no transform — html2canvas
  // rasterizes the unscaled A4 sheet so jsPDF slices align to page bounds.
  if (!scaled) {
    return (
      <div className="cv-scale-wrapper" style={{ width: A4_W_PX }}>
        <div
          id={id}
          ref={sheetRef}
          dir={dir}
          className="cv-preview-container cv-scale-container relative bg-white shadow-lg border rounded-lg overflow-hidden"
          style={sheetStyle}
        >
          {sheetBody}
        </div>
      </div>
    );
  }

  const pages = pageCount(measuredHeight);
  const breakLines = Array.from({ length: pages - 1 }, (_, i) => (i + 1) * A4_H_PX);

  return (
    <div
      ref={wrapperRef}
      className="cv-scale-wrapper w-full print:w-full print:h-auto"
      style={{ height: measuredHeight * scale }}
    >
      <div
        className="cv-scale-container print:transform-none print:w-full"
        style={{
          width: A4_W_PX,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        <div
          id={id}
          ref={sheetRef}
          dir={dir}
          className="cv-preview-container relative bg-white shadow-lg border rounded-lg overflow-hidden print:overflow-visible print:shadow-none print:border-0 print:rounded-none"
          style={sheetStyle}
        >
          {sheetBody}

          {/* A4 page-break indicators, screen only. Each dashed rule sits at
              the pixel row where a new A4 page begins; the chip uses the
              inline-end edge so it flips under RTL. */}
          {breakLines.length > 0 && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 print:hidden" style={{ height: measuredHeight }}>
              {breakLines.map((top, i) => (
                <div key={i} className="absolute inset-x-0 flex items-center" style={{ top }}>
                  <div className="w-full border-t border-dashed border-muted-foreground/30" />
                  <span className="absolute end-0 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {`${t("lebenslaufBuilder.pageLabel", "Page")} ${i + 2}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CVPreview;
