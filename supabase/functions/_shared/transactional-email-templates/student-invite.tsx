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
  studentName?: string
  email?: string
  caseReference?: string
  activationUrl?: string
}

const Email = ({ studentName, email, caseReference, activationUrl }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تم إنشاء حسابك في درب — تابع ملفك الدراسي</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>درب | Darb Agency</Text>
        <Heading style={heading}>أهلاً بك في درب</Heading>
        <Text style={text}>{studentName ? `مرحباً ${studentName}،` : 'مرحباً،'}</Text>
        <Text style={text}>
          تم إنشاء حسابك الخاص لمتابعة ملفك الدراسي في ألمانيا
          {caseReference ? ` (رقم الملف: ${caseReference})` : ''}. من خلال الحساب يمكنك متابعة
          مراحل الطلب، رفع المستندات، ومراسلة فريقنا مباشرة.
        </Text>

        <Section style={box}>
          <Text style={boxRow}>
            <strong>البريد الإلكتروني:</strong> {email}
          </Text>
          <Text style={boxRow}>استخدم الرابط الآمن أدناه لاختيار كلمة مرور جديدة.</Text>
        </Section>

        <Text style={text}>الرابط صالح للاستخدام مرة واحدة فقط. لا تشاركه مع أي شخص.</Text>

        {activationUrl ? (
          <Button style={button} href={activationUrl}>
            تفعيل الحساب واختيار كلمة المرور
          </Button>
        ) : null}

        <Hr style={hr} />
        <Text style={muted}>
          إذا لم تطلب هذا الحساب، تجاهل هذه الرسالة أو تواصل مع فريق درب.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'حسابك في درب جاهز — فعّل حسابك',
  displayName: 'Student account invite',
  previewData: {
    studentName: 'آدم خليل',
    email: 'student@example.com',
    caseReference: 'DARB-1042',
    activationUrl: 'https://darb-agency.lovable.app/reset-password',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0f766e', margin: '0 0 12px' }
const heading = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1f2937', lineHeight: '1.7', margin: '0 0 10px' }
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
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const muted = { fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.6' }
