import * as React from 'npm:react@18.3.1'
import {
  EmailButton,
  EmailCard,
  EmailInfoRow,
  EmailLayout,
  EmailText,
} from '../email-ui/components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  studentName?: string
  caseReference?: string
  invoiceNumber?: string
  issuedAt?: string
  serviceTotal?: string
  totalConfirmed?: string
  remaining?: string
  link?: string
}

const Email = ({
  studentName,
  caseReference,
  invoiceNumber,
  issuedAt,
  serviceTotal,
  totalConfirmed,
  remaining,
  link,
}: Props) => (
  <EmailLayout
    preview={`فاتورة ملفك${invoiceNumber ? ` ${invoiceNumber}` : ''} — درب`}
    title="تم استلام ملفك وإصدار الفاتورة"
  >
    <EmailText>{studentName ? `مرحباً ${studentName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      تم إرسال ملفك إلى الإدارة للمراجعة، وهذه فاتورة رسوم الوكالة الخاصة بك.
    </EmailText>

    <EmailCard>
      {invoiceNumber ? <EmailInfoRow label="رقم الفاتورة" value={invoiceNumber} /> : null}
      {caseReference ? <EmailInfoRow label="رقم الملف" value={caseReference} /> : null}
      {issuedAt ? <EmailInfoRow label="التاريخ" value={issuedAt} /> : null}
      {serviceTotal ? <EmailInfoRow label="إجمالي رسوم الوكالة" value={`₪${serviceTotal}`} /> : null}
      {totalConfirmed ? <EmailInfoRow label="المدفوع المؤكد" value={`₪${totalConfirmed}`} /> : null}
      {remaining ? <EmailInfoRow label="الرصيد المتبقي" value={`₪${remaining}`} /> : null}
    </EmailCard>

    <EmailText>
      تكاليف المدرسة والسكن والتأمين تقديرية وتُدفع مباشرة للمدرسة في ألمانيا، وهي
      موضحة بالتفصيل في الفاتورة.
    </EmailText>

    {link ? <EmailButton href={link}>عرض الفاتورة وتنزيلها</EmailButton> : null}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `فاتورة ${data?.invoiceNumber ?? ''} — درب`.trim(),
  displayName: 'Case invoice',
  previewData: {
    studentName: 'أحمد محمد',
    caseReference: 'DRB-2026-000031',
    invoiceNumber: 'DRB-INV-2026-000001',
    issuedAt: '2026-08-09',
    serviceTotal: '5,000.00',
    totalConfirmed: '5,000.00',
    remaining: '0.00',
    link: 'https://darb.agency/invoice/abc123',
  },
} satisfies TemplateEntry
