import { exportCorporatePdf } from "@/utils/export/pdfReport";
import fs from "node:fs";
const out = "/tmp/exqa/out2"; fs.mkdirSync(out, { recursive: true });
const AR = "مرحبا بكم في شركة درب للدراسة الدولية — قسم المدفوعات والعمولات لعام ٢٠٢٦";
const cols = [
  { header: "المرجع", type: "text" as const },
  { header: "الاسم", type: "text" as const },
  { header: "الدور", type: "text" as const },
  { header: "المبلغ", type: "currency" as const, currency: "ILS" as const, total: "sum" as const },
  { header: "التكلفة", type: "currency" as const, currency: "EUR" as const, total: "sum" as const },
  { header: "النسبة", type: "percent" as const },
  { header: "التاريخ", type: "date" as const },
  { header: "الحالة", type: "status" as const },
  { header: "ملاحظات", type: "text" as const },
];
const rows: unknown[][] = [
  ["C-001", "أحمد محمد عبد الرحمن", "شريك", 1000, 5400.5, 42.5, "2026-08-01", "pending", AR],
  ["C-002", "John Smith", "Team", 12500, null, 0, "2026-08-02", "paid", "Mixed نص and English 12345"],
  ["C-003", "דנה כהן", "Ambassador", -250, 0, 100, "", "rejected", ""],
];
const many = Array.from({length: 90}, (_,i)=> rows[i%3].map((c,j)=> j===0?`C-${i}`:c));
const base = { author: "Admin User", totalLabel: "الإجمالي" };
await exportCorporatePdf({ fileName: `${out}/ar`, title: "تقرير درب الشامل", subtitle: "كل السجلات", locale: "ar", rtl: true, ...base,
  sheets: [{ name: "المدفوعات", title: "المدفوعات", subtitle: "الدفعات المؤكدة", columns: cols, rows: many },
           { name: "العمولات", title: "العمولات", columns: cols.slice(0,5), rows }] });
await exportCorporatePdf({ fileName: `${out}/en`, title: "DARB Full Report", subtitle: "All records", locale: "en-US", rtl: false, author: "Admin", totalLabel: "Total",
  sheets: [{ name: "Students", title: "Students", columns: cols.map((c,i)=>({...c, header: ["Reference","Name","Role","Fee","Cost","Rate","Date","Status","Notes"][i]})), rows }] });
const emptyRes = await exportCorporatePdf({ fileName: `${out}/none`, title: "Nothing", locale: "en-US", sheets: [{ name:"x", columns: cols, rows: [] }] });
console.log("empty:", JSON.stringify(emptyRes), fs.readdirSync(out));
