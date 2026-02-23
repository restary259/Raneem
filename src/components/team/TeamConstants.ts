import { Home, CalendarDays, Calendar, BarChart3 } from 'lucide-react';

export type TabId = 'cases' | 'today' | 'appointments' | 'analytics';
export type CaseFilterTab = 'all' | 'new' | 'contacted' | 'appointment_stage' | 'profile_filled' | 'submitted' | 'paid' | 'sla';

export const CASE_FILTER_TABS: CaseFilterTab[] = ['all', 'new', 'contacted', 'appointment_stage', 'profile_filled', 'submitted', 'paid', 'sla'];

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
  profile_filled: 'border-[hsl(140,70%,50%)] shadow-[0_0_6px_hsl(140,70%,50%/0.3)]',
  submitted: 'border-[hsl(185,100%,50%)] shadow-[0_0_6px_hsl(185,100%,50%/0.3)]',
  paid: 'border-[hsl(140,80%,45%)] shadow-[0_0_6px_hsl(140,80%,45%/0.3)]',
  sla: 'border-[hsl(0,100%,55%)] shadow-[0_0_6px_hsl(0,100%,55%/0.3)]',
};

export function getNeonBorder(status: string): string {
  if (['new', 'eligible', 'assigned'].includes(status)) return NEON_BORDERS.new;
  if (status === 'contacted') return NEON_BORDERS.contacted;
  if (['appointment_scheduled', 'appointment_waiting', 'appointment_completed'].includes(status)) return NEON_BORDERS.appointment_stage;
  if (status === 'profile_filled') return NEON_BORDERS.profile_filled;
  if (status === 'services_filled') return NEON_BORDERS.submitted;
  if (status === 'paid') return NEON_BORDERS.paid;
  return NEON_BORDERS.all;
}

export function matchesFilter(status: string, filter: CaseFilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'new') return ['new', 'eligible', 'assigned'].includes(status);
  if (filter === 'contacted') return status === 'contacted';
  if (filter === 'appointment_stage') return ['appointment_scheduled', 'appointment_waiting', 'appointment_completed'].includes(status);
  if (filter === 'profile_filled') return status === 'profile_filled';
  if (filter === 'submitted') return status === 'services_filled';
  if (filter === 'paid') return status === 'paid';
  return false;
}
