import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipientName?: string
  sentAt?: string
}

const Email = ({ recipientName, sentAt }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>اختبار إشعارات البريد — درب</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>درب | Darb Agency</Text>
        <Heading style={heading}>إشعارات البريد تعمل ✅</Heading>
        <Text style={text}>
          {recipientName ? `مرحباً ${recipientName}، ` : ''}
          هذه رسالة اختبار تؤكد أن إشعارات البريد الخاصة بالمحادثات تعمل بشكل صحيح.
        </Text>
        {sentAt ? <Text style={muted}>وقت الإرسال: {sentAt}</Text> : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'اختبار إشعارات البريد — درب',
  displayName: 'Email delivery test',
  previewData: { recipientName: 'رنيم', sentAt: '2026-08-08 10:00' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0f766e', margin: '0 0 12px' }
const heading = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1f2937', lineHeight: '1.7', margin: '0 0 10px' }
const muted = { fontSize: '12px', color: '#94a3b8', margin: 0 }
