/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  EmailButton,
  EmailFallbackLink,
  EmailLayout,
  EmailText,
} from '../email-ui/components.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <EmailLayout preview="إعادة تعيين كلمة المرور لحسابك في درب" title="إعادة تعيين كلمة المرور">
    <EmailText>مرحباً،</EmailText>
    <EmailText>
      تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في درب. اضغط على الزر أدناه لاختيار كلمة
      مرور جديدة.
    </EmailText>

    <EmailButton href={confirmationUrl}>إعادة تعيين كلمة المرور</EmailButton>
    <EmailFallbackLink href={confirmationUrl} />

    <EmailText muted>
      إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة وستبقى كلمة المرور الحالية كما هي. لا تشارك هذا
      الرابط مع أي شخص.
    </EmailText>
  </EmailLayout>
)

export default RecoveryEmail
