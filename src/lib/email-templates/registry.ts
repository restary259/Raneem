// deno-lint-ignore-file no-explicit-any
import type { ComponentType } from 'react'
import { template as newMessage } from './new-message'
import { template as emailTest } from './email-test'
import { template as studentInvite } from './student-invite'
import { template as partnerInvite } from './partner-invite'
import { template as teamInvite } from './team-invite'
import { template as ambassadorInvite } from './ambassador-invite'
import { template as appointmentReminder } from './appointment-reminder'
import { template as caseInvoice } from './case-invoice'
import { template as accountInvite } from './account-invite'
import { template as agentInvite } from './agent-invite'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * The branded fallback template used when a caller requests a template name
 * that is not in the registry.
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
  'agent-invite': agentInvite,
}
