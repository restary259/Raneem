import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { fontForText, hasRtl, registerPdfFonts, shapeForPdf } from "@/utils/pdfFonts";
import {
  createInvoicePresentation,
  formatInvoiceMoney,
  invoicePdfFileName,
  type InvoicePresentationMeta,
} from "@/utils/invoicePresentation";
import type { DarbInvoiceTotals } from "@/utils/invoiceTotals";

export type { DarbInvoiceTotals } from "@/utils/invoiceTotals";

const NAVY: [number, number, number] = [15, 27, 45];
const GOLD: [number, number, number] = [249, 177, 21];
const TEXT: [number, number, number] = [26, 34, 48];
const MUTED: [number, number, number] = [91, 100, 114];
const BORDER: [number, number, number] = [228, 231, 236];
const SURFACE: [number, number, number] = [247, 248, 250];
const SUCCESS: [number, number, number] = [18, 114, 79];

const imageData = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) return null;
  const blob = await response.blob();
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
};

/** Branded A4 representation of the DARB agency-service invoice. */
export async function downloadInvoicePdf(
  meta: InvoicePresentationMeta,
  totals: DarbInvoiceTotals,
  isArabic: boolean,
) {
  const view = createInvoicePresentation(meta, totals, isArabic);
  const { labels: L, totals: t } = view;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fonts = await registerPdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const align = isArabic ? "right" : "left";
  const edge = isArabic ? pageWidth - margin : margin;
  const draw = (value: unknown) => shapeForPdf(String(value ?? ""));
  const setText = (value: unknown, size = 10, bold = false, color = TEXT) => {
    const text = String(value ?? "");
    doc.setFont(fontForText(text, fonts), bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    return draw(text);
  };

  const logo = await imageData(darbLogoAsset.url);
  if (logo) doc.addImage(logo, "PNG", pageWidth / 2 - 17, 11, 34, 15, undefined, "FAST");
  doc.text(setText(L.brandLine, 8, false, MUTED), pageWidth / 2, 31, { align: "center" });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.9);
  doc.line(margin, 35, pageWidth - margin, 35);

  doc.text(setText(L.title, 18, true, NAVY), edge, 47, { align });
  doc.text(setText(meta.invoiceNumber, 9, true, MUTED), isArabic ? margin : pageWidth - margin, 47, {
    align: isArabic ? "left" : "right",
  });

  doc.setFillColor(...SURFACE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(margin, 54, contentWidth, 30, 2, 2, "FD");
  const metaRows = [
    [L.invoiceNumber, meta.invoiceNumber],
    [L.issuedAt, new Date(meta.issuedAt).toLocaleDateString("en-US")],
    [L.caseReference, meta.caseReference ?? "—"],
    [L.student, meta.studentName ?? "—"],
  ];
  metaRows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + 7 + col * (contentWidth / 2);
    const y = 63 + row * 12;
    const textAlign = isArabic ? "right" : "left";
    const textX = isArabic ? x + contentWidth / 2 - 14 : x;
    doc.text(setText(label, 7, false, MUTED), textX, y, { align: textAlign });
    doc.text(setText(value, 9, true, TEXT), textX, y + 4.5, { align: textAlign });
  });

  doc.text(setText(L.services, 10, true, NAVY), edge, 94, { align });
  const body = t.services.map((service) => [
    service.description,
    service.quantity > 1
      ? `${service.quantity} × ${formatInvoiceMoney(service.unit_price, service.currency)}`
      : "—",
    formatInvoiceMoney(service.line_total, service.currency),
  ]);

  autoTable(doc, {
    head: [[L.service, L.details, L.amount]],
    body,
    startY: 98,
    margin: { left: margin, right: margin, bottom: 35 },
    tableWidth: contentWidth,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4, textColor: TEXT, lineColor: BORDER, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: SURFACE, textColor: MUTED, fontStyle: "bold", lineColor: BORDER, lineWidth: 0.2 },
    columnStyles: isArabic
      ? { 0: { cellWidth: 84, halign: "right" }, 1: { cellWidth: 55, halign: "right" }, 2: { halign: "left" } }
      : { 0: { cellWidth: 84 }, 1: { cellWidth: 55 }, 2: { halign: "right" } },
    didParseCell: ({ cell }) => {
      const text = cell.text.join(" ");
      cell.styles.font = fontForText(text, fonts);
      cell.text = cell.text.map(draw);
      if (hasRtl(text)) cell.styles.halign = "right";
    },
    didDrawPage: () => {
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.45);
      doc.line(margin, 282, pageWidth - margin, 282);
      doc.text(setText("darb.agency", 7, false, MUTED), margin, 288);
      doc.text(setText(`${doc.getCurrentPageInfo().pageNumber}`, 7, false, MUTED), pageWidth - margin, 288, { align: "right" });
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 108;
  let y = finalY + 7;
  const rows: Array<{ label: string; value: string; bold?: boolean; success?: boolean }> = [
    { label: L.subtotal, value: formatInvoiceMoney(t.subtotal) },
  ];
  if (t.discount_total > 0) rows.push({ label: L.discount, value: `−${formatInvoiceMoney(t.discount_total)}`, success: true });
  if (t.referral_discount > 0) rows.push({ label: L.referralDiscount, value: `−${formatInvoiceMoney(t.referral_discount)}`, success: true });
  rows.push({ label: L.total, value: formatInvoiceMoney(t.service_total), bold: true });
  if (t.total_confirmed > 0) rows.push({ label: L.paid, value: formatInvoiceMoney(t.total_confirmed), success: true });
  if (t.total_confirmed > 0 && t.remaining > 0) rows.push({ label: L.remaining, value: formatInvoiceMoney(t.remaining), bold: true });

  const summaryHeight = rows.length * 7 + (view.fullyPaid ? 15 : 0) + 30;
  if (y + summaryHeight > 270) {
    doc.addPage();
    y = 20;
  }
  const labelX = isArabic ? pageWidth - margin - 4 : margin + 4;
  const valueX = isArabic ? margin + 4 : pageWidth - margin - 4;
  rows.forEach((row) => {
    doc.text(setText(row.label, 9, Boolean(row.bold), row.success ? SUCCESS : TEXT), labelX, y, { align });
    doc.text(setText(row.value, 9, Boolean(row.bold), row.success ? SUCCESS : TEXT), valueX, y, {
      align: isArabic ? "left" : "right",
    });
    y += 7;
  });

  if (view.fullyPaid) {
    doc.setFillColor(233, 246, 240);
    doc.roundedRect(margin, y, contentWidth, 11, 2, 2, "F");
    doc.text(setText(`✓ ${L.fullyPaid}`, 9, true, SUCCESS), edge - (isArabic ? 4 : -4), y + 7, { align });
    y += 17;
  }

  doc.setDrawColor(...BORDER);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "S");
  doc.setLineDashPattern([], 0);
  const noteLines = doc.splitTextToSize(draw(L.separationNote), contentWidth - 10);
  doc.text(setText("", 8, false, MUTED) || noteLines, isArabic ? pageWidth - margin - 5 : margin + 5, y + 6, {
    align,
    maxWidth: contentWidth - 10,
  });
  doc.text(noteLines, isArabic ? pageWidth - margin - 5 : margin + 5, y + 6, { align, maxWidth: contentWidth - 10 });
  y += 23;
  doc.text(setText(L.support, 8, false, MUTED), edge, y, { align });

  doc.save(invoicePdfFileName(meta.invoiceNumber));
  return { rtlFontMissing: isArabic && !fonts.arabic };
}