// deno-lint-ignore-file no-explicit-any
import type * as React from 'npm:react@18.3.1'
import { template as newMessage } from './new-message.tsx'
import { template as emailTest } from './email-test.tsx'
import { template as studentInvite } from './student-invite.tsx'
import { template as partnerInvite } from './partner-invite.tsx'
import { template as teamInvite } from './team-invite.tsx'
import { template as ambassadorInvite } from './ambassador-invite.tsx'
import { template as appointmentReminder } from './appointment-reminder.tsx'
import { template as caseInvoice } from './case-invoice.tsx'
import { template as accountInvite } from './account-invite.tsx'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

/**
 * The branded fallback template used when a caller requests a template name
 * that is not in the registry. Exported so send-transactional-email can use
 * it as a safety net without duplicating the component.
 */
export const FALLBACK_TEMPLATE = accountInvite

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-message': newMessage,
  'email-test': emailTest,
  'student-invite': studentInvite,
  'partner-invite': partnerInvite,
  'team-invite': teamInvite,
  'ambassador-invite': ambassadorInvite,
  'appointment-reminder': appointmentReminder,
  'case-invoice': caseInvoice,
  'account-invite': accountInvite,
}

