import * as React from "npm:react@18.3.1";
import { EmailButton, EmailFallbackLink, EmailLayout, EmailText, Section, Text } from "../email-ui/components.tsx";
import { color, font, radius } from "../email-ui/theme.ts";
import type { TemplateEntry } from "./registry.ts";

type Item = {
  kind?: string;
  name_en?: string;
  name_ar?: string;
  room_type?: string | null;
  weeks?: number | null;
  months?: number | null;
  weekly_price?: number | null;
  monthly_price?: number | null;
  total?: number | null;
  currency?: string | null;
};

type BankDetails = {
  bank_name?: string;
  account_holder?: string;
  iban?: string;
  bic?: string;
};

interface Props {
  locale?: "en" | "ar" | "he";
  studentName?: string;
  caseReference?: string;
  invoiceNumber?: string;
  issuedAt?: string;
  dueAt?: string;
  referrerName?: string;
  referralType?: string | null;
  currency?: string;
  subtotal?: number;
  total?: number;
  items?: Item[];
  invoiceUrl?: string | null;
  paymentStatus?: string;
  bankDetails?: BankDetails;
}

const labels = {
  en: {
    title: "DARB registration invoice",
    hello: "Hello",
    intro: "Your DARB registration has been received. Review your selected study and accommodation options below.",
    invoice: "Invoice",
    case: "Registration reference",
    issued: "Issued",
    due: "Due",
    student: "Student",
    referredBy: "Referred by",
    referralType: "Referral type",
    friend: "Friend",
    family: "Family member",
    selection: "Registration details",
    item: "Item",
    amount: "Amount",
    total: "Total due",
    payment: "Payment",
    bank: "Bank transfer",
    bankName: "Bank",
    holder: "Account holder",
    iban: "IBAN",
    bic: "BIC",
    memo: "Use this registration reference as the bank-transfer memo:",
    card: "Pay by card",
    view: "View invoice",
    help: "Need help? Contact DARB and mention your registration reference.",
  },
  ar: {
    title: "فاتورة تسجيل درب",
    hello: "مرحباً",
    intro: "تم استلام تسجيلك مع درب. راجع خيارات الدراسة والسكن التي اخترتها أدناه.",
    invoice: "الفاتورة",
    case: "رقم التسجيل",
    issued: "تاريخ الإصدار",
    due: "تاريخ الاستحقاق",
    student: "الطالب",
    referredBy: "أحالك",
    referralType: "نوع الإحالة",
    friend: "صديق",
    family: "فرد من العائلة",
    selection: "تفاصيل التسجيل",
    item: "البند",
    amount: "المبلغ",
    total: "الإجمالي المطلوب",
    payment: "الدفع",
    bank: "تحويل بنكي",
    bankName: "البنك",
    holder: "اسم صاحب الحساب",
    iban: "IBAN",
    bic: "BIC",
    memo: "استخدم رقم التسجيل التالي في خانة الملاحظات عند التحويل:",
    card: "الدفع بالبطاقة",
    view: "عرض الفاتورة",
    help: "بحاجة للمساعدة؟ تواصل مع درب واذكر رقم التسجيل.",
  },
  he: {
    title: "חשבונית רישום DARB",
    hello: "שלום",
    intro: "הרישום שלך ל-DARB התקבל. למטה מופיעים פרטי הלימודים והמגורים שבחרת.",
    invoice: "חשבונית",
    case: "מספר רישום",
    issued: "הונפקה",
    due: "לתשלום עד",
    student: "סטודנט",
    referredBy: "הופנית על ידי",
    referralType: "סוג הפניה",
    friend: "חבר",
    family: "בן משפחה",
    selection: "פרטי הרישום",
    item: "פריט",
    amount: "סכום",
    total: "סה״כ לתשלום",
    payment: "תשלום",
    bank: "העברה בנקאית",
    bankName: "בנק",
    holder: "בעל החשבון",
    iban: "IBAN",
    bic: "BIC",
    memo: "יש לציין את מספר הרישום הבא בהערות ההעברה:",
    card: "תשלום בכרטיס",
    view: "צפייה בחשבונית",
    help: "צריכים עזרה? פנו ל-DARB וציינו את מספר הרישום.",
  },
} as const;

const money = (value: number | null | undefined, currency = "EUR") =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0)) + " " + currency;

const pickName = (item: Item, locale: keyof typeof labels) =>
  locale === "ar" ? item.name_ar || item.name_en || "—" : item.name_en || item.name_ar || "—";

const MetaRow = ({ label, value, dir = "ltr" }: { label: string; value?: React.ReactNode; dir?: "ltr" | "rtl" }) => (
  <tr>
    <td style={{ ...metaLabel, textAlign: "right" }} dir="rtl">{label}</td>
    <td style={{ ...metaValue, textAlign: dir === "rtl" ? "right" : "left" }} dir={dir}>{value || "—"}</td>
  </tr>
);

function RegistrationInvoiceEmail(props: Props) {
  const locale = props.locale && labels[props.locale] ? props.locale : "en";
  const L = labels[locale];
  const dir = locale === "en" ? "ltr" : "rtl";
  const items = Array.isArray(props.items) ? props.items : [];
  const currency = props.currency || "EUR";
  const hasBank = Boolean(props.bankDetails?.iban || props.bankDetails?.bank_name);

  return (
    <EmailLayout
      preview={L.title + (props.invoiceNumber ? " " + props.invoiceNumber : "")}
      title={L.title}
    >
      <EmailText>{props.studentName ? L.hello + " " + props.studentName + "," : L.hello + ","}</EmailText>
      <EmailText>{L.intro}</EmailText>

      <Section style={box} dir={dir}>
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" dir={dir}>
          <tbody>
            <MetaRow label={L.invoice} value={props.invoiceNumber} />
            <MetaRow label={L.case} value={props.caseReference} />
            <MetaRow label={L.issued} value={props.issuedAt ? new Date(props.issuedAt).toLocaleDateString("en-US") : undefined} />
            <MetaRow label={L.due} value={props.dueAt ? new Date(props.dueAt).toLocaleDateString("en-US") : undefined} />
            <MetaRow label={L.student} value={props.studentName} dir={dir as "ltr" | "rtl"} />
            {props.referrerName ? <MetaRow label={L.referredBy} value={props.referrerName} dir={dir as "ltr" | "rtl"} /> : null}
            {props.referralType ? (
              <MetaRow label={L.referralType} value={props.referralType === "family" ? L.family : L.friend} dir={dir as "ltr" | "rtl"} />
            ) : null}
          </tbody>
        </table>
      </Section>

      <Text style={sectionTitle} dir={dir}>{L.selection}</Text>
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={table} dir={dir}>
        <thead>
          <tr>
            <th style={{ ...headCell, textAlign: "right" }} dir={dir}>{L.item}</th>
            <th style={{ ...headCell, textAlign: "left" }} dir="ltr">{L.amount}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ ...cell, textAlign: "right" }} dir={dir}>
                <div style={{ fontWeight: 600 }}>{pickName(item, locale)}</div>
                <div style={subLabel}>
                  {item.weeks ? item.weeks + " " + (item.weeks === 1 ? "week" : "weeks") + (item.weekly_price != null ? " · " + money(item.weekly_price, currency) + "/week" : "") : ""}
                  {item.months ? item.months + " " + (item.months === 1 ? "month" : "months") + (item.monthly_price != null ? " · " + money(item.monthly_price, currency) + "/month" : "") : ""}
                </div>
              </td>
              <td style={{ ...cell, textAlign: "left", whiteSpace: "nowrap" }} dir="ltr">{money(item.total, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...cell, fontWeight: 700, textAlign: "right" }} dir={dir}>{L.total}</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: "left", whiteSpace: "nowrap" }} dir="ltr">{money(props.total, currency)}</td>
          </tr>
        </tfoot>
      </table>

      {props.caseReference ? (
        <Text style={note} dir={dir}>
          <strong>{L.memo}</strong><br />
          <span style={{ direction: "ltr", unicodeBidi: "embed", fontFamily: font.family }}>{props.caseReference}</span>
        </Text>
      ) : null}

      {hasBank ? (
        <>
          <Text style={sectionTitle} dir={dir}>{L.payment} — {L.bank}</Text>
          <Section style={box} dir={dir}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" dir={dir}>
              <tbody>
                {props.bankDetails?.bank_name ? <MetaRow label={L.bankName} value={props.bankDetails.bank_name} dir={dir as "ltr" | "rtl"} /> : null}
                {props.bankDetails?.account_holder ? <MetaRow label={L.holder} value={props.bankDetails.account_holder} dir={dir as "ltr" | "rtl"} /> : null}
                {props.bankDetails?.iban ? <MetaRow label={L.iban} value={props.bankDetails.iban} /> : null}
                {props.bankDetails?.bic ? <MetaRow label={L.bic} value={props.bankDetails.bic} /> : null}
              </tbody>
            </table>
          </Section>
        </>
      ) : null}

      {props.invoiceUrl ? <EmailButton href={props.invoiceUrl}>{L.view}</EmailButton> : null}
      {props.invoiceUrl ? <EmailFallbackLink href={props.invoiceUrl} /> : null}
      <EmailText muted>{L.help}</EmailText>
    </EmailLayout>
  );
}

export const template = {
  component: RegistrationInvoiceEmail,
  subject: (data: Record<string, unknown>) => "DARB registration invoice " + String(data?.invoiceNumber ?? ""),
  displayName: "Student registration invoice",
  previewData: {
    locale: "en",
    studentName: "Ahmad Haddad",
    caseReference: "DRB-2026-000142",
    invoiceNumber: "DRB-REG-2026-000001",
    issuedAt: "2026-10-01T12:00:00Z",
    dueAt: "2026-10-08T12:00:00Z",
    referrerName: "Raneem",
    referralType: "friend",
    currency: "EUR",
    subtotal: 6300,
    total: 6300,
    items: [
      { kind: "course", name_en: "German Intensive", name_ar: "ألماني مكثف", weeks: 42, weekly_price: 150, total: 6300, currency: "EUR" },
    ],
    invoiceUrl: "https://darb.agency/invoice/sample-registration-token",
    paymentStatus: "pending",
    bankDetails: {
      bank_name: "DARB Bank",
      account_holder: "Darb Study International",
      iban: "DE00 0000 0000 0000 0000 00",
      bic: "XXXXDEXX",
    },
  },
} satisfies TemplateEntry;

const box = {
  backgroundColor: color.surface,
  border: "1px solid " + color.border,
  borderRadius: radius.card,
  padding: "12px 14px",
  margin: "4px 0 16px",
};

const metaLabel = {
  fontSize: font.size.small,
  color: color.textMuted,
  padding: "5px 0 5px 14px",
  width: "40%",
  borderBottom: "1px solid " + color.border,
  fontFamily: font.family,
};

const metaValue = {
  fontSize: font.size.small,
  color: color.text,
  fontWeight: 600,
  padding: "5px 0",
  borderBottom: "1px solid " + color.border,
  fontFamily: font.family,
};

const sectionTitle = {
  fontSize: font.size.small,
  fontWeight: 700,
  color: color.navy,
  margin: "18px 0 6px",
  fontFamily: font.family,
};

const table = {
  borderCollapse: "collapse" as const,
  border: "1px solid " + color.border,
  width: "100%",
};

const headCell = {
  fontSize: font.size.label,
  color: color.textMuted,
  padding: "8px 12px",
  backgroundColor: color.surface,
  borderBottom: "1px solid " + color.border,
  fontFamily: font.family,
};

const cell = {
  fontSize: font.size.body,
  color: color.text,
  padding: "9px 12px",
  borderBottom: "1px solid " + color.border,
  fontFamily: font.family,
};

const subLabel = {
  fontSize: font.size.tiny,
  color: color.textMuted,
  marginTop: "2px",
};

const note = {
  fontSize: font.size.tiny,
  color: color.textMuted,
  lineHeight: "1.7",
  margin: "8px 0 12px",
};
