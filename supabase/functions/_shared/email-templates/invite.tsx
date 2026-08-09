/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  EmailButton,
  EmailFallbackLink,
  EmailLayout,
  EmailText,
} from '../email-ui/components.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <EmailLayout preview="دعوة للانضمام إلى منصة درب" title="دعوة للانضمام إلى درب">
    <EmailText>مرحباً،</EmailText>
    <EmailText>
      تمت دعوتك للانضمام إلى منصة درب. اقبل الدعوة لإنشاء كلمة المرور الخاصة بك والدخول إلى لوحة
      التحكم.
    </EmailText>

    <EmailButton href={confirmationUrl}>قبول الدعوة وتفعيل الحساب</EmailButton>
    <EmailFallbackLink href={confirmationUrl} />

    <EmailText muted>إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة.</EmailText>
  </EmailLayout>
)

export default InviteEmail
