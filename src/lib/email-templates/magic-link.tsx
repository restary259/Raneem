import * as React from 'react'
import {
  EmailButton,
  EmailFallbackLink,
  EmailLayout,
  EmailText,
} from './_ui/components'

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
