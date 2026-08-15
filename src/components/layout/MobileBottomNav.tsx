import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, GitBranch, Users, BookOpen,
  DollarSign, BarChart2, Activity, Settings,
  CalendarDays, ClipboardList, UserPlus, GraduationCap,
  TrendingUp, User, FileText, Inbox, Calculator,
  Heart, MessageSquare, MoreHorizontal, ClipboardEdit,
  Sparkles, ShieldCheck, Receipt, Globe, ListChecks,
} from 'lucide-react';

interface NavItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

// Shared partner/ambassador bottom-nav destinations. Mirrors PARTNER_BASE_NAV
// in DashboardLayout — kept here separately because mobile caps at 4 primary
// tabs; everything else lives in the "More" sheet.
const PARTNER_MOBILE_NAV: NavItem[] = [
  { key: 'nav.overview', icon: LayoutDashboard, href: '/partner' },
  { key: 'nav.messages', icon: MessageSquare, href: '/partner/messages' },
  { key: 'nav.students', icon: GraduationCap, href: '/partner/students' },
  { key: 'nav.earnings', icon: TrendingUp, href: '/partner/earnings' },
];

// Max 4 primary items per role; the rest are reachable from "More".
const MOBILE_NAV_CONFIG: Record<AppRole, NavItem[]> = {
  admin: [
    { key: 'nav.overview', icon: LayoutDashboard, href: '/admin' },
    { key: 'nav.pipeline', icon: GitBranch, href: '/admin/pipeline' },
    { key: 'nav.messages', icon: MessageSquare, href: '/admin/messages' },
    { key: 'nav.financials', icon: DollarSign, href: '/admin/financials' },
  ],
  team_member: [
    { key: 'nav.myWork', icon: LayoutDashboard, href: '/team' },
    { key: 'nav.cases', icon: ClipboardList, href: '/team/cases' },
    { key: 'nav.messages', icon: MessageSquare, href: '/team/messages' },
    { key: 'nav.appointments', icon: CalendarDays, href: '/team/appointments' },
  ],
  social_media_partner: [...PARTNER_MOBILE_NAV],
  ambassador: [...PARTNER_MOBILE_NAV],
  agent: [
    { key: 'nav.overview', icon: LayoutDashboard, href: '/agent' },
    { key: 'nav.network', icon: Users, href: '/agent/network' },
    { key: 'nav.earnings', icon: TrendingUp, href: '/agent/earnings' },
    { key: 'nav.messages', icon: MessageSquare, href: '/agent/messages' },
  ],
  // Student: 4 top-level destinations mirroring the grouped sidebar.
  // Grouped parents link to their first child route (the most common entry).
  student: [
    { key: 'nav.nextSteps', icon: Sparkles, href: '/student' },
    { key: 'nav.group.studyFile', icon: BookOpen, href: '/student/checklist' },
    { key: 'nav.group.communication', icon: MessageSquare, href: '/student/messages' },
    { key: 'nav.group.account', icon: User, href: '/student/profile' },
  ],

};

/**
 * Destinations that don't fit the 4-tab bar. Previously these routes were
 * simply unreachable on mobile; the "More" sheet now exposes every page the
 * sidebar offers on desktop, so mobile and desktop have parity.
 */
const MOBILE_MORE_CONFIG: Record<AppRole, NavItem[]> = {
  admin: [
    { key: 'nav.students', icon: GraduationCap, href: '/admin/students' },
    { key: 'nav.team', icon: Users, href: '/admin/team' },
    { key: 'nav.inbox', icon: Inbox, href: '/admin/inbox' },
    { key: 'nav.programs', icon: BookOpen, href: '/admin/programs' },
    { key: 'nav.activity', icon: Activity, href: '/admin/activity' },
    { key: 'nav.settings', icon: Settings, href: '/admin/settings' },
  ],
  team_member: [
    { key: 'nav.submitNew', icon: UserPlus, href: '/team/submit' },
    { key: 'nav.reports', icon: BarChart2, href: '/team/analytics' },
    { key: 'nav.bagrut', icon: Calculator, href: '/team/bagrut' },
    { key: 'nav.cvBuilder', icon: FileText, href: '/team/tools/cv' },
    { key: 'nav.currency', icon: DollarSign, href: '/team/tools/currency' },
  ],
  social_media_partner: [
    { key: 'nav.apply', icon: ClipboardEdit, href: '/partner/apply' },
    { key: 'nav.network', icon: Users, href: '/partner/network' },
    { key: 'nav.account', icon: User, href: '/partner/profile' },
  ],
  ambassador: [
    { key: 'nav.network', icon: Users, href: '/partner/network' },
    { key: 'nav.account', icon: User, href: '/partner/profile' },
  ],
  agent: [
    { key: 'nav.students', icon: GraduationCap, href: '/agent/students' },
    { key: 'nav.apply', icon: ClipboardEdit, href: '/agent/apply' },
    { key: 'nav.account', icon: User, href: '/agent/profile' },
  ],
  student: [
    { key: 'nav.checklist', icon: ListChecks, href: '/student/checklist' },
    { key: 'nav.documents', icon: FileText, href: '/student/documents' },
    { key: 'nav.visa', icon: Globe, href: '/student/visa' },
    { key: 'nav.fees', icon: Receipt, href: '/student/fees' },
    { key: 'nav.contacts', icon: Users, href: '/student/contacts' },
    { key: 'nav.myData', icon: ShieldCheck, href: '/student/my-data' },
    { key: 'nav.bagrut', icon: Calculator, href: '/student/tools/bagrut' },
    { key: 'nav.cvBuilder', icon: FileText, href: '/student/tools/cv' },
    { key: 'nav.refer', icon: Heart, href: '/student/refer' },
  ],
};

interface MobileBottomNavProps {
  role: AppRole;
}

export default function MobileBottomNav({ role }: MobileBottomNavProps) {
  const location = useLocation();
  const { t } = useTranslation('dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const items = MOBILE_NAV_CONFIG[role] ?? [];
  const moreItems = MOBILE_MORE_CONFIG[role] ?? [];

  // Shorten keys for label display
  const shortLabel: Record<string, string> = {
    'nav.overview': t('nav.overview', 'Home'),
    'nav.pipeline': t('nav.pipeline', 'Pipeline'),
    'nav.team': t('nav.team', 'Team'),
    'nav.financials': t('nav.financials', 'Finance'),
    'nav.settings': t('nav.settings', 'Settings'),
    'nav.analytics': t('nav.analytics', 'Analytics'),
    'nav.reports': t('nav.reports', 'Reports'),
    'nav.activity': t('nav.activity', 'Activity'),
    'nav.myWork': t('nav.myWork', 'My work'),
    'nav.cases': t('nav.cases', 'Cases'),
    'nav.appointments': t('nav.appointments', 'Appts'),
    'nav.todayAppts': t('nav.todayAppts', 'Today'),
    'nav.submitNew': t('nav.submitNew', 'New'),
    'nav.students': t('nav.students', 'Students'),
    'nav.myLink': t('nav.myLink', 'My Link'),
    'nav.earnings': t('nav.earnings', 'Earnings'),
    'nav.checklist': t('nav.checklist', 'Checklist'),
    'nav.profile': t('nav.profile', 'Profile'),
    'nav.account': t('nav.account', 'Account'),
    'nav.documents': t('nav.documents', 'Docs'),
    'nav.visa': t('nav.visa', 'Visa'),
    'nav.fees': t('nav.fees', 'Fees'),
    'nav.myData': t('nav.myData', 'My data'),
    'nav.refer': t('nav.refer', 'Refer'),
    'nav.contacts': t('nav.contacts', 'Contacts'),
    'nav.programs': t('nav.programs', 'Programs'),
    'nav.submissions': t('nav.submissions', 'Submissions'),
    'nav.messages': t('nav.messages', 'Messages'),
    'nav.inbox': t('nav.inbox', 'Applications'),
    'nav.network': t('nav.network', 'Network'),
    'nav.recruit': t('nav.recruit', 'Recruit'),
    'nav.apply': t('nav.apply', 'Apply'),
    'nav.bagrut': t('nav.bagrut', 'Bagrut'),
    'nav.cvBuilder': t('nav.cvBuilder', 'CV'),
    'nav.currency': t('nav.currency', 'Currency'),
    'nav.bankDetails': t('nav.bankDetails', 'Bank'),
    'nav.group.studyFile': t('nav.group.studyFile', 'Study'),
    'nav.group.communication': t('nav.group.communication', 'Comms'),
    'nav.group.account': t('nav.group.account', 'Account'),
    'nav.nextSteps': t('nav.nextSteps', 'Next'),
  };

  const label = (key: string) => shortLabel[key] ?? t(key, key);

  // Student grouped parents stay active while any of their child routes is open.
  const groupChildHrefs: Record<string, string[]> = {
    'nav.group.studyFile': ['/student/checklist', '/student/documents', '/student/visa', '/student/fees'],
    'nav.group.communication': ['/student/messages', '/student/contacts'],
    'nav.group.account': ['/student/profile', '/student/my-data'],
  };

  const isItemActive = (item: NavItem) => {
    const childHrefs = groupChildHrefs[item.key];
    if (childHrefs) return childHrefs.some((h) => location.pathname.startsWith(h));
    return (
      location.pathname === item.href ||
      (item.href !== '/admin' &&
        item.href !== '/team' &&
        item.href !== '/partner' &&
        item.href !== '/agent' &&
        item.href !== '/student/checklist' &&
        location.pathname.startsWith(item.href))
    );
  };

  const moreActive = moreItems.some((i) => location.pathname.startsWith(i.href));

  const tabClass = (active: boolean) =>
    cn(
      'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
    );

  return (
    <nav
      role="navigation"
      aria-label={t('nav.bottomNav', 'Main navigation')}
      className="md:hidden fixed bottom-0 start-0 end-0 z-50 min-h-16 bg-background border-t border-border flex items-stretch pb-safe"
    >
      {items.map((item) => {
        const isActive = isItemActive(item);
        const labelText = label(item.key);
        return (
          <Link
            key={item.key}
            to={item.href}
            aria-current={isActive ? 'page' : undefined}
            aria-label={labelText}
            className={tabClass(isActive)}
          >
            <item.icon
              className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')}
              aria-hidden="true"
            />
            <span className="w-full min-w-0 truncate max-w-[68px] sm:max-w-[72px] text-center leading-tight">
              {labelText}
            </span>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
              />
            )}
          </Link>
        );
      })}

      {moreItems.length > 0 && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            className={tabClass(moreActive)}
            aria-label={t('nav.more', 'More')}
            aria-current={moreActive ? 'page' : undefined}
            aria-expanded={moreOpen}
          >
            <MoreHorizontal
              className={cn('h-5 w-5 shrink-0', moreActive && 'text-primary')}
              aria-hidden="true"
            />
            <span className="w-full min-w-0 truncate max-w-[68px] text-center leading-tight">
              {t('nav.more', 'More')}
            </span>
            {moreActive && (
              <span
                aria-hidden="true"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
              />
            )}
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader className="text-start">
              <SheetTitle className="text-base">{t('nav.more', 'More')}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                const labelText = label(item.key);
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={labelText}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border border-border p-3 text-center text-xs transition-colors min-w-0',
                      isActive
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="w-full min-w-0 truncate leading-tight">{labelText}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
