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
  recipientName?: string
  senderName?: string
  threadTitle?: string
  preview?: string
  link?: string
}

const Email = ({ recipientName, senderName, threadTitle, preview, link }: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>{preview ? preview.slice(0, 120) : 'لديك رسالة جديدة في درب'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>درب | Darb Agency</Text>
        <Heading style={heading}>لديك رسالة جديدة</Heading>
        <Text style={text}>
          {recipientName ? `مرحباً ${recipientName}،` : 'مرحباً،'}
        </Text>
        <Text style={text}>
          وصلتك رسالة جديدة{senderName ? ` من ${senderName}` : ''}
          {threadTitle ? ` بخصوص: ${threadTitle}` : ''}.
        </Text>
        {preview ? (
          <Section style={quote}>
            <Text style={quoteText}>{preview}</Text>
          </Section>
        ) : null}
        {link ? (
          <Button style={button} href={link}>
            فتح المحادثة
          </Button>
        ) : null}
        <Hr style={hr} />
        <Text style={muted}>
          يمكنك إيقاف إشعارات البريد لهذه المحادثة من إعدادات الإشعارات داخل لوحة التحكم.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data?.threadTitle
      ? `رسالة جديدة — ${String(data.threadTitle)}`
      : 'رسالة جديدة — درب',
  displayName: 'New chat message',
  previewData: {
    recipientName: 'رنيم',
    senderName: 'أحمد',
    threadTitle: 'DARB-1042',
    preview: 'أرسلت لك جواز السفر المطلوب.',
    link: 'https://darb-agency.lovable.app/team/messages',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0f766e', margin: '0 0 12px' }
const heading = { fontSize: '20px', color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1f2937', lineHeight: '1.7', margin: '0 0 10px' }
const quote = {
  backgroundColor: '#f1f5f9',
  borderRadius: '10px',
  padding: '12px 14px',
  margin: '12px 0 18px',
}
const quoteText = { fontSize: '14px', color: '#334155', margin: 0, lineHeight: '1.7' }
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
