/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { EmailCard, EmailInfoRow, EmailLayout, EmailText } from '../email-ui/components.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailLayout preview="رمز التحقق الخاص بك في درب" title="رمز التحقق">
    <EmailText>مرحباً،</EmailText>
    <EmailText>استخدم الرمز التالي لإكمال عملية التحقق من هويتك:</EmailText>

    <EmailCard>
      <EmailInfoRow label="رمز التحقق" value={token} ltrValue />
    </EmailCard>

    <EmailText muted>
      الرمز صالح لفترة قصيرة ويُستخدم مرة واحدة. لا تشارك هذا الرمز مع أي شخص، ولن يطلبه منك فريق
      درب أبداً.
    </EmailText>
  </EmailLayout>
)

export default ReauthenticationEmail
