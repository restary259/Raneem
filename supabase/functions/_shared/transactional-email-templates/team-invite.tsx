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
  memberName?: string
  email?: string
  activationUrl?: string
}

const Email = ({ memberName, email, activationUrl }: Props) => (
  <EmailLayout
    preview="تم إنشاء حسابك في فريق درب — فعّل حسابك"
    title="مرحباً بك في فريق درب"
  >
    <EmailText>{memberName ? `مرحباً ${memberName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      تم إنشاء حساب لك ضمن فريق درب. من خلال الحساب يمكنك متابعة ملفات الطلاب المسندة إليك،
      وجدولة المواعيد، ومراسلة الإدارة وبقية أعضاء الفريق.
    </EmailText>

    <EmailCard>
      {email ? <EmailInfoRow label="البريد الإلكتروني" value={email} ltrValue /> : null}
      <EmailInfoRow label="الصلاحية" value="عضو فريق" />
    </EmailCard>

    {activationUrl ? (
      <>
        <EmailButton href={activationUrl}>تفعيل الحساب واختيار كلمة المرور</EmailButton>
        <EmailFallbackLink href={activationUrl} />
      </>
    ) : null}

    <EmailText muted>
      الرابط صالح للاستخدام مرة واحدة فقط ولا يجوز مشاركته مع أي شخص.
    </EmailText>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'تم إنشاء حسابك في فريق درب — فعّل حسابك',
  displayName: 'Team member account invite',
  previewData: {
    memberName: 'ليلى عيسى',
    email: 'team@example.com',
    activationUrl: 'https://darb.agency/activate?token=demo',
  },
} satisfies TemplateEntry
