import * as React from 'npm:react@18.3.1'
import {
  EmailCard,
  EmailInfoRow,
  EmailLayout,
  EmailStatusBadge,
  EmailText,
} from '../email-ui/components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  sentAt?: string
}

const Email = ({ recipientName, sentAt }: Props) => (
  <EmailLayout preview="اختبار إشعارات البريد — درب" title="اختبار إشعارات البريد">
    <EmailText>{recipientName ? `مرحباً ${recipientName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      هذه رسالة اختبار تؤكد أن إشعارات البريد الخاصة بمنصة درب تعمل بشكل صحيح.
    </EmailText>

    <EmailCard>
      <EmailStatusBadge label="الإرسال يعمل بنجاح" tone="success" />
      {sentAt ? <EmailInfoRow label="وقت الإرسال" value={sentAt} ltrValue /> : null}
    </EmailCard>

    <EmailText muted>لا يلزم اتخاذ أي إجراء بخصوص هذه الرسالة.</EmailText>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'اختبار إشعارات البريد — درب',
  displayName: 'Email delivery test',
  previewData: { recipientName: 'رنيم', sentAt: '2026-08-08 10:00' },
} satisfies TemplateEntry
