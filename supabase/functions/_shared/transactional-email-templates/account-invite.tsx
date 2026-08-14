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
  recipientName?: string
  email?: string
  inviterName?: string
  role?: string
  message?: string
  activationUrl?: string
  loginUrl?: string
  tempPassword?: string
}

/**
 * Generic branded DARB account-invitation fallback template.
 *
 * Used by `send-transactional-email` whenever a caller requests a template
 * name that is NOT in the registry — so no invitation email ever sends as
 * unbranded/plain text. It dynamically renders the recipient name, the
 * inviter (agent/admin), the assigned role, an optional personalized
 * message, the activation or login CTA, and DARB branding.
 *
 * Dedicated templates (partner-invite, ambassador-invite, team-invite,
 * student-invite) still win when they exist; this is the safety net.
 */
const Email = ({
  recipientName,
  email,
  inviterName,
  role,
  message,
  activationUrl,
  loginUrl,
  tempPassword,
}: Props) => {
  const roleLabel = role
    ? role === 'social_media_partner'
      ? 'وكيل (شريك)'
      : role === 'ambassador'
        ? 'سفير'
        : role === 'agent'
          ? 'وكيل'
          : role === 'team_member'
            ? 'عضو فريق'
            : role === 'student'
              ? 'طالب'
              : role
    : 'عضو'

  return (
    <EmailLayout
      preview="دعوة لإنشاء حسابك في درب — فعّل حسابك"
      title="مرحباً بك في درب"
    >
      <EmailText>{recipientName ? `مرحباً ${recipientName}،` : 'مرحباً،'}</EmailText>
      <EmailText>
        {inviterName
          ? `لقد دعاك ${inviterName} للانضمام إلى منصة درب للدراسة في ألمانيا. تم إنشاء حسابك ويمكنك الآن البدء.`
          : 'يسعدنا انضمامك إلى منصة درب للدراسة في ألمانيا. تم إنشاء حسابك ويمكنك الآن البدء.'}
      </EmailText>

      {message ? <EmailText>{message}</EmailText> : null}

      <EmailCard>
        {email ? <EmailInfoRow label="البريد الإلكتروني" value={email} ltrValue /> : null}
        <EmailInfoRow label="الصلاحية" value={roleLabel} />
        {tempPassword ? (
          <EmailInfoRow label="كلمة المرور المؤقتة" value={tempPassword} ltrValue />
        ) : null}
      </EmailCard>

      {tempPassword ? (
        <EmailText muted>
          يُرجى تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور المؤقتة أعلاه، ثم تغيير كلمة المرور
          فور تسجيل الدخول لأول مرة.
        </EmailText>
      ) : null}

      {activationUrl ? (
        <>
          <EmailButton href={activationUrl}>تفعيل الحساب واختيار كلمة المرور</EmailButton>
          <EmailFallbackLink href={activationUrl} />
        </>
      ) : loginUrl ? (
        <>
          <EmailButton href={loginUrl}>تسجيل الدخول</EmailButton>
          <EmailFallbackLink href={loginUrl} />
        </>
      ) : (
        <EmailButton href="https://darb.agency/login">تسجيل الدخول إلى حسابك</EmailButton>
      )}

      <EmailText muted>
        الرابط صالح للاستخدام مرة واحدة فقط ولا يجوز مشاركته مع أي شخص.
      </EmailText>
    </EmailLayout>
  )
}

export const template = {
  component: Email,
  subject: 'دعوة لإنشاء حسابك في درب — فعّل حسابك',
  displayName: 'Generic DARB account invitation (fallback)',
  previewData: {
    recipientName: 'سارة خليل',
    email: 'member@example.com',
    inviterName: 'أحمد وكيل',
    role: 'social_media_partner',
    message: 'نرحب بانضمامك إلى شبكتنا.',
    activationUrl: 'https://darb.agency/activate?token=demo',
  },
} satisfies TemplateEntry
