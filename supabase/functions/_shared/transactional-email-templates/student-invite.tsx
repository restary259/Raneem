import * as React from 'npm:react@18.3.1'
import {
  EmailButton,
  EmailCard,
  EmailFallbackLink,
  EmailInfoRow,
  EmailLayout,
  EmailText,
} from '../email-ui/components.tsx'
import type { TemplateEntry } from './registry.ts'

interface Props {
  studentName?: string
  email?: string
  caseReference?: string
  activationUrl?: string
}

const Email = ({ studentName, email, caseReference, activationUrl }: Props) => (
  <EmailLayout
    preview="تم إنشاء حسابك في درب — فعّل حسابك وتابع ملفك الدراسي"
    title="أهلاً بك في درب"
  >
    <EmailText>{studentName ? `مرحباً ${studentName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      تم إنشاء حسابك الخاص لمتابعة ملفك الدراسي في ألمانيا. من خلال الحساب يمكنك متابعة مراحل الطلب،
      رفع المستندات، ومراسلة فريقنا مباشرة.
    </EmailText>

    <EmailCard>
      {caseReference ? <EmailInfoRow label="رقم الملف" value={caseReference} ltrValue /> : null}
      {email ? <EmailInfoRow label="البريد الإلكتروني" value={email} ltrValue /> : null}
    </EmailCard>

    {activationUrl ? (
      <>
        <EmailButton href={activationUrl}>تفعيل الحساب واختيار كلمة المرور</EmailButton>
        <EmailFallbackLink href={activationUrl} />
      </>
    ) : null}

    <EmailText muted>
      الرابط صالح للاستخدام مرة واحدة فقط ولا يجوز مشاركته. إذا لم تطلب هذا الحساب، تواصل مع فريق
      درب.
    </EmailText>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'حسابك في درب جاهز — فعّل حسابك',
  displayName: 'Student account invite',
  previewData: {
    studentName: 'آدم خليل',
    email: 'student@example.com',
    caseReference: 'DARB-1042',
    activationUrl: 'https://darb-agency.lovable.app/reset-password',
  },
} satisfies TemplateEntry
