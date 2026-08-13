import * as React from 'npm:react@18.3.1'
import { Hr, Section, Text } from 'npm:@react-email/components@0.0.22'
import {
  EmailButton,
  EmailFallbackLink,
  EmailLayout,
  EmailText,
} from '../email-ui/components.tsx'
import { color, font, radius } from '../email-ui/theme.ts'
import type { TemplateEntry } from './registry.ts'

/**
 * Branded DARB agency-service invoice.
 *
 * Every number arrives pre-formatted from `buildInvoiceEmailData`
 * (src/services/CaseInvoiceService.ts), which derives them from the frozen
 * `case_invoices.totals` snapshot via `selectInvoiceTotals`. This template
 * performs no arithmetic — it must never become a second source of truth.
 *
 * Email-safe by construction: table layout, inline styles, no flex/grid.
 */

interface ServiceLine {
  description?: string
  quantity?: number
  unitPrice?: string
  amount?: string
}

interface SchoolLine {
  label?: string
  amount?: string
  currency?: string
}

interface Props {
  studentName?: string
  caseReference?: string
  invoiceNumber?: string
  issuedAt?: string
  services?: ServiceLine[]
  subtotal?: string
  discount?: string | null
  referralDiscount?: string | null
  serviceTotal?: string
  totalConfirmed?: string | null
  remaining?: string
  schoolCosts?: SchoolLine[]
  link?: string
}

const ils = (v?: string) => `₪${v ?? '0.00'}`

/** "1,650.00" → 1650. Used only to decide which balance rows to show. */
const num = (v?: string | null) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const Amount = ({ children, bold = false }: { children: React.ReactNode; bold?: boolean }) => (
  <span style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: bold ? 700 : 400 }}>
    {children}
  </span>
)

const LineRow = ({
  label,
  sub,
  value,
  bold = false,
  tone,
}: {
  label: React.ReactNode
  sub?: React.ReactNode
  value: React.ReactNode
  bold?: boolean
  tone?: string
}) => (
  <tr>
    <td style={{ ...cell, textAlign: 'right' }} dir="rtl">
      <span style={{ fontWeight: bold ? 700 : 400, color: tone ?? color.text }}>{label}</span>
      {sub ? <div style={subLabel}>{sub}</div> : null}
    </td>
    <td
      style={{ ...cell, textAlign: 'left', whiteSpace: 'nowrap', color: tone ?? color.text }}
      dir="ltr"
    >
      <Amount bold={bold}>{value}</Amount>
    </td>
  </tr>
)

const Email = ({
  studentName,
  caseReference,
  invoiceNumber,
  issuedAt,
  services = [],
  subtotal,
  discount,
  referralDiscount,
  serviceTotal,
  totalConfirmed,
  remaining,
  schoolCosts = [],
  link,
}: Props) => {
  const paid = num(totalConfirmed)
  const due = num(remaining)
  const fullyPaid = paid > 0 && due <= 0

  return (
    <EmailLayout
      preview={`فاتورة خدمات درب${invoiceNumber ? ` ${invoiceNumber}` : ''}`}
      title="فاتورة خدمات درب"
    >
      <EmailText>{studentName ? `عزيزي/عزيزتي ${studentName}،` : 'مرحباً،'}</EmailText>
      <EmailText>
        شكراً لاختيارك درب للدراسة في ألمانيا. هذه فاتورة خدمات درب الخاصة بملفك.
      </EmailText>

      {/* Invoice meta */}
      <Section style={metaBox} dir="rtl">
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" dir="rtl">
          <tbody>
            {invoiceNumber ? (
              <tr>
                <td style={metaLabel} dir="rtl">
                  رقم الفاتورة
                </td>
                <td style={metaValue} dir="ltr">
                  <Amount>{invoiceNumber}</Amount>
                </td>
              </tr>
            ) : null}
            {issuedAt ? (
              <tr>
                <td style={metaLabel} dir="rtl">
                  تاريخ الإصدار
                </td>
                <td style={metaValue} dir="ltr">
                  <Amount>{issuedAt}</Amount>
                </td>
              </tr>
            ) : null}
            {caseReference ? (
              <tr>
                <td style={metaLabel} dir="rtl">
                  رقم الملف
                </td>
                <td style={metaValue} dir="ltr">
                  <Amount>{caseReference}</Amount>
                </td>
              </tr>
            ) : null}
            {studentName ? (
              <tr>
                <td style={metaLabel} dir="rtl">
                  الطالب
                </td>
                <td style={{ ...metaValue, textAlign: 'right' as const }} dir="rtl">
                  {studentName}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Section>

      {/* Services */}
      <Text style={sectionTitle} dir="rtl">
        خدمات درب (شيكل)
      </Text>
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={lineTable}
        dir="rtl"
      >
        <thead>
          <tr>
            <th style={{ ...headCell, textAlign: 'right' }} dir="rtl">
              الخدمة
            </th>
            <th style={{ ...headCell, textAlign: 'left' }} dir="ltr">
              المبلغ
            </th>
          </tr>
        </thead>
        <tbody>
          {services.map((s, i) => (
            <LineRow
              key={`${s.description ?? 'service'}-${i}`}
              label={s.description}
              sub={
                s.quantity && s.quantity > 1 ? (
                  <Amount>{`${s.quantity} × ₪${s.unitPrice ?? '0.00'}`}</Amount>
                ) : null
              }
              value={ils(s.amount)}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ padding: '0' }}>
              <Hr style={rule} />
            </td>
          </tr>
          <LineRow label="المجموع الفرعي" value={ils(subtotal)} />
          {discount ? (
            <LineRow label="الخصم" value={`−₪${discount}`} tone={color.success} />
          ) : null}
          {referralDiscount ? (
            <LineRow label="خصم الإحالة" value={`−₪${referralDiscount}`} tone={color.success} />
          ) : null}
          <LineRow label="الإجمالي" value={ils(serviceTotal)} bold />
          {/* Darb does not bill in installments: paid / balance rows appear only
              when a payment has actually been confirmed. */}
          {paid > 0 ? (
            <LineRow label="المدفوع" value={ils(totalConfirmed)} tone={color.success} />
          ) : null}
          {paid > 0 && due > 0 ? (
            <LineRow label="الرصيد المتبقي" value={ils(remaining)} bold tone={color.navy} />
          ) : null}
        </tfoot>
      </table>

      {fullyPaid ? (
        <Text style={{ ...note, color: color.success, fontWeight: 700 }} dir="rtl">
          ✓ هذه الفاتورة مدفوعة بالكامل.
        </Text>
      ) : null}

      {/* Germany costs — separate currency, never mixed into the ILS total */}
      {schoolCosts.length > 0 ? (
        <>
          <Text style={sectionTitle} dir="rtl">
            تكاليف ألمانيا (تقديرية — تُدفع مباشرة لمزوّد الخدمة)
          </Text>
          <table
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            role="presentation"
            style={lineTable}
            dir="rtl"
          >
            <tbody>
              {schoolCosts.map((l, i) => (
                <LineRow
                  key={`${l.label ?? 'cost'}-${i}`}
                  label={l.label}
                  value={`${l.currency === 'EUR' ? '€' : `${l.currency} `}${l.amount ?? '0.00'}`}
                />
              ))}
            </tbody>
          </table>
          <Text style={note} dir="rtl">
            هذه المبالغ باليورو وليست جزءاً من إجمالي خدمات درب بالشيكل، وتُدفع مباشرة للمدرسة أو
            مزوّد الخدمة في ألمانيا.
          </Text>
        </>
      ) : null}

      {link ? <EmailButton href={link}>عرض الفاتورة وتنزيلها</EmailButton> : null}
      {link ? <EmailFallbackLink href={link} /> : null}

      <EmailText muted>لأي استفسار بخصوص فاتورتك، يسعدنا تواصلك مع فريق درب.</EmailText>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `فاتورة ${data?.invoiceNumber ?? ''} — درب`.trim(),
  displayName: 'Case invoice',
  /** Sample data only — the link points at the invoice route with a sample token. */
  previewData: {
    studentName: 'أحمد محمد',
    caseReference: 'DRB-2026-000031',
    invoiceNumber: 'DRB-INV-2026-000031',
    issuedAt: '2026-08-11',
    services: [
      { description: 'تقديم جامعي', quantity: 1, unitPrice: '2,000.00', amount: '2,000.00' },
      { description: 'مساعدة في السكن', quantity: 1, unitPrice: '800.00', amount: '800.00' },
      { description: 'مساعدة في التأمين', quantity: 2, unitPrice: '175.00', amount: '350.00' },
    ],
    subtotal: '3,150.00',
    discount: '500.00',
    referralDiscount: null,
    serviceTotal: '2,650.00',
    totalConfirmed: '1,000.00',
    remaining: '1,650.00',
    schoolCosts: [{ label: 'Language course', amount: '4,200.00', currency: 'EUR' }],
    link: 'https://darb.agency/invoice/sample-token-preview-only',
  },
} satisfies TemplateEntry


/* ------------------------------------------------------------------ styles */

const metaBox = {
  backgroundColor: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.card,
  padding: '12px 14px',
  margin: '4px 0 16px',
}

const metaLabel = {
  fontSize: font.size.small,
  color: color.textMuted,
  padding: '5px 0 5px 14px',
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
  width: '40%',
  borderBottom: `1px solid ${color.border}`,
  fontFamily: font.family,
}

const metaValue = {
  fontSize: font.size.small,
  color: color.text,
  fontWeight: 600,
  padding: '5px 0',
  textAlign: 'left' as const,
  borderBottom: `1px solid ${color.border}`,
  fontFamily: font.family,
}


const sectionTitle = {
  fontSize: font.size.small,
  fontWeight: 700,
  color: color.navy,
  margin: '18px 0 6px',
  fontFamily: font.family,
}

const lineTable = {
  borderCollapse: 'collapse' as const,
  border: `1px solid ${color.border}`,
  borderRadius: radius.card,
  width: '100%',
}

const headCell = {
  fontSize: font.size.label,
  color: color.textMuted,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  padding: '8px 12px',
  backgroundColor: color.surface,
  borderBottom: `1px solid ${color.border}`,
  fontFamily: font.family,
}

const cell = {
  fontSize: font.size.body,
  color: color.text,
  padding: '9px 12px',
  borderBottom: `1px solid ${color.border}`,
  fontFamily: font.family,
}

const subLabel = {
  fontSize: font.size.tiny,
  color: color.textMuted,
  marginTop: '2px',
}

const rule = { borderColor: color.border, margin: '0' }

const note = {
  fontSize: font.size.tiny,
  color: color.textMuted,
  lineHeight: '1.7',
  margin: '8px 0 0',
  fontFamily: font.family,
}
