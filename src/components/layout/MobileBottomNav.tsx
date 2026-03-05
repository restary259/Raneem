import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';
import {
  LayoutDashboard, GitBranch, Users, BookOpen, FileCheck,
  DollarSign, BarChart2, Activity, Settings,
  CalendarDays, ClipboardList, UserPlus, GraduationCap,
  Link2, TrendingUp, ListChecks, User, FileText,
  Globe, Heart,
} from 'lucide-react';

interface NavItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

// Max 5 items per role for mobile bottom nav
const MOBILE_NAV_CONFIG: Record<AppRole, NavItem[]> = {
  admin: [
    { key: 'nav.overview', icon: LayoutDashboard, href: '/admin' },
    { key: 'nav.pipeline', icon: GitBranch, href: '/admin/pipeline' },
    { key: 'nav.students', icon: GraduationCap, href: '/admin/students' },
    { key: 'nav.financials', icon: DollarSign, href: '/admin/financials' },
    { key: 'nav.settings', icon: Settings, href: '/admin/settings' },
  ],
  team_member: [
    { key: 'nav.today', icon: LayoutDashboard, href: '/team' },
    { key: 'nav.cases', icon: ClipboardList, href: '/team/cases' },
    { key: 'nav.appointments', icon: CalendarDays, href: '/team/appointments' },
    { key: 'nav.students', icon: GraduationCap, href: '/team/students' },
    { key: 'nav.analytics', icon: BarChart2, href: '/team/analytics' },
  ],
  social_media_partner: [
    { key: 'nav.overview', icon: LayoutDashboard, href: '/partner' },
    { key: 'nav.myLink', icon: Link2, href: '/partner/link' },
    { key: 'nav.students', icon: GraduationCap, href: '/partner/students' },
    { key: 'nav.earnings', icon: TrendingUp, href: '/partner/earnings' },
  ],
  student: [
    { key: 'nav.checklist', icon: ListChecks, href: '/student/checklist' },
    { key: 'nav.profile', icon: User, href: '/student/profile' },
    { key: 'nav.documents', icon: FileText, href: '/student/documents' },
    { key: 'nav.visa', icon: Globe, href: '/student/visa' },
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
    'nav.today': t('nav.today', 'Today'),
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
  };

  return (
    <nav className="md:hidden fixed bottom-0 start-0 end-0 z-50 h-16 bg-background border-t border-border flex items-center safe-area-pb">
      {items.map((item) => {
        const isActive =
          location.pathname === item.href ||
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
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
            <span className="truncate max-w-[48px] text-center leading-tight">
              {shortLabel[item.key] ?? t(item.key, item.key)}
            </span>
            {isActive && (
              <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
