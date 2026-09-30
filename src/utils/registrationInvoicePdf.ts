import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { fontForText, registerPdfFonts, shapeForPdf } from "@/utils/pdfFonts";

interface RegistrationInvoiceMeta {
  invoiceNumber: string;
  caseReference: string | null;
  studentName: string | null;
  referrerName: string | null;
  referralType: string | null;
  issuedAt: string;
  dueAt: string | null;
  currency: string;
  items: Array<Record<string, any>>;
  subtotal: number;
  totalAmount: number;
  bankDetails?: Record<string, string>;
}

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

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0)) + " " + currency;

export async function downloadRegistrationInvoicePdf(meta: RegistrationInvoiceMeta, isArabic: boolean) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fonts = await registerPdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const align = isArabic ? "right" : "left";
  const edge = isArabic ? pageWidth - margin : margin;
  const draw = (value: unknown) => shapeForPdf(String(value ?? ""));
  const setText = (value: unknown, size = 10, bold = false, rgb: [number, number, number] = [26,34,48]) => {
    const text = String(value ?? "");
    doc.setFont(fontForText(text, fonts), bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...rgb);
    return draw(text);
  };

  const logo = await imageData(darbLogoAsset.url);
  if (logo) doc.addImage(logo, "PNG", pageWidth / 2 - 17, 11, 34, 15, undefined, "FAST");

  doc.text(setText(isArabic ? "فاتورة تسجيل درب" : "DARB Registration Invoice", 18, true, [15,27,45]), edge, 43, { align });
  doc.text(setText(meta.invoiceNumber, 9, true, [91,100,114]), isArabic ? margin : pageWidth - margin, 43, { align: isArabic ? "left" : "right" });

  doc.setDrawColor(249,177,21);
  doc.setLineWidth(0.9);
  doc.line(margin, 48, pageWidth - margin, 48);

  doc.setFillColor(247,248,250);
  doc.setDrawColor(228,231,236);
  doc.roundedRect(margin, 56, contentWidth, 42, 2, 2, "FD");

  const rows = [
    [isArabic ? "رقم التسجيل" : "Registration reference", meta.caseReference ?? "—"],
    [isArabic ? "الطالب" : "Student", meta.studentName ?? "—"],
    [isArabic ? "أحال الطالب" : "Referred by", meta.referrerName ?? "—"],
    [isArabic ? "نوع الإحالة" : "Referral type", meta.referralType === "family" ? (isArabic ? "فرد من العائلة" : "Family member") : (isArabic ? "صديق" : "Friend")],
    [isArabic ? "الإصدار" : "Issued", new Date(meta.issuedAt).toLocaleDateString("en-US")],
    [isArabic ? "الاستحقاق" : "Due", meta.dueAt ? new Date(meta.dueAt).toLocaleDateString("en-US") : "—"],
  ];

  rows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + 7 + col * (contentWidth / 2);
    const y = 65 + row * 12;
    const textAlign = isArabic ? "right" : "left";
    const textX = isArabic ? x + contentWidth / 2 - 14 : x;
    doc.text(setText(label, 7, false, [91,100,114]), textX, y, { align: textAlign });
    doc.text(setText(value, 9, true), textX, y + 4.5, { align: textAlign });
  });

  doc.text(setText(isArabic ? "تفاصيل التسجيل" : "Registration details", 10, true, [15,27,45]), edge, 108, { align });
  const body = meta.items.map((item) => {
    const name = isArabic ? (item.name_ar || item.name_en || "—") : (item.name_en || item.name_ar || "—");
    let details = "";
    if (item.weeks) details = item.weeks + (item.weekly_price != null ? " × " + money(Number(item.weekly_price), meta.currency) + "/week" : " weeks");
    if (item.months) details = item.months + (item.monthly_price != null ? " × " + money(Number(item.monthly_price), meta.currency) + "/month" : " months");
    return [name, details, money(Number(item.total), meta.currency)];
  });

  autoTable(doc, {
    head: [[isArabic ? "البند" : "Item", isArabic ? "التفاصيل" : "Details", isArabic ? "المبلغ" : "Amount"]],
    body,
    startY: 112,
    margin: { left: margin, right: margin, bottom: 32 },
    tableWidth: contentWidth,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4, textColor: [26,34,48], lineColor: [228,231,236], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: [247,248,250], textColor: [91,100,114], fontStyle: "bold" },
    columnStyles: isArabic
      ? { 0: { cellWidth: 77, halign: "right" }, 1: { cellWidth: 55, halign: "right" }, 2: { halign: "left" } }
      : { 0: { cellWidth: 77 }, 1: { cellWidth: 55 }, 2: { halign: "right" } },
    didParseCell: ({ cell }) => {
      const text = cell.text.join(" ");
      cell.styles.font = fontForText(text, fonts);
      cell.text = cell.text.map(draw);
    },
  });

  let y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 124) + 10;
  const labelX = isArabic ? pageWidth - margin - 4 : margin + 4;
  const valueX = isArabic ? margin + 4 : pageWidth - margin - 4;

  for (const [label, value, bold] of [
    [isArabic ? "المجموع الفرعي" : "Subtotal", money(meta.subtotal, meta.currency), false],
    [isArabic ? "الإجمالي المطلوب" : "Total due", money(meta.totalAmount, meta.currency), true],
  ] as Array<[string,string,boolean]>) {
    doc.text(setText(label, bold ? 10 : 9, bold), labelX, y, { align });
    doc.text(setText(value, bold ? 10 : 9, bold), valueX, y, { align: isArabic ? "left" : "right" });
    y += 8;
  }

  if (meta.caseReference) {
    y += 3;
    const text = isArabic
      ? "عند التحويل البنكي، اكتب رقم التسجيل التالي في خانة الملاحظات: " + meta.caseReference
      : "For a bank transfer, use this registration reference in the payment memo: " + meta.caseReference;
    const lines = doc.splitTextToSize(setText(text, 8, false, [91,100,114]), contentWidth - 10);
    doc.setDrawColor(228,231,236);
    doc.roundedRect(margin, y, contentWidth, Math.max(16, lines.length * 4.5 + 8), 2, 2, "S");
    doc.text(lines, isArabic ? pageWidth - margin - 5 : margin + 5, y + 6, { align });
    y += Math.max(16, lines.length * 4.5 + 8) + 7;
  }

  if (meta.bankDetails?.iban) {
    doc.text(setText(isArabic ? "الدفع بالتحويل البنكي" : "Bank transfer", 10, true, [15,27,45]), edge, y, { align });
    y += 7;
    const bankRows = [
      [isArabic ? "البنك" : "Bank", meta.bankDetails.bank_name || "—"],
      [isArabic ? "صاحب الحساب" : "Account holder", meta.bankDetails.account_holder || "—"],
      ["IBAN", meta.bankDetails.iban],
      ["BIC", meta.bankDetails.bic || "—"],
    ];
    bankRows.forEach(([label, value]) => {
      doc.text(setText(label, 8, false, [91,100,114]), edge, y, { align });
      doc.text(setText(value, 8, true), valueX, y, { align: isArabic ? "left" : "right" });
      y += 6;
    });
  }

  doc.setDrawColor(249,177,21);
  doc.setLineWidth(0.45);
  doc.line(margin, 282, pageWidth - margin, 282);
  doc.text(setText("darb.agency", 7, false, [91,100,114]), margin, 288);
  doc.text(setText(isArabic ? "الدفع والتسجيل" : "Registration & payment", 7, false, [91,100,114]), pageWidth - margin, 288, { align: "right" });

  doc.save("DARB-" + meta.invoiceNumber + ".pdf");
}
