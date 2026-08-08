import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  partnerName?: string
  email?: string
  masterName?: string
  activationUrl?: string
}

const Email = ({ partnerName, email, masterName, activationUrl }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تمت الموافقة على انضمامك كوكيل في درب — فعّل حسابك</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>درب | Darb Agency</Text>
        <Heading style={heading}>تمت الموافقة على انضمامك</Heading>
        <Text style={text}>{partnerName ? `مرحباً ${partnerName}،` : 'مرحباً،'}</Text>
        <Text style={text}>
          يسعدنا إبلاغك بالموافقة على طلبك للانضمام كوكيل في درب
          {masterName ? ` ضمن شبكة ${masterName}` : ''}. تم إنشاء حسابك الخاص للوحة تحكم الوكلاء.
        </Text>

        <Section style={box}>
          <Text style={boxRow}>
            <strong>البريد الإلكتروني للدخول:</strong> {email}
          </Text>
          <Text style={boxRow}>استخدم الرابط الآمن أدناه لاختيار كلمة مرور جديدة.</Text>
        </Section>

        <Text style={text}>من خلال لوحة التحكم يمكنك:</Text>
        <Text style={bullet}>• الحصول على رابط الإحالة الخاص بك ومشاركته</Text>
        <Text style={bullet}>• متابعة الطلاب الذين سجّلوا عبر رابطك</Text>
        <Text style={bullet}>• الاطلاع على أرباحك وتفاصيل كل ملف</Text>
        <Text style={bullet}>• إرسال طلبات سحب الأرباح ومتابعتها</Text>

        {activationUrl ? (
          <Button style={button} href={activationUrl}>
            تفعيل الحساب واختيار كلمة المرور
          </Button>
        ) : null}

        <Text style={text}>الرابط صالح للاستخدام مرة واحدة فقط. لا تشاركه مع أي شخص.</Text>

        <Hr style={hr} />
        <Text style={muted}>
          إذا لم تقدّم هذا الطلب، تجاهل هذه الرسالة أو تواصل مع فريق درب.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'تمت الموافقة على انضمامك كوكيل في درب — فعّل حسابك',
  displayName: 'Partner account invite',
  previewData: {
    partnerName: 'سامي حسن',
    email: 'partner@example.com',
    masterName: 'ريان درب',
    activationUrl: 'https://darb-agency.lovable.app/reset-password',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0f766e', margin: '0 0 12px' }
const heading = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1f2937', lineHeight: '1.7', margin: '0 0 10px' }
const bullet = { fontSize: '14px', color: '#334155', lineHeight: '1.8', margin: '0 0 4px' }
const box = {
  backgroundColor: '#f1f5f9',
  borderRadius: '10px',
  padding: '14px 16px',
  margin: '14px 0 18px',
}
const boxRow = { fontSize: '14px', color: '#334155', margin: '0 0 6px', lineHeight: '1.7' }
const button = {
  backgroundColor: '#0f766e',
  color: '#ffffff',
  borderRadius: '10px',
  padding: '11px 20px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
  margin: '10px 0 16px',
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const muted = { fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.6' }
