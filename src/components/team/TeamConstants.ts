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

export const NEON_BORDERS: Record<string, string> = {
  all: 'border-white/30',
  new: 'border-[hsl(217,100%,60%)] shadow-[0_0_6px_hsl(217,100%,60%/0.3)]',
  contacted: 'border-[hsl(50,100%,50%)] shadow-[0_0_6px_hsl(50,100%,50%/0.3)]',
  appointment_stage: 'border-[hsl(270,100%,65%)] shadow-[0_0_6px_hsl(270,100%,65%/0.3)]',
  profile_completion: 'border-[hsl(140,70%,50%)] shadow-[0_0_6px_hsl(140,70%,50%/0.3)]',
  payment_confirmed: 'border-[hsl(30,100%,55%)] shadow-[0_0_6px_hsl(30,100%,55%/0.3)]',
  submitted: 'border-[hsl(185,100%,50%)] shadow-[0_0_6px_hsl(185,100%,50%/0.3)]',
  enrollment_paid: 'border-[hsl(140,80%,45%)] shadow-[0_0_6px_hsl(140,80%,45%/0.3)]',
  sla: 'border-[hsl(0,100%,55%)] shadow-[0_0_6px_hsl(0,100%,55%/0.3)]',
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
