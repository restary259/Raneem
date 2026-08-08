// deno-lint-ignore-file no-explicit-any
import type * as React from 'npm:react@18.3.1'
import { template as newMessage } from './new-message.tsx'
import { template as emailTest } from './email-test.tsx'
import { template as studentInvite } from './student-invite.tsx'
import { template as partnerInvite } from './partner-invite.tsx'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-message': newMessage,
  'email-test': emailTest,
  'student-invite': studentInvite,
  'partner-invite': partnerInvite,
}

