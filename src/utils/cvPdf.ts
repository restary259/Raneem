/**
 * Generate a clean, chrome-free PDF of the CV preview and download it
 * directly (no browser print dialog → no date/URL/page-number stamp, no
 * Lovable badge, no blank page). Rasterizes the live #cv-preview DOM with
 * html2canvas at 2× for crisp text, then slices the tall canvas across A4
 * pages in jsPDF. RTL/Arabic is captured visually correct because the
 * already-rendered DOM (dir="rtl" + bundled web fonts) is what we rasterize.
 *
 * html2canvas + jsPDF are dynamically imported so the heavy vendor-pdf chunk
 * only loads when the user actually clicks download.
 */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

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

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/png");

  // Full-bleed A4 width; templates already carry their own internal padding,
  // so no page margin is added. Image height in mm derived from the canvas
  // aspect ratio so the preview is reproduced exactly.
  const imgHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width;

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  if (imgHeightMm <= A4_HEIGHT_MM) {
    pdf.addImage(imgData, "PNG", 0, 0, A4_WIDTH_MM, imgHeightMm);
  } else {
    // Multi-page: draw the single tall image once per page with a negative y
    // offset so each page shows the next slice. This paginates long CVs across
    // A4 pages without splitting individual entries.
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, A4_WIDTH_MM, imgHeightMm);
    while (position - A4_HEIGHT_MM > -imgHeightMm) {
      position -= A4_HEIGHT_MM;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, A4_WIDTH_MM, imgHeightMm);
    }
  }

  pdf.save(fileName);
}
