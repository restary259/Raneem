import { exportPDF } from "@/utils/exportUtils";
import { buildCorporateWorkbook } from "@/utils/export/corporateSheet";
import fs from "node:fs";

// capture jsPDF save
const outdir = "/tmp/exqa/out";
fs.mkdirSync(outdir, { recursive: true });

const AR_LONG = "مرحبا بكم في شركة درب للدراسة الدولية — قسم المدفوعات والعمولات لعام ٢٠٢٦";
const rows = [
  ["a1b2c3d4", "أحمد محمد عبد الرحمن", "شريك", "طالب واحد; طالب اثنان", "1,000 ₪", "معلق", "2026-08-01", "—", "تحويل بنكي", AR_LONG],
  ["e5f6g7h8", "John Smith", "Team", "Very Long Student Name Number One; Another Student", "12,500 ₪", "Paid", "2026-08-02", "2026-08-05", "Bank transfer", "Mixed نص عربي and English 12345 ₪"],
  ["11112222", "دانا כהן", "Ambassador", "", "0 ₪", "rejected", "2026-08-03", "—", "cash", ""],
];
const headers = ["ID", "الاسم", "الدور", "الطلاب", "المبلغ", "الحالة", "التاريخ", "تاريخ الموافقة", "طريقة الدفع", "ملاحظات"];

const big = Array.from({ length: 120 }, (_, i) => rows[i % 3].map((c, j) => (j === 0 ? `row${i}` : c)));

await exportPDF({ headers, rows, fileName: `${outdir}/ar-small`, title: "تقرير المدفوعات — درب", locale: "ar", rtl: true });
await exportPDF({ headers, rows: big, fileName: `${outdir}/ar-big`, title: "تقرير المدفوعات — درب", locale: "ar", rtl: true });
await exportPDF({ headers: ["ID","Name","Role","Amount","Status"], rows: [["1","John Smith","Team","1,000 ₪","Paid"]], fileName: `${outdir}/en-one`, title: "Payouts Report", locale: "en-US", rtl: false });
await exportPDF({ headers: ["ID","Name"], rows: [], fileName: `${outdir}/empty`, title: "Empty Report", locale: "en-US", rtl: false });

const wb = await buildCorporateWorkbook({
  fileName: "x", title: "تقرير درب", subtitle: "الملخص", author: "Admin", rtl: true, locale: "ar",
  sheets: [{ name: "المدفوعات", title: "المدفوعات", columns: [
    { header: "الاسم", type: "text" }, { header: "المبلغ", type: "currency", currency: "ILS", total: "sum" },
    { header: "التاريخ", type: "date" }, { header: "الحالة", type: "status" },
  ], rows: [["أحمد محمد", 1000, "2026-08-01", "pending"], ["John Smith", 12500, "2026-08-02", "paid"], ["دانا", null, null, ""]] }],
});
await wb.xlsx.writeFile(`${outdir}/report-ar.xlsx`);
console.log("done", fs.readdirSync(outdir));
