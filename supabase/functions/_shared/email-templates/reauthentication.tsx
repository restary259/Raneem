/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رمز التحقق الخاص بك</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://mzbadxfvxioedzdjxamc.supabase.co/storage/v1/object/public/student-documents/email-logo.png"
          alt="DARB Agency"
          width="120"
          height="auto"
          style={logo}
        />
        <Heading style={h1}>تأكيد هويتك</Heading>
        <Text style={text}>استخدم الرمز أدناه لتأكيد هويتك:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          هذا الرمز صالح لفترة قصيرة. إذا لم تطلبه، يمكنك تجاهل هذا البريد بأمان.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"IBM Plex Sans Arabic", "Tajawal", "Noto Sans Arabic", Arial, sans-serif',
}
const container = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '32px 28px',
  borderRadius: '12px',
  border: '1px solid hsl(214.3, 31.8%, 91.4%)',
}
const logo = { marginBottom: '24px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(222.2, 84%, 4.9%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(215.4, 16.3%, 46.9%)',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const codeStyle = {
  fontFamily: 'Courier, "Courier New", monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(222.2, 47.4%, 11.2%)',
  letterSpacing: '6px',
  backgroundColor: 'hsl(210, 40%, 96.1%)',
  borderRadius: '8px',
  padding: '12px 20px',
  margin: '0 0 28px',
  display: 'block',
  textAlign: 'center' as const,
}
const footer = {
  fontSize: '12px',
  color: 'hsl(215.4, 16.3%, 60%)',
  margin: '24px 0 0',
  borderTop: '1px solid hsl(214.3, 31.8%, 91.4%)',
  paddingTop: '16px',
}
