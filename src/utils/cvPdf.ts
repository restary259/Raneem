/**
 * Generate a clean, chrome-free PDF of the CV preview and download it
 * directly (no browser print dialog → no date/URL/page-number stamp, no
 * Lovable badge, no blank page). Rasterizes the live #cv-capture DOM with
 * html2canvas at 2× for crisp text, then slices the tall canvas across A4
 * pages in jsPDF. RTL/Arabic is captured visually correct because the
 * already-rendered DOM (dir="rtl" + bundled web fonts) is what we rasterize.
 *
 * html2canvas + jsPDF are dynamically imported so the heavy vendor-pdf chunk
 * only loads when the user actually clicks download.
 */

import { A4_H_MM, A4_H_PX, computeEntryShifts, slicePageCount } from "@/components/lebenslauf/cvLayout";

const A4_WIDTH_MM = 210;

/**
 * Push every .cv-entry that straddles an A4 page boundary wholly onto the
 * next page by inserting temporary spacer divs into the capture sheet, so the
 * rasterized image never slices an entry in half (break-inside-avoid only
 * affects browser print, not a rasterized image). Spacers are used instead of
 * marginTop because adjacent vertical margins collapse, which would silently
 * shrink or swallow the shift. Returns a restore function that removes the
 * spacers again.
 *
 * Scope: entries are selected only inside .cv-main-flow — the single vertical
 * main column every template marks — which is what keeps entry tops monotonic
 * in document order, the precondition computeEntryShifts relies on. A future
 * template that puts .cv-entry in a parallel rail/sidebar is excluded rather
 * than silently corrupting the shift math. Rail/sidebar blocks carry no
 * .cv-entry and can still be sliced at a page boundary; accepted residual
 * risk (spacers there would not move the main column, so the cumulative-
 * offset model cannot cover a second parallel flow). Exported for unit tests.
 */
export function shiftStraddlingEntries(root: HTMLElement): () => void {
  const scope = root.querySelector(".cv-main-flow") ?? root;
  const rootTop = root.getBoundingClientRect().top;
  const entries = Array.from(scope.querySelectorAll<HTMLElement>(".cv-entry"));
  const shifts = computeEntryShifts(
    entries.map((entry) => {
      const rect = entry.getBoundingClientRect();
      return { top: rect.top - rootTop, height: rect.height };
    }),
    A4_H_PX,
  );

  const spacers: HTMLElement[] = [];
  entries.forEach((entry, i) => {
    const shift = shifts[i];
    if (shift <= 0) return;
    // Keep a section heading attached to its first entry: insert the spacer
    // before the heading so it is not orphaned at the bottom of the page.
    const anchor = entry.previousElementSibling?.tagName === "H2" ? entry.previousElementSibling : entry;
    const spacer = document.createElement("div");
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.height = `${shift}px`;
    anchor.parentNode?.insertBefore(spacer, anchor);
    spacers.push(spacer);
  });

  return () => {
    for (const spacer of spacers) spacer.parentNode?.removeChild(spacer);
  };
}

export async function downloadCvPdf(elementId: string, fileName: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error(`CV preview element "#${elementId}" not found`);
  }

  const [{ default: html2canvas }, jspdfModule] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  // jspdf v4 exposes both a named `jsPDF` and a default export.
  const jsPDF = (jspdfModule as typeof import("jspdf")).jsPDF ?? (jspdfModule as unknown as { default: typeof import("jspdf").jsPDF }).default;

  // The CV font presets are loaded via a non-blocking <link>; wait for them so
  // the capture never races font loading and rasterizes fallback fonts.
  await document.fonts.ready;

  const restore = shiftStraddlingEntries(el);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
  } finally {
    restore();
  }

  const imgData = canvas.toDataURL("image/png");

  // Full-bleed A4 width; templates already carry their own internal padding,
  // so no page margin is added. Image height in mm derived from the canvas
  // aspect ratio so the preview is reproduced exactly.
  const imgHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Draw the single tall image once per page with a negative y offset so each
  // page shows the next slice. Entries were pushed off page boundaries above,
  // so no entry is split across pages; slicePageCount drops a trailing slice
  // shorter than the epsilon as a near-blank page.
  const pages = slicePageCount(imgHeightMm);
  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, -i * A4_H_MM, A4_WIDTH_MM, imgHeightMm);
  }

  pdf.save(fileName);
}
