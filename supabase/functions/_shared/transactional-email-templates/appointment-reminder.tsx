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
  recipientName?: string
  studentName?: string
  caseReference?: string
  whenText?: string
  windowLabel?: string
  notes?: string
  link?: string
}

const Email = ({
  recipientName,
  studentName,
  caseReference,
  whenText,
  windowLabel,
  notes,
  link,
}: Props) => (
  <EmailLayout
    preview={`تذكير بموعد${studentName ? ` مع ${studentName}` : ''}`}
    title={windowLabel === '1h' ? 'موعدك بعد ساعة' : 'تذكير: موعد غداً'}
  >
    <EmailText>{recipientName ? `مرحباً ${recipientName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      {windowLabel === '1h'
        ? 'هذا تذكير بأن لديك موعداً خلال ساعة تقريباً.'
        : 'هذا تذكير بأن لديك موعداً خلال 24 ساعة.'}
    </EmailText>

    <EmailCard>
      {studentName ? <EmailInfoRow label="الطالب" value={studentName} /> : null}
      {caseReference ? <EmailInfoRow label="رقم الملف" value={caseReference} /> : null}
      {whenText ? <EmailInfoRow label="موعد اللقاء" value={whenText} /> : null}
      {notes ? <EmailInfoRow label="ملاحظات" value={notes} /> : null}
    </EmailCard>

    {link ? <EmailButton href={link}>فتح المواعيد</EmailButton> : null}
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data?.windowLabel === '1h' ? 'تذكير: موعدك بعد ساعة — درب' : 'تذكير: موعد غداً — درب',
  displayName: 'Appointment reminder',
  previewData: {
    recipientName: 'خير',
    studentName: 'أحمد محمد',
    caseReference: 'DARB-1042',
    whenText: '2026-08-12 10:30',
    windowLabel: '24h',
    link: 'https://darb.agency/team/appointments',
  },
} satisfies TemplateEntry
