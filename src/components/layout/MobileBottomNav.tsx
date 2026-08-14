import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';
import {
  LayoutDashboard, GitBranch, Users, BookOpen, FileCheck,
  DollarSign, BarChart2, Activity, Settings,
  CalendarDays, ClipboardList, UserPlus, GraduationCap,
  TrendingUp, ListChecks, User, FileText,
  Globe, Heart, MessageSquare,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

// Shared partner/ambassador bottom-nav destinations. Mirrors PARTNER_BASE_NAV
// in DashboardLayout — kept here separately because mobile caps at 5 items and
// omits the partner "Apply" entry (the Apply form is a full-page flow, not a
// daily-destination tab). Both roles use the identical set today.
const PARTNER_MOBILE_NAV: NavItem[] = [
  { key: 'nav.overview', icon: LayoutDashboard, href: '/partner' },
  { key: 'nav.messages', icon: MessageSquare, href: '/partner/messages' },
  { key: 'nav.students', icon: GraduationCap, href: '/partner/students' },
  { key: 'nav.earnings', icon: TrendingUp, href: '/partner/earnings' },
];

// Max 5 items per role for mobile bottom nav
const MOBILE_NAV_CONFIG: Record<AppRole, NavItem[]> = {
  admin: [
    { key: 'nav.overview', icon: LayoutDashboard, href: '/admin' },
    { key: 'nav.pipeline', icon: GitBranch, href: '/admin/pipeline' },
    { key: 'nav.messages', icon: MessageSquare, href: '/admin/messages' },
    { key: 'nav.students', icon: GraduationCap, href: '/admin/students' },
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
  // Student: 5 top-level destinations mirroring the grouped sidebar.
  // Grouped parents link to their first child route (the most common entry).
  student: [
    { key: 'nav.nextSteps', icon: Sparkles, href: '/student' },
    { key: 'nav.group.studyFile', icon: BookOpen, href: '/student/checklist' },
    { key: 'nav.group.communication', icon: MessageSquare, href: '/student/messages' },
    { key: 'nav.group.account', icon: User, href: '/student/profile' },
    { key: 'nav.refer', icon: Heart, href: '/student/refer' },
  ],

};

interface MobileBottomNavProps {
  role: AppRole;
}

export default function MobileBottomNav({ role }: MobileBottomNavProps) {
  const location = useLocation();
  const { t } = useTranslation('dashboard');
  const items = MOBILE_NAV_CONFIG[role] ?? [];

  // Shorten keys for label display
  const shortLabel: Record<string, string> = {
    'nav.overview': t('nav.overview', 'Home'),
    'nav.pipeline': t('nav.pipeline', 'Pipeline'),
    'nav.team': t('nav.team', 'Team'),
    'nav.financials': t('nav.financials', 'Finance'),
    'nav.settings': t('nav.settings', 'Settings'),
    'nav.analytics': t('nav.analytics', 'Analytics'),
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
    'nav.documents': t('nav.documents', 'Docs'),
    'nav.visa': t('nav.visa', 'Visa'),
    'nav.refer': t('nav.refer', 'Refer'),
    'nav.contacts': t('nav.contacts', 'Contacts'),
    'nav.programs': t('nav.programs', 'Programs'),
    'nav.submissions': t('nav.submissions', 'Submissions'),
    'nav.messages': t('nav.messages', 'Messages'),
    'nav.inbox': t('nav.inbox', 'Applications'),
    'nav.group.studyFile': t('nav.group.studyFile', 'Study'),
    'nav.group.communication': t('nav.group.communication', 'Comms'),
    'nav.group.account': t('nav.group.account', 'Account'),
    'nav.nextSteps': t('nav.nextSteps', 'Next'),
  };

  // Student grouped parents stay active while any of their child routes is open.
  const groupChildHrefs: Record<string, string[]> = {
    'nav.group.studyFile': ['/student/checklist', '/student/documents', '/student/visa', '/student/fees'],
    'nav.group.communication': ['/student/messages', '/student/contacts'],
    'nav.group.account': ['/student/profile', '/student/my-data'],
  };

  return (
    <nav className="md:hidden fixed bottom-0 start-0 end-0 z-50 min-h-16 bg-background border-t border-border flex items-center pb-safe">
      {items.map((item) => {
        const childHrefs = groupChildHrefs[item.key];
        const isActive = childHrefs
          ? childHrefs.some((h) => location.pathname === h || location.pathname.startsWith(h))
          : location.pathname === item.href ||
            (item.href !== '/admin' &&
              item.href !== '/team' &&
              item.href !== '/partner' &&
              item.href !== '/student/checklist' &&
              location.pathname.startsWith(item.href));
        return (
          <Link
            key={item.key}
            to={item.href}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
            <span className="w-full truncate max-w-[64px] sm:max-w-[72px] text-center leading-tight">
              {shortLabel[item.key] ?? t(item.key, item.key)}
            </span>
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
