import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import {
  EmailButton,
  EmailCard,
  EmailFallbackLink,
  EmailInfoRow,
  EmailLayout,
  EmailStatusBadge,
  EmailText,
} from '../email-ui/components.tsx'
import { color, font } from '../email-ui/theme.ts'
import type { TemplateEntry } from './registry.ts'

/**
 * Enrollment-confirmation notice, sent by admin-mark-paid the moment a case is
 * marked enrollment_paid.
 *
 * The in-app notification is already emitted by the case_events trigger chain;
 * this email is the durable out-of-band confirmation. It carries no payment
 * amounts and performs no arithmetic — just the milestone and what comes next.
 */

interface Props {
  studentName?: string
  caseReference?: string
  dashboardUrl?: string
}

const Email = ({ studentName, caseReference, dashboardUrl }: Props) => (
  <EmailLayout
    preview="تم تأكيد تسجيلك في ألمانيا — مبروك على بداية رحلتك"
    title="تم تأكيد تسجيلك في درب"
  >
    <EmailStatusBadge label="تم تأكيد التسجيل" tone="success" />

    <EmailText>{studentName ? `عزيزي/عزيزتي ${studentName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      يسعدنا إبلاغك أنه تم تأكيد تسجيلك في برنامج الدراسة في ألمانيا. لقد أنهى فريقنا جميع
      إجراءات القبول النهائية، ويبدأ الآن تجهيز ملفك للخطوات التالية.
    </EmailText>

    <EmailCard>
      {caseReference ? (
        <EmailInfoRow label="رقم الملف" value={caseReference} ltrValue />
      ) : null}
    </EmailCard>

    <Text style={sectionTitle} dir="rtl">
      الخطوات التالية
    </Text>
    <EmailText>
      سيتواصل معك مستشارك قريباً لترتيب تجهيز المستندات وتقديم طلب التأشيرة والمتطلبات
      الأكاديمية. يمكنك متابعة حالة ملفك في أي وقت من لوحة الطالب.
    </EmailText>

    {dashboardUrl ? (
      <>
        <EmailButton href={dashboardUrl}>متابعة ملفي من لوحة الطالب</EmailButton>
        <EmailFallbackLink href={dashboardUrl} />
      </>
    ) : null}

    <EmailText muted>
      إذا كان لديك أي سؤال، يسعدنا تواصلك مع فريق درب في أي وقت.
    </EmailText>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `تم تأكيد تسجيلك${data?.caseReference ? ` (${data.caseReference})` : ''} — درب`,
  displayName: 'Enrollment confirmed',
  previewData: {
    studentName: 'آدم خليل',
    caseReference: 'DRB-2026-000031',
    dashboardUrl: 'https://darb.agency/student',
  },
} satisfies TemplateEntry

/* ------------------------------------------------------------------ styles */

const sectionTitle = {
  fontSize: font.size.small,
  fontWeight: 700,
  color: color.navy,
  margin: '18px 0 6px',
  fontFamily: font.family,
}
