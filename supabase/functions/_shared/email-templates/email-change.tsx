/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  EmailButton,
  EmailCard,
  EmailFallbackLink,
  EmailInfoRow,
  EmailLayout,
  EmailText,
} from '../email-ui/components.tsx'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ email, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <EmailLayout preview="تأكيد تغيير البريد الإلكتروني لحسابك في درب" title="تأكيد تغيير البريد الإلكتروني">
    <EmailText>مرحباً،</EmailText>
    <EmailText>
      تلقينا طلباً لتغيير البريد الإلكتروني المرتبط بحسابك في درب. يرجى تأكيد التغيير من الزر أدناه.
    </EmailText>

    <EmailCard>
      <EmailInfoRow label="البريد الحالي" value={email} ltrValue />
      <EmailInfoRow label="البريد الجديد" value={newEmail} ltrValue />
    </EmailCard>

    <EmailButton href={confirmationUrl}>تأكيد البريد الجديد</EmailButton>
    <EmailFallbackLink href={confirmationUrl} />

    <EmailText muted>
      إذا لم تطلب هذا التغيير، تجاهل هذه الرسالة وتواصل مع فريق درب فوراً.
    </EmailText>
  </EmailLayout>
)

export default EmailChangeEmail
