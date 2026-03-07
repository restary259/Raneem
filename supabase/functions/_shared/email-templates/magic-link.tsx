/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رابط تسجيل الدخول لـ {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://mzbadxfvxioedzdjxamc.supabase.co/storage/v1/object/public/student-documents/email-logo.png"
          alt="DARB Agency"
          width="120"
          height="auto"
          style={logo}
        />
        <Heading style={h1}>رابط تسجيل الدخول</Heading>
        <Text style={text}>
          انقر على الزر أدناه لتسجيل الدخول إلى {siteName}. هذا الرابط
          صالح لفترة محدودة.
        </Text>
        <Button style={button} href={confirmationUrl}>
          تسجيل الدخول
        </Button>
        <Text style={footer}>
          إذا لم تطلب هذا الرابط، يمكنك تجاهل هذا البريد بأمان.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
  margin: '0 0 24px',
}
const button = {
  backgroundColor: 'hsl(222.2, 47.4%, 11.2%)',
  color: 'hsl(210, 40%, 98%)',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '0.75rem',
  padding: '13px 24px',
  textDecoration: 'none',
  display: 'block',
  textAlign: 'center' as const,
  marginBottom: '24px',
}
const footer = {
  fontSize: '12px',
  color: 'hsl(215.4, 16.3%, 60%)',
  margin: '24px 0 0',
  borderTop: '1px solid hsl(214.3, 31.8%, 91.4%)',
  paddingTop: '16px',
}
