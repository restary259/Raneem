import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  type DocBlock,
  type DocumentRecord,
  type DocumentVersionRecord,
  type VariableMap,
  resolveText,
  isRtlLanguage,
  formatIls,
} from "@/lib/documentBlocks";
import {
  registerPdfFonts,
  fontForText,
  hasRtl,
  type FontRegistration,
} from "@/utils/pdfFonts";

/** DARB brand orange (matches the `--brand` token, hsl(24.6 95% 53%) ≈ #F97316). */
export const DARB_ACCENT: [number, number, number] = [249, 115, 22];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface DrawCtx {
  doc: jsPDF;
  fonts: FontRegistration;
  y: number;
  page: number;
  /** True after the cover block — header/footer appear from page 2 onwards. */
  hasCover: boolean;
}

const ensureSpace = (ctx: DrawCtx, needed: number) => {
  if (ctx.y + needed > PAGE_H - MARGIN - 12) {
    ctx.doc.addPage();
    ctx.page += 1;
    ctx.y = MARGIN;
    if (ctx.hasCover) drawHeaderFooter(ctx);
  }
};

const setFont = (ctx: DrawCtx, text: string, style: "normal" | "bold" = "normal", size: number) => {
  const family = fontForText(text, ctx.fonts, "helvetica");
  ctx.doc.setFont(family, style);
  ctx.doc.setFontSize(size);
};

const drawText = (ctx: DrawCtx, text: string, opts: {
  x?: number; y?: number; size: number; style?: "normal" | "bold"; maxWidth?: number; align?: "left" | "right" | "center"; color?: [number, number, number];
}) => {
  const { x = MARGIN, y = ctx.y, size, style = "normal", maxWidth = CONTENT_W, align = "left", color } = opts;
  setFont(ctx, text, style, size);
  if (color) ctx.doc.setTextColor(color[0], color[1], color[2]);
  else ctx.doc.setTextColor(31, 41, 55);
  const lines = ctx.doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    if (ctx.y + size * 0.5 > PAGE_H - MARGIN - 12) {
      ctx.doc.addPage();
      ctx.page += 1;
      ctx.y = MARGIN;
      if (ctx.hasCover) drawHeaderFooter(ctx);
    }
    let lx = x;
    if (align === "right") lx = MARGIN + CONTENT_W - (ctx.doc.getTextWidth(line) || 0);
    else if (align === "center") lx = MARGIN + (CONTENT_W - (ctx.doc.getTextWidth(line) || 0)) / 2;
    ctx.doc.text(line, lx, y);
    ctx.y = y + size * 0.6 + 1;
    if (ctx.y > PAGE_H - MARGIN - 12) break;
  }
  return ctx.y;
};

function drawHeaderFooter(ctx: DrawCtx) {
  const doc = ctx.doc;
  const totalPages = doc.getNumberOfPages();
  // Header
  doc.setFillColor(...DARB_ACCENT);
  doc.setTextColor(...DARB_ACCENT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DARB", MARGIN, MARGIN - 8);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("DARB Study International — Confidential", PAGE_W - MARGIN, MARGIN - 8, { align: "right" });
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, MARGIN - 5, PAGE_W - MARGIN, MARGIN - 5);
  // Footer
  const fy = PAGE_H - MARGIN + 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, fy - 4, PAGE_W - MARGIN, fy - 4);
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(8);
  doc.text(`Page ${ctx.page} of ${totalPages}`, PAGE_W - MARGIN, fy, { align: "right" });
  doc.text("Confidential — for the intended recipient only", MARGIN, fy);
}

/**
 * Generate a DARB document PDF block-by-block. RTL (ar/he) text is rendered
 * with the bundled Noto faces via pdfFonts.ts; Latin text uses Helvetica.
 * Returns the jsPDF instance so callers can `.output('blob')` for storage.
 */
export async function generateDocumentPdf(
  document: Pick<DocumentRecord, "title" | "slug" | "language">,
  version: Pick<DocumentVersionRecord, "version" | "content">,
  variables: VariableMap,
  opts: { title?: string } = {},
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const fonts = await registerPdfFonts(doc);
  const rtlLang = isRtlLanguage(document.language);
  const ctx: DrawCtx = { doc, fonts, y: MARGIN, page: 1, hasCover: false };
  const titleOverride = opts.title ?? document.title;

  let l1 = 0;
  const blocks = version.content ?? [];

  for (const b of blocks) {
    switch (b.type) {
      case "cover": {
        ctx.hasCover = true;
        // Reserve most of the first page for the cover; no header/footer.
        doc.setFillColor(...DARB_ACCENT);
        doc.setDrawColor(...DARB_ACCENT);
        doc.setLineWidth(2);
        doc.line(MARGIN + 30, 80, MARGIN + CONTENT_W - 30, 80);
        doc.setTextColor(...DARB_ACCENT);
        setFont(ctx, titleOverride, "bold", 26);
        doc.text(doc.splitTextToSize(titleOverride || "Untitled", CONTENT_W - 40) as string[], MARGIN, 100, { align: "center" });
        if (b.subtitle) {
          ctx.y = 110;
          drawText(ctx, resolveText(b.subtitle, variables), { size: 13, align: "center" });
        }
        if (b.note) {
          ctx.y = 140;
          drawText(ctx, resolveText(b.note, variables), { size: 10, align: "center", color: [107, 114, 128] });
        }
        doc.addPage();
        ctx.page += 1;
        ctx.y = MARGIN;
        break;
      }
      case "heading": {
        if (b.level === 1) l1 += 1;
        const num = b.level === 1 ? `${l1}. ` : "";
        ensureSpace(ctx, 12);
        const text = `${num}${resolveText(b.text, variables)}`;
        if (b.level === 1) {
          drawText(ctx, text, { size: 16, style: "bold", color: DARB_ACCENT });
          doc.setDrawColor(...DARB_ACCENT);
          doc.setLineWidth(0.5);
          doc.line(MARGIN, ctx.y, MARGIN + CONTENT_W, ctx.y);
          ctx.y += 3;
        } else {
          drawText(ctx, text, { size: 13, style: "bold", x: MARGIN + 6 });
        }
        break;
      }
      case "paragraph": {
        ensureSpace(ctx, 8);
        const text = resolveText(b.text, variables);
        const align = rtlLang ? "right" : "left";
        const x = rtlLang ? PAGE_W - MARGIN : MARGIN;
        ctx.y = drawText(ctx, text, { size: 11, x, maxWidth: CONTENT_W, align: align as "left" | "right" });
        break;
      }
      case "list": {
        ensureSpace(ctx, 6);
        const items = b.items.filter(Boolean).map((it) => resolveText(it, variables));
        if (b.ordered) {
          items.forEach((it, k) => {
            ensureSpace(ctx, 6);
            ctx.y = drawText(ctx, `${k + 1}. ${it}`, { size: 11, x: MARGIN + 6, maxWidth: CONTENT_W - 8 });
          });
        } else {
          items.forEach((it) => {
            ensureSpace(ctx, 6);
            ctx.y = drawText(ctx, `•  ${it}`, { size: 11, x: MARGIN + 6, maxWidth: CONTENT_W - 8 });
          });
        }
        break;
      }
      case "table": {
        ensureSpace(ctx, 12);
        const head = [b.headers.map((h) => resolveText(h, variables))];
        const body = b.rows.map((row) => row.map((cell) => resolveText(cell, variables)));
        autoTable(doc, {
          startY: ctx.y,
          head,
          body,
          theme: "grid",
          styles: { fontSize: 10, cellPadding: 2, textColor: [31, 41, 55], lineColor: [209, 213, 219], lineWidth: 0.1 },
          headStyles: { fillColor: DARB_ACCENT, textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: MARGIN, right: MARGIN },
          didDrawPage: () => {
            ctx.page = doc.getNumberOfPages();
            ctx.y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? ctx.y + 10;
            if (ctx.hasCover) drawHeaderFooter(ctx);
          },
        });
        const lat = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
        ctx.y = (lat?.finalY ?? ctx.y) + 6;
        ctx.page = doc.getNumberOfPages();
        break;
      }
      case "callout": {
        ensureSpace(ctx, 16);
        const toneColor: Record<string, [number, number, number]> = {
          info: [59, 130, 246],
          warning: [217, 119, 6],
          legal: [234, 88, 12],
        };
        const c = toneColor[b.tone] ?? toneColor.info;
        const fill: [number, number, number] = [c[0], c[1], c[2]];
        // light fill
        doc.setFillColor(Math.min(255, fill[0] + 200), Math.min(255, fill[1] + 200), Math.min(255, fill[2] + 200));
        doc.setDrawColor(...c);
        doc.setLineWidth(0.5);
        const boxH = 12 + (b.title ? 6 : 0) + Math.ceil((doc.splitTextToSize(resolveText(b.text, variables), CONTENT_W - 12) as string[]).length * 5);
        const boxY = ctx.y;
        doc.roundedRect(MARGIN, boxY, CONTENT_W, boxH, 2, 2, "FD");
        doc.setFillColor(...c);
        doc.rect(MARGIN, boxY, 1.5, boxH, "F");
        ctx.y = boxY + 6;
        if (b.title) {
          ctx.y = drawText(ctx, (b.tone === "legal" ? "⚖ " : "") + b.title, { size: 11, style: "bold", color: c, x: MARGIN + 4, maxWidth: CONTENT_W - 8 });
        }
        ctx.y = drawText(ctx, resolveText(b.text, variables), { size: 10, x: MARGIN + 4, maxWidth: CONTENT_W - 8 });
        ctx.y = boxY + boxH + 4;
        break;
      }
      case "flow": {
        ensureSpace(ctx, 10);
        if (b.title) ctx.y = drawText(ctx, resolveText(b.title, variables), { size: 12, style: "bold" });
        b.steps.filter(Boolean).forEach((step, k) => {
          const text = resolveText(step, variables);
          ensureSpace(ctx, 10);
          const boxH = 8 + Math.ceil((doc.splitTextToSize(text, CONTENT_W - 18) as string[]).length * 5);
          const boxY = ctx.y;
          doc.setFillColor(...DARB_ACCENT);
          doc.circle(MARGIN + 4, boxY + 4, 3, "F");
          doc.setTextColor(255, 255, 255);
          setFont(ctx, String(k + 1), "bold", 9);
          doc.text(String(k + 1), MARGIN + 4, boxY + 5.5, { align: "center" });
          doc.setDrawColor(209, 213, 219);
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(MARGIN + 10, boxY, CONTENT_W - 10, boxH, 1.5, 1.5, "FD");
          ctx.y = boxY + 5;
          ctx.y = drawText(ctx, text, { size: 10, x: MARGIN + 14, maxWidth: CONTENT_W - 18 });
          ctx.y = boxY + boxH + 2;
        });
        break;
      }
      case "signature": {
        ensureSpace(ctx, 24);
        const parties = b.parties.map((p) => resolveText(p, variables));
        const colW = CONTENT_W / Math.max(parties.length, 1);
        const startY = ctx.y + 20;
        parties.forEach((p, k) => {
          const x = MARGIN + k * colW;
          drawText(ctx, p, { size: 11, style: "bold", x: x + 2, maxWidth: colW - 4, y: ctx.y });
          doc.setDrawColor(100, 116, 139);
          doc.setLineWidth(0.3);
          doc.line(x + 2, startY, x + colW - 4, startY);
          ctx.y = startY + 4;
          drawText(ctx, rtlLang ? "التوقيع" : "Signature", { size: 8, x: x + 2, color: [107, 114, 128] });
          drawText(ctx, rtlLang ? "التاريخ" : "Date", { size: 8, x: x + colW - 30, color: [107, 114, 128] });
          doc.line(x + colW - 28, startY + 4, x + colW - 4, startY + 4);
        });
        ctx.y = startY + 12;
        break;
      }
      case "disclaimer": {
        ensureSpace(ctx, 8);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, ctx.y, MARGIN + CONTENT_W, ctx.y);
        ctx.y += 3;
        ctx.y = drawText(ctx, resolveText(b.text, variables), { size: 8, color: [107, 114, 128] });
        doc.line(MARGIN, ctx.y + 1, MARGIN + CONTENT_W, ctx.y + 1);
        ctx.y += 4;
        break;
      }
      case "pagebreak": {
        doc.addPage();
        ctx.page += 1;
        ctx.y = MARGIN;
        if (ctx.hasCover) drawHeaderFooter(ctx);
        break;
      }
      default:
        break;
    }
  }

  if (!ctx.hasCover && blocks.length > 0) drawHeaderFooter(ctx);
  return doc;
}

/** Download the generated PDF (browser save-as). */
export async function downloadDocumentPdf(
  document: Pick<DocumentRecord, "title" | "slug" | "language">,
  version: Pick<DocumentVersionRecord, "version" | "content">,
  variables: VariableMap,
): Promise<jsPDF> {
  const doc = await generateDocumentPdf(document, version, variables);
  doc.save(`DARB-${document.slug}-v${version.version}.pdf`);
  return doc;
}

export { formatIls, hasRtl };
