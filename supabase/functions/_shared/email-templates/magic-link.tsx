/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  EmailButton,
  EmailFallbackLink,
  EmailLayout,
  EmailText,
} from '../email-ui/components.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <EmailLayout preview="رابط الدخول إلى حسابك في درب" title="رابط الدخول إلى حسابك">
    <EmailText>مرحباً،</EmailText>
    <EmailText>
      استخدم الزر أدناه لتسجيل الدخول إلى حسابك في درب. الرابط صالح لفترة قصيرة ويُستخدم مرة واحدة
      فقط.
    </EmailText>

    <EmailButton href={confirmationUrl}>تسجيل الدخول</EmailButton>
    <EmailFallbackLink href={confirmationUrl} />

    <EmailText muted>
      إذا لم تطلب رابط الدخول، تجاهل هذه الرسالة. لا تشارك هذا الرابط مع أي شخص.
    </EmailText>
  </EmailLayout>
)

export default MagicLinkEmail
