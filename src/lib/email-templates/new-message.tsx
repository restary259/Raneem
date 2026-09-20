import * as React from 'react'
import {
  EmailButton,
  EmailCard,
  EmailInfoRow,
  EmailLayout,
  EmailText,
} from './_ui/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  senderName?: string
  threadTitle?: string
  preview?: string
  link?: string
}

const Email = ({ recipientName, senderName, threadTitle, preview, link }: Props) => (
  <EmailLayout
    preview={preview ? String(preview).slice(0, 120) : 'لديك رسالة جديدة في منصة درب'}
    title="لديك رسالة جديدة"
  >
    <EmailText>{recipientName ? `مرحباً ${recipientName}،` : 'مرحباً،'}</EmailText>
    <EmailText>
      {senderName ? `وصلتك رسالة جديدة من ${senderName} في منصة درب.` : 'وصلتك رسالة جديدة في منصة درب.'}
    </EmailText>

    <EmailCard>
      {threadTitle ? <EmailInfoRow label="المحادثة" value={threadTitle} /> : null}
      {preview ? <EmailInfoRow label="مقتطف من الرسالة" value={preview} /> : null}
    </EmailCard>

    {link ? <EmailButton href={link}>فتح المحادثة</EmailButton> : null}

    <EmailText muted>
      للرد على الرسالة، يرجى استخدام المحادثة داخل المنصة حتى تبقى جميع المراسلات موثقة في الملف.
    </EmailText>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data?.threadTitle ? `رسالة جديدة — ${String(data.threadTitle)}` : 'رسالة جديدة — درب',
  displayName: 'New chat message',
  previewData: {
    recipientName: 'رنيم',
    senderName: 'أحمد',
    threadTitle: 'DARB-1042',
    preview: 'أرسلت لك جواز السفر المطلوب.',
    link: 'https://darb.agency/team/messages',
  },
} satisfies TemplateEntry
