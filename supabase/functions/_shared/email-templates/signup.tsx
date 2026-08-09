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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <EmailLayout preview="تأكيد بريدك الإلكتروني لدى درب" title="تأكيد بريدك الإلكتروني">
    <EmailText>مرحباً،</EmailText>
    <EmailText>
      شكراً لتسجيلك لدى درب. لتفعيل حسابك والبدء بمتابعة ملفك الدراسي، يرجى تأكيد عنوان بريدك
      الإلكتروني.
    </EmailText>

    <EmailCard>
      <EmailInfoRow label="البريد الإلكتروني" value={recipient} ltrValue />
    </EmailCard>

    <EmailButton href={confirmationUrl}>تأكيد البريد الإلكتروني</EmailButton>
    <EmailFallbackLink href={confirmationUrl} />

    <EmailText muted>
      إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة ولن يتم تفعيل أي حساب.
    </EmailText>
  </EmailLayout>
)

export default SignupEmail
