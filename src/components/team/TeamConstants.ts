import { Home, CalendarDays, Calendar, BarChart3 } from 'lucide-react';

export type TabId = 'cases' | 'today' | 'appointments' | 'analytics';
export type CaseFilterTab = 'all' | 'new' | 'contacted' | 'appointment_stage' | 'profile_completion' | 'payment_confirmed' | 'submitted' | 'enrollment_paid' | 'sla';

export const CASE_FILTER_TABS: CaseFilterTab[] = ['all', 'new', 'contacted', 'appointment_stage', 'profile_completion', 'payment_confirmed', 'submitted', 'enrollment_paid', 'sla'];

export const TAB_CONFIG: { id: TabId; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { id: 'cases', icon: Home, labelKey: 'lawyer.tabs.cases' },
  { id: 'today', icon: CalendarDays, labelKey: 'lawyer.tabs.today' },
  { id: 'appointments', icon: Calendar, labelKey: 'lawyer.tabs.appointments' },
  { id: 'analytics', icon: BarChart3, labelKey: 'lawyer.tabs.analytics' },
];

export const LANGUAGE_SCHOOLS = ['F+U Academy of Languages', 'Alpha Aktiv', 'GO Academy', 'VICTORIA Academy'];

/**
 * Neon status borders — hue anchored on the semantic --status-* tokens so the
 * glow tracks light/dark/aurora instead of being a fixed light-mode colour.
 */
export const NEON_BORDERS: Record<string, string> = {
  all: 'border-border',
  new: 'border-[hsl(var(--status-new)/0.6)] shadow-[0_0_6px_hsl(var(--status-new)/0.3)]',
  contacted: 'border-[hsl(var(--status-contacted)/0.6)] shadow-[0_0_6px_hsl(var(--status-contacted)/0.3)]',
  appointment_stage: 'border-[hsl(var(--status-appointment)/0.6)] shadow-[0_0_6px_hsl(var(--status-appointment)/0.3)]',
  profile_completion: 'border-[hsl(var(--status-profile)/0.6)] shadow-[0_0_6px_hsl(var(--status-profile)/0.3)]',
  payment_confirmed: 'border-[hsl(var(--status-payment)/0.6)] shadow-[0_0_6px_hsl(var(--status-payment)/0.3)]',
  submitted: 'border-[hsl(var(--status-submitted)/0.6)] shadow-[0_0_6px_hsl(var(--status-submitted)/0.3)]',
  enrollment_paid: 'border-[hsl(var(--status-enrolled)/0.6)] shadow-[0_0_6px_hsl(var(--status-enrolled)/0.3)]',
  sla: 'border-[hsl(var(--status-danger)/0.6)] shadow-[0_0_6px_hsl(var(--status-danger)/0.3)]',
};

export function getNeonBorder(status: string): string {
  if (status === 'new') return NEON_BORDERS.new;
  if (status === 'contacted') return NEON_BORDERS.contacted;
  if (status === 'appointment_scheduled') return NEON_BORDERS.appointment_stage;
  if (status === 'profile_completion') return NEON_BORDERS.profile_completion;
  if (status === 'payment_confirmed') return NEON_BORDERS.payment_confirmed;
  if (status === 'submitted') return NEON_BORDERS.submitted;
  if (status === 'enrollment_paid') return NEON_BORDERS.enrollment_paid;
  return NEON_BORDERS.all;
}

export function matchesFilter(status: string, filter: CaseFilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'new') return status === 'new';
  if (filter === 'contacted') return status === 'contacted';
  if (filter === 'appointment_stage') return status === 'appointment_scheduled';
  if (filter === 'profile_completion') return status === 'profile_completion';
  if (filter === 'payment_confirmed') return status === 'payment_confirmed';
  if (filter === 'submitted') return status === 'submitted';
  if (filter === 'enrollment_paid') return status === 'enrollment_paid';
  return false;
}
