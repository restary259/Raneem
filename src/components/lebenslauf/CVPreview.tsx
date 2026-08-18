import React, { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CVData } from "./types";
import { A4_H_PX, A4_W_PX, computeScale, pageCount } from "./cvLayout";
import { CvSheetBody, sheetStyleFor } from "./CvSheet";

interface Props {
  data: CVData;
  /** id of the preview root. Defaults to "cv-preview" (the on-screen preview). */
  id?: string;
}

/**
 * The on-screen CV preview: a fixed-A4-width sheet (794px) visually scaled
 * with a CSS transform to fit the column, so on-screen text reflow matches
 * the downloaded PDF exactly (the PDF capture copy — {@link CvCaptureSheet}
 * — renders the same {@link CvSheetBody} at native 794px). The wrapper
 * reserves `measuredHeight * scale` so the transform doesn't collapse the
 * surrounding flow; multi-page content scrolls naturally. A dashed A4
 * page-break overlay shows exactly where the PDF will slice.
 */
const CVPreview: React.FC<Props> = ({ data, id = "cv-preview" }) => {
  const { t } = useTranslation("resources");
  const dir = data.contentLanguage === "ar" ? "rtl" : "ltr";

  const wrapperRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [measuredHeight, setMeasuredHeight] = useState(A4_H_PX);

  // The observer both recomputes scale on column resize and reads the latest
  // content height when the sheet's own height changes (edits), so `data` is
  // intentionally NOT a dependency — the observer is the change signal, not a
  // render-counted reconnect.
  useLayoutEffect(() => {
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
  }, []);

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
          style={sheetStyleFor(data.design)}
        >
          <CvSheetBody data={data} />

          {/* A4 page-break indicators, screen only. Each dashed rule sits at
              the pixel row where a new A4 page begins; the chip uses the
              inline-end edge so it flips under RTL. */}
          {breakLines.length > 0 && (
            <div aria-hidden data-page-break-overlay className="pointer-events-none absolute inset-x-0 top-0 print:hidden" style={{ height: measuredHeight }}>
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

