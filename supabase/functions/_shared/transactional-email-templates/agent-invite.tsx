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
  agentName?: string
  email?: string
  activationUrl?: string
}

const Email = ({ agentName, email, activationUrl }: Props) => (
  <EmailLayout
    preview="تم إنشاء حسابك كوكيل لدى درب — فعّل حسابك"
    title="مرحباً بك كوكيل في درب"
  >
    <EmailText>{agentName ? `مرحباً ${agentName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      يسعدنا انضمامك إلى وكلاء درب. من خلال حسابك يمكنك بناء شبكتك من الشركاء
      والسفراء عبر رابط التجنيد الخاص بك، ومتابعة الطلاب الذين ينضمون عبر
      شبكتك، ومتابعة عمولاتك وطلبات الصرف.
    </EmailText>

    <EmailCard>
      {email ? <EmailInfoRow label="البريد الإلكتروني" value={email} ltrValue /> : null}
      <EmailInfoRow label="الصلاحية" value="وكيل" />
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
  subject: 'تم إنشاء حسابك كوكيل في درب — فعّل حسابك',
  displayName: 'Agent account invite',
  previewData: {
    agentName: 'سامر عادل',
    email: 'agent@example.com',
    activationUrl: 'https://darb.agency/activate?token=demo',
  },
} satisfies TemplateEntry
