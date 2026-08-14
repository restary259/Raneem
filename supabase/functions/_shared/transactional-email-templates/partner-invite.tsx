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
  partnerName?: string
  email?: string
  masterName?: string
  agentName?: string
  activationUrl?: string
}

const Email = ({ partnerName, email, masterName, agentName, activationUrl }: Props) => (
  <EmailLayout
    preview="تمت الموافقة على انضمامك كوكيل في درب — فعّل حسابك"
    title="تمت الموافقة على انضمامك كوكيل"
  >
    <EmailText>{partnerName ? `مرحباً ${partnerName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      {agentName
        ? `لقد دعاك ${agentName} للانضمام إلى شبكة وكلاء درب. تم إنشاء حسابك، ويمكنك من خلاله متابعة الطلاب الذين تقوم بترشيحهم، ومتابعة عمولاتك، ومراسلة الإدارة مباشرة.`
        : 'يسعدنا انضمامك إلى شبكة وكلاء درب. تم إنشاء حسابك، ويمكنك من خلاله متابعة الطلاب الذين تقوم بترشيحهم، ومتابعة عمولاتك، ومراسلة الإدارة مباشرة.'}
    </EmailText>

    <EmailCard>
      {email ? <EmailInfoRow label="البريد الإلكتروني" value={email} ltrValue /> : null}
      {agentName ? <EmailInfoRow label="الوكيل المُجنِّد" value={agentName} /> : null}
      {masterName ? <EmailInfoRow label="الوكيل الرئيسي" value={masterName} /> : null}
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
  subject: 'تمت الموافقة على انضمامك كوكيل في درب — فعّل حسابك',
  displayName: 'Partner account invite',
  previewData: {
    partnerName: 'سامي حسن',
    email: 'partner@example.com',
    masterName: 'ريان درب',
    activationUrl: 'https://darb.agency/reset-password',
  },
} satisfies TemplateEntry
