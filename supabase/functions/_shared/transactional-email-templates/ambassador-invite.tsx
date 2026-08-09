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
  ambassadorName?: string
  email?: string
  activationUrl?: string
}

const Email = ({ ambassadorName, email, activationUrl }: Props) => (
  <EmailLayout
    preview="تم إنشاء حسابك كسفير لدرب — فعّل حسابك"
    title="مرحباً بك كسفير في درب"
  >
    <EmailText>{ambassadorName ? `مرحباً ${ambassadorName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      يسعدنا انضمامك إلى سفراء درب. من خلال حسابك يمكنك مشاركة رابط الإحالة الخاص بك، ومتابعة
      الطلاب الذين ينضمون عن طريقك، ومتابعة مكافآتك.
    </EmailText>

    <EmailCard>
      {email ? <EmailInfoRow label="البريد الإلكتروني" value={email} ltrValue /> : null}
      <EmailInfoRow label="الصلاحية" value="سفير" />
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
  subject: 'تم إنشاء حسابك كسفير في درب — فعّل حسابك',
  displayName: 'Ambassador account invite',
  previewData: {
    ambassadorName: 'نور خالد',
    email: 'ambassador@example.com',
    activationUrl: 'https://darb.agency/activate?token=demo',
  },
} satisfies TemplateEntry
